import json
import time
import threading
import webbrowser
import tkinter as tk
from tkinter import ttk, messagebox
from pathlib import Path

import requests


USER_AGENT = "Plytki-Net-Bud-Integrator/1.0.1 (+https://plytkinetbud.github.io/plytki-net-bud/integrator/)"
CLIENT_ID = "96310627ab454fc9ae7f9e7ba4418b4a"

ALLEGRO_AUTH = "https://allegro.pl/auth/oauth"
ALLEGRO_API = "https://api.allegro.pl"
SATURN_API = "https://phsaturn.pl"

CFG = Path.home() / ".plytki_net_bud_integrator.json"


def load_cfg():
    try:
        return json.loads(CFG.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_cfg(data):
    CFG.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


class Allegro:
    def __init__(self, secret):
        self.secret = secret.strip()
        self.tokens = {}

    def device(self):
        response = requests.post(
            ALLEGRO_AUTH + "/device",
            auth=(CLIENT_ID, self.secret),
            data={"client_id": CLIENT_ID},
            headers={"User-Agent": USER_AGENT},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def token(self, device_data):
        deadline = time.time() + device_data.get("expires_in", 600)

        while time.time() < deadline:
            response = requests.post(
                ALLEGRO_AUTH + "/token",
                auth=(CLIENT_ID, self.secret),
                data={
                    "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                    "device_code": device_data["device_code"],
                },
                headers={"User-Agent": USER_AGENT},
                timeout=30,
            )

            if response.status_code == 200:
                self.tokens = response.json()
                return

            try:
                error = response.json().get("error")
            except Exception:
                error = ""

            if error in ("authorization_pending", "slow_down"):
                delay = device_data.get("interval", 5)

                if error == "slow_down":
                    delay += 5

                time.sleep(delay)
                continue

            response.raise_for_status()

        raise TimeoutError("Minął czas autoryzacji Allegro.")

    def headers(self):
        return {
            "Authorization": "Bearer " + self.tokens["access_token"],
            "Accept": "application/vnd.allegro.public.v1+json",
            "Content-Type": "application/vnd.allegro.public.v1+json",
            "Accept-Language": "pl-PL",
            "User-Agent": USER_AGENT,
        }

    def find(self, ean):
        response = requests.get(
            ALLEGRO_API + "/sale/products",
            params={
                "phrase": ean,
                "mode": "GTIN",
            },
            headers=self.headers(),
            timeout=30,
        )

        response.raise_for_status()
        return response.json()


class Saturn:
    def __init__(self, key):
        self.key = key.strip()

    def get(self, path, params=None):
        last_response = None

        for header_name in ("ApiKey", "X-Api-Key", "Authorization"):
            response = requests.get(
                SATURN_API + path,
                params=params,
                headers={
                    header_name: self.key,
                    "Accept": "application/json",
                },
                timeout=45,
            )

            last_response = response

            if response.status_code not in (401, 403):
                response.raise_for_status()
                return response.json()

        raise RuntimeError(
            f"Saturn HTTP {last_response.status_code}. "
            "Sprawdź autoryzację API."
        )

    def stock(self):
        return self.get(
            "/api3/product/stock",
            {
                "changeTrackingId": 0
            }
        )

    def find(self, ean):
        fields = ",".join([
            "Id",
            "Name",
            "Ean",
            "Sku",
            "Description",
            "Model",
            "Brand",
            "Unit",
            "Weight",
            "Vat",
            "Availability",
            "Qty",
            "InStock",
            "RetailPriceNet",
            "RetailPriceGross",
            "PriceAfterDiscountNet",
            "Photo",
            "Photos",
            "RequiredBox",
            "QuantityPerBox",
        ])

        return self.get(
            "/api3/product/findProduct",
            {
                "field": fields,
                "productsEan": ean,
            }
        )


class App(tk.Tk):
    def __init__(self):
        super().__init__()

        self.title("Płytki Net Bud Integrator 1.0.1")
        self.geometry("950x650")

        self.config_data = load_cfg()

        self.allegro = None
        self.saturn_api = None

        self.create_ui()

    def create_ui(self):
        ttk.Label(
            self,
            text="Płytki Net Bud Integrator",
            font=("Segoe UI", 20, "bold"),
        ).pack(
            anchor="w",
            padx=18,
            pady=(16, 2)
        )

        ttk.Label(
            self,
            text="Saturn → Allegro",
            font=("Segoe UI", 10),
        ).pack(
            anchor="w",
            padx=18
        )

        notebook = ttk.Notebook(self)

        notebook.pack(
            fill="both",
            expand=True,
            padx=18,
            pady=16
        )

        connections = ttk.Frame(
            notebook,
            padding=18
        )

        product_test = ttk.Frame(
            notebook,
            padding=18
        )

        notebook.add(
            connections,
            text="Połączenia"
        )

        notebook.add(
            product_test,
            text="Test produktu"
        )

        ttk.Label(
            connections,
            text="Client ID Allegro"
        ).grid(
            row=0,
            column=0,
            sticky="w",
            pady=7
        )

        ttk.Label(
            connections,
            text=CLIENT_ID
        ).grid(
            row=0,
            column=1,
            sticky="w"
        )

        ttk.Label(
            connections,
            text="Client Secret Allegro"
        ).grid(
            row=1,
            column=0,
            sticky="w",
            pady=7
        )

        self.secret = tk.StringVar(
            value=self.config_data.get(
                "client_secret",
                ""
            )
        )

        ttk.Entry(
            connections,
            textvariable=self.secret,
            show="•",
            width=55
        ).grid(
            row=1,
            column=1,
            sticky="ew"
        )

        ttk.Button(
            connections,
            text="Połącz z Allegro",
            command=self.connect_allegro
        ).grid(
            row=2,
            column=1,
            sticky="w",
            pady=8
        )

        self.allegro_status = ttk.Label(
            connections,
            text="Niepołączone"
        )

        self.allegro_status.grid(
            row=2,
            column=2,
            padx=15
        )

        ttk.Separator(
            connections
        ).grid(
            row=3,
            column=0,
            columnspan=3,
            sticky="ew",
            pady=18
        )

        ttk.Label(
            connections,
            text="API Key Saturn"
        ).grid(
            row=4,
            column=0,
            sticky="w",
            pady=7
        )

        self.saturn_key = tk.StringVar(
            value=self.config_data.get(
                "saturn_api_key",
                ""
            )
        )

        ttk.Entry(
            connections,
            textvariable=self.saturn_key,
            show="•",
            width=55
        ).grid(
            row=4,
            column=1,
            sticky="ew"
        )

        ttk.Button(
            connections,
            text="Testuj Saturn",
            command=self.connect_saturn
        ).grid(
            row=5,
            column=1,
            sticky="w",
            pady=8
        )

        self.saturn_status = ttk.Label(
            connections,
            text="Niepołączone"
        )

        self.saturn_status.grid(
            row=5,
            column=2,
            padx=15
        )

        ttk.Label(
            connections,
            text=(
                "Sekrety pozostają lokalnie na tym komputerze. "
                "Nie umieszczaj ich w GitHubie."
            ),
            wraplength=700
        ).grid(
            row=6,
            column=0,
            columnspan=3,
            sticky="w",
            pady=22
        )

        connections.columnconfigure(
            1,
            weight=1
        )

        bar = ttk.Frame(product_test)

        bar.pack(
            fill="x"
        )

        ttk.Label(
            bar,
            text="EAN / GTIN"
        ).pack(
            side="left"
        )

        self.ean = tk.StringVar()

        ttk.Entry(
            bar,
            textvariable=self.ean,
            width=28
        ).pack(
            side="left",
            padx=8
        )

        ttk.Button(
            bar,
            text="Saturn",
            command=self.find_saturn
        ).pack(
            side="left",
            padx=3
        )

        ttk.Button(
            bar,
            text="Allegro",
            command=self.find_allegro
        ).pack(
            side="left",
            padx=3
        )

        self.output = tk.Text(
            product_test,
            wrap="word",
            font=("Consolas", 10)
        )

        self.output.pack(
            fill="both",
            expand=True,
            pady=12
        )

    def persist(self):
        save_cfg({
            "client_secret": self.secret.get(),
            "saturn_api_key": self.saturn_key.get(),
        })

    def show_json(self, data):
        self.output.delete(
            "1.0",
            "end"
        )

        self.output.insert(
            "end",
            json.dumps(
                data,
                ensure_ascii=False,
                indent=2
            )
        )

    def connect_allegro(self):
        if not self.secret.get().strip():
            return messagebox.showwarning(
                "Allegro",
                "Wklej Client Secret."
            )

        self.persist()

        self.allegro = Allegro(
            self.secret.get()
        )

        self.allegro_status.config(
            text="Autoryzacja…"
        )

        threading.Thread(
            target=self.allegro_worker,
            daemon=True
        ).start()

    def allegro_worker(self):
        try:
            device_data = self.allegro.device()

            url = (
                device_data.get("verification_uri_complete")
                or device_data.get("verification_uri")
            )

            code = device_data.get(
                "user_code",
                ""
            )

            self.after(
                0,
                lambda: (
                    webbrowser.open(url),
                    messagebox.showinfo(
                        "Allegro",
                        "Zaloguj się do Allegro i zaakceptuj dostęp.\n"
                        "Kod: " + code
                    )
                )
            )

            self.allegro.token(
                device_data
            )

            self.after(
                0,
                lambda: self.allegro_status.config(
                    text="Połączono ✓"
                )
            )

        except Exception as error:
            self.after(
                0,
                lambda: messagebox.showerror(
                    "Allegro",
                    str(error)
                )
            )

    def connect_saturn(self):
        if not self.saturn_key.get().strip():
            return messagebox.showwarning(
                "Saturn",
                "Wklej API Key."
            )

        self.persist()

        self.saturn_api = Saturn(
            self.saturn_key.get()
        )

        try:
            self.saturn_api.stock()

            self.saturn_status.config(
                text="Połączono ✓"
            )

        except Exception as error:
            messagebox.showerror(
                "Saturn",
                str(error)
            )

    def find_saturn(self):
        ean = self.ean.get().strip()

        if not ean:
            return messagebox.showwarning(
                "Saturn",
                "Wpisz EAN / GTIN."
            )

        try:
            if not self.saturn_api:
                self.saturn_api = Saturn(
                    self.saturn_key.get()
                )

            result = self.saturn_api.find(
                ean
            )

            self.show_json(
                result
            )

        except Exception as error:
            messagebox.showerror(
                "Saturn",
                str(error)
            )

    def find_allegro(self):
        ean = self.ean.get().strip()

        if not ean:
            return messagebox.showwarning(
                "Allegro",
                "Wpisz EAN / GTIN."
            )

        if (
            not self.allegro
            or not self.allegro.tokens
        ):
            return messagebox.showwarning(
                "Allegro",
                "Najpierw połącz Allegro."
            )

        try:
            result = self.allegro.find(
                ean
            )

            self.show_json(
                result
            )

        except Exception as error:
            messagebox.showerror(
                "Allegro",
                str(error)
            )


if __name__ == "__main__":
    App().mainloop()
