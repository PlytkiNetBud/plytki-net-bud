import json, time, threading, webbrowser, tkinter as tk
from tkinter import ttk, messagebox
from pathlib import Path
import requests

USER_AGENT = "Plytki-Net-Bud-Integrator/1.0.0 (+https://plytkinetbud.github.io/plytki-net-bud/integrator/)"
CLIENT_ID = "96310627ab454fc9ae7f9e7ba4418b4a"
ALLEGRO_AUTH = "https://allegro.pl/auth/oauth"
ALLEGRO_API = "https://api.allegro.pl"
CFG = Path.home() / ".plytki_net_bud_integrator.json"

def load_cfg():
    try: return json.loads(CFG.read_text(encoding="utf-8"))
    except: return {}

def save_cfg(d):
    CFG.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")

class Allegro:
    def __init__(self, secret):
        self.secret, self.tokens = secret.strip(), {}
    def device(self):
        r=requests.post(ALLEGRO_AUTH+"/device",auth=(CLIENT_ID,self.secret),
            data={"client_id":CLIENT_ID},headers={"User-Agent":USER_AGENT},timeout=30)
        r.raise_for_status(); return r.json()
    def token(self, d):
        deadline=time.time()+d.get("expires_in",600)
        while time.time()<deadline:
            r=requests.post(ALLEGRO_AUTH+"/token",auth=(CLIENT_ID,self.secret),
                data={"grant_type":"urn:ietf:params:oauth:grant-type:device_code","device_code":d["device_code"]},
                headers={"User-Agent":USER_AGENT},timeout=30)
            if r.status_code==200: self.tokens=r.json(); return
            try: e=r.json().get("error")
            except: e=""
            if e in ("authorization_pending","slow_down"):
                time.sleep(d.get("interval",5)+(5 if e=="slow_down" else 0)); continue
            r.raise_for_status()
        raise TimeoutError("Minął czas autoryzacji.")
    def headers(self):
        return {"Authorization":"Bearer "+self.tokens["access_token"],
          "Accept":"application/vnd.allegro.public.v1+json",
          "Content-Type":"application/vnd.allegro.public.v1+json",
          "Accept-Language":"pl-PL","User-Agent":USER_AGENT}
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
        "QuantityPerBox"
    ])

    r = requests.get(
        f"{SATURN_API}/api3/product/findProduct",
        params={
            "field": fields,
            "productsEan": ean
        },
        headers=self.headers(),
        timeout=30,
    )

    r.raise_for_status()
    return r.json()

class Saturn:
    def __init__(self,key): self.key=key.strip()
    def get(self,path,params=None):
        last=None
        for name in ("ApiKey","X-Api-Key","Authorization"):
            r=requests.get("https://phsaturn.pl"+path,params=params,
                           headers={name:self.key,"Accept":"application/json"},timeout=45)
            last=r
            if r.status_code not in (401,403):
                r.raise_for_status(); return r.json()
        raise RuntimeError(f"Saturn HTTP {last.status_code}. Jeśli klucz jest poprawny, dopasujemy nazwę nagłówka do Swaggera.")
    def stock(self): return self.get("/api3/product/stock",{"changeTrackingId":0})
    def find(self,ean): return self.get("/api3/product/findProduct",{"productsEan":ean})

class App(tk.Tk):
    def __init__(self):
        super().__init__(); self.title("Płytki Net Bud Integrator 1.0"); self.geometry("950x650")
        self.c=load_cfg(); self.a=None; self.s=None; self.ui()
    def ui(self):
        ttk.Label(self,text="Płytki Net Bud Integrator",font=("Segoe UI",20,"bold")).pack(anchor="w",padx=18,pady=(16,2))
        ttk.Label(self,text="Saturn → Allegro",font=("Segoe UI",10)).pack(anchor="w",padx=18)
        nb=ttk.Notebook(self); nb.pack(fill="both",expand=True,padx=18,pady=16)
        con=ttk.Frame(nb,padding=18); test=ttk.Frame(nb,padding=18); nb.add(con,text="Połączenia"); nb.add(test,text="Test produktu")
        ttk.Label(con,text="Client ID Allegro").grid(row=0,column=0,sticky="w",pady=7)
        ttk.Label(con,text=CLIENT_ID).grid(row=0,column=1,sticky="w")
        ttk.Label(con,text="Client Secret Allegro").grid(row=1,column=0,sticky="w",pady=7)
        self.secret=tk.StringVar(value=self.c.get("client_secret",""))
        ttk.Entry(con,textvariable=self.secret,show="•",width=55).grid(row=1,column=1,sticky="ew")
        ttk.Button(con,text="Połącz z Allegro",command=self.connect).grid(row=2,column=1,sticky="w",pady=8)
        self.ast=ttk.Label(con,text="Niepołączone"); self.ast.grid(row=2,column=2,padx=15)
        ttk.Separator(con).grid(row=3,column=0,columnspan=3,sticky="ew",pady=18)
        ttk.Label(con,text="API Key Saturn").grid(row=4,column=0,sticky="w",pady=7)
        self.key=tk.StringVar(value=self.c.get("saturn_api_key",""))
        ttk.Entry(con,textvariable=self.key,show="•",width=55).grid(row=4,column=1,sticky="ew")
        ttk.Button(con,text="Testuj Saturn",command=self.saturn).grid(row=5,column=1,sticky="w",pady=8)
        self.sst=ttk.Label(con,text="Niepołączone"); self.sst.grid(row=5,column=2,padx=15)
        ttk.Label(con,text="Sekrety pozostają lokalnie na tym komputerze. Nie umieszczaj ich w GitHubie.",wraplength=700).grid(row=6,column=0,columnspan=3,sticky="w",pady=22)
        con.columnconfigure(1,weight=1)
        bar=ttk.Frame(test); bar.pack(fill="x")
        ttk.Label(bar,text="EAN / GTIN").pack(side="left"); self.ean=tk.StringVar()
        ttk.Entry(bar,textvariable=self.ean,width=28).pack(side="left",padx=8)
        ttk.Button(bar,text="Saturn",command=self.find_s).pack(side="left",padx=3)
        ttk.Button(bar,text="Allegro",command=self.find_a).pack(side="left",padx=3)
        self.out=tk.Text(test,wrap="word",font=("Consolas",10)); self.out.pack(fill="both",expand=True,pady=12)
    def persist(self): save_cfg({"client_secret":self.secret.get(),"saturn_api_key":self.key.get()})
    def show(self,x): self.out.delete("1.0","end"); self.out.insert("end",json.dumps(x,ensure_ascii=False,indent=2))
    def connect(self):
        if not self.secret.get().strip(): return messagebox.showwarning("Allegro","Wklej Client Secret.")
        self.persist(); self.a=Allegro(self.secret.get()); self.ast.config(text="Autoryzacja…")
        threading.Thread(target=self.worker,daemon=True).start()
    def worker(self):
        try:
            d=self.a.device(); url=d.get("verification_uri_complete") or d.get("verification_uri")
            self.after(0,lambda:(webbrowser.open(url),messagebox.showinfo("Allegro","Zaloguj się do Allegro i zaakceptuj dostęp.\nKod: "+d.get("user_code",""))))
            self.a.token(d); self.after(0,lambda:self.ast.config(text="Połączono ✓"))
        except Exception as e: self.after(0,lambda:messagebox.showerror("Allegro",str(e)))
    def saturn(self):
        if not self.key.get().strip(): return messagebox.showwarning("Saturn","Wklej API Key.")
        self.persist(); self.s=Saturn(self.key.get())
        try: self.s.stock(); self.sst.config(text="Połączono ✓")
        except Exception as e: messagebox.showerror("Saturn",str(e))
    def find_s(self):
        try:
            if not self.s:self.s=Saturn(self.key.get())
            self.show(self.s.find(self.ean.get().strip()))
        except Exception as e: messagebox.showerror("Saturn",str(e))
    def find_a(self):
        try:
            if not self.a or not self.a.tokens: return messagebox.showwarning("Allegro","Najpierw połącz Allegro.")
            self.show(self.a.find(self.ean.get().strip()))
        except Exception as e: messagebox.showerror("Allegro",str(e))
if __name__=="__main__": App().mainloop()
