
import { getSaturnTimestamp, md5 } from "./products.js";

const CLIENT_ID = 101670;
const MAX_ITEMS = 30;

function reply(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function moneyValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (
    value &&
    typeof value === "object" &&
    typeof value.Value === "number" &&
    Number.isFinite(value.Value)
  ) {
    return value.Value;
  }
  return null;
}

function pricingUnit(value) {
  const unit = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s/g, "")
    .replace("²", "2");

  if (["szt", "szt.", "sztuka", "sztuki"].includes(unit)) {
    return "piece";
  }
  if (["m2", "m^2"].includes(unit)) {
    return "sqm";
  }
  return "unknown";
}

function sellingPrice(product) {
  const unit = pricingUnit(product.Unit);

  if (unit === "piece") {
    return moneyValue(product.RetailPriceNet);
  }

  if (unit === "sqm") {
    const purchase = moneyValue(product.PriceAfterDiscountNet);
    return purchase === null
      ? null
      : Math.round((purchase + 7) * 1.23 * 100) / 100;
  }

  return null;
}

function attributeContains(product, name, matcher) {
  const attribute = Array.isArray(product.Attributes)
    ? product.Attributes.find(
        a => String(a.Name || "").trim().toLowerCase() === name
      )
    : null;

  return Array.isArray(attribute?.Features) &&
    attribute.Features.some(
      f => matcher(String(f.Name || "").trim())
    );
}

function isSellable(product) {
  return attributeContains(product, "gatunek", v => v === "1") &&
    !attributeContains(
      product,
      "status",
      v => v.toLowerCase().includes("wycof")
    );
}

async function getToken(apiKey) {
  const timestamp = getSaturnTimestamp();
  const hash = md5(
    apiKey.trim().toUpperCase() +
    timestamp +
    String(CLIENT_ID)
  );

  const response = await fetch("https://phsaturn.pl/api3/token", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      Hash: hash,
      ClientId: CLIENT_ID,
      Timestamp: timestamp
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Saturn token HTTP " + response.status);
  }

  const data = await response.json();
  const token = data.AccessToken || data.accessToken;

  if (!token) throw new Error("Saturn token missing");
  return token;
}

async function findByEan(ean, token) {
  const url = new URL(
    "https://phsaturn.pl/api3/product/findProduct"
  );

  url.searchParams.set(
    "field",
    "Id,Name,Ean,Unit,Qty,InStock,Attributes," +
    "PriceAfterDiscountNet,RetailPriceNet,QuantityPerBox"
  );
  url.searchParams.set("productsEan", ean);
  url.searchParams.set("pageNumber", "1");
  url.searchParams.set("pageSize", "25");

  const response = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
      "Authorization": "Bearer " + token
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Saturn products HTTP " + response.status);
  }

  const data = await response.json();

  if (!Array.isArray(data.Items)) {
    throw new Error("Invalid Saturn products response");
  }

  return data.Items.find(
    p => String(p.Ean ?? "").trim() === ean
  ) || null;
}

export async function onRequestPost(context) {
  try {
    const apiKey = context.env.SATURN_API_KEY;

    if (!apiKey) {
      return reply({
        ok: false,
        error: "Brak konfiguracji API."
      }, 503);
    }

    const raw = await context.request.text();

    if (raw.length > 12000) {
      return reply({
        ok: false,
        error: "Zbyt duże zgłoszenie."
      }, 413);
    }

    let body;

    try {
      body = JSON.parse(raw);
    } catch {
      return reply({
        ok: false,
        error: "Nieprawidłowy JSON."
      }, 400);
    }

    if (
      !Array.isArray(body?.items) ||
      body.items.length < 1 ||
      body.items.length > MAX_ITEMS
    ) {
      return reply({
        ok: false,
        error: "Nieprawidłowy koszyk."
      }, 400);
    }

    const quantities = new Map();

    for (const item of body.items) {
      const ean = String(item?.ean ?? "").trim();
      const quantity = Number(item?.quantity);

      if (
        !/^\d{8,14}$/.test(ean) ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        quantity > 100000
      ) {
        return reply({
          ok: false,
          error: "Nieprawidłowe dane produktu."
        }, 400);
      }

      quantities.set(
        ean,
        (quantities.get(ean) || 0) + quantity
      );
    }

    const token = await getToken(apiKey);
    const items = [];

    for (const [ean, quantity] of quantities) {
      const product = await findByEan(ean, token);

      if (!product || !isSellable(product)) {
        items.push({
          ean,
          quantity,
          ok: false,
          reason: "Produkt niedostępny w ofercie"
        });
        continue;
      }

      const unitType = pricingUnit(product.Unit);
      const stock = Number(product.Qty);
      const box = Number(product.QuantityPerBox);
      const price = sellingPrice(product);

      const validQuantity = unitType === "sqm"
        ? Number.isFinite(box) &&
          box > 0 &&
          Math.abs(
            quantity / box - Math.round(quantity / box)
          ) < 1e-6
        : unitType === "piece" && Number.isInteger(quantity);

      const available =
        product.InStock === true &&
        Number.isFinite(stock) &&
        stock >= quantity - 1e-9;

      const ok =
        validQuantity &&
        available &&
        price !== null &&
        price > 0;

      items.push({
        ean,
        id: product.Id,
        name: product.Name,
        quantity,
        unit: product.Unit,
        price,
        available,
        validQuantity,
        ok,
        reason: ok
          ? null
          : !available
            ? "Niewystarczający stan"
            : !validQuantity
              ? "Nieprawidłowa ilość"
              : "Brak ceny"
      });
    }

    return reply({
      ok: items.every(item => item.ok),
      items
    });

  } catch (error) {
    console.error("validate-cart:", error);

    return reply({
      ok: false,
      error: "Nie udało się sprawdzić koszyka w Saturnie."
    }, 503);
  }
}
