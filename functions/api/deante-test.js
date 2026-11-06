
export async function onRequestGet(context) {
  const apiKey = context.env.DEANTE_API_KEY;

  if (!apiKey) {
    return Response.json(
      { ok: false, error: "Brak DEANTE_API_KEY" },
      { status: 500 }
    );
  }

  const url = new URL("https://api.deante.pl/api/products");
  url.searchParams.set("key", apiKey);

  try {
    
const response = await fetch(url.toString(), {
  headers: { Accept: "application/json" },
  cf: {
    cacheEverything: true,
    cacheTtl: 1800
  }
});


    if (!response.ok) {
      return Response.json(
        {
          ok: false,
          status: response.status,
          error: "Deante odmówiło dostępu lub zwróciło błąd"
        },
        { status: 502 }
      );
    }

    const data = await response.json();

    const products = Array.isArray(data)
      ? data
      : Array.isArray(data.products)
        ? data.products
        : null;

    return Response.json(
      {
        ok: true,
        format: "JSON",
        structure: Array.isArray(data) ? "array" : typeof data,
        keys: Array.isArray(data) ? [] : Object.keys(data),
        productCount: products?.length ?? null,
        sampleFields: products?.[0]
  ? Object.keys(products[0])
  : [],
sampleProduct: products?.[0]
  ? {
      id: products[0].id,
      name: products[0].name,
      ean: products[0].ean,
      prices: products[0].prices ?? "BRAK CEN DLA TEGO PRODUKTU",
package: products[0].package ?? null,
properties: products[0].properties ?? null,
features: products[0].features ?? null,
offerType: products[0].offerType ?? null

    }
  : null,

        message: "Połączenie z Deante działa"
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch {
    return Response.json(
      {
        ok: false,
        error: "Nie udało się odczytać odpowiedzi Deante"
      },
      { status: 502 }
    );
  }
}

