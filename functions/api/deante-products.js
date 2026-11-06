
export async function onRequestGet(context) {
  const apiKey = context.env.DEANTE_API_KEY;

  if (!apiKey) {
    return Response.json(
      { ok: false, error: "Brak konfiguracji Deante" },
      { status: 503 }
    );
  }

  async function getDeanteData(endpoint) {
    const url = new URL(`https://api.deante.pl/api/${endpoint}`);
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      cf: { cacheTtl: 1800, cacheEverything: true }
    });

    if (!response.ok) {
      throw new Error(`${endpoint}: HTTP ${response.status}`);
    }

    const data = await response.json();

    const items = Array.isArray(data)
      ? data
      : data?.[endpoint];

    if (!Array.isArray(items)) {
      throw new Error(`Nieznany format: ${endpoint}`);
    }

    return items;
  }

  try {
    const [catalog, stocks] = await Promise.all([
      getDeanteData("products"),
      getDeanteData("stocks")
    ]);

    const stockMap = new Map(
      stocks.map(item => [String(item.id), item])
    );

    const products = catalog
      .filter(product =>
        product.id &&
        Number(product.prices?.netPrice) > 0
      )
      .slice(0, 10)
      .map(product => {
        const stockData = stockMap.get(String(product.id));

        const catalogNet = Number(product.prices.netPrice);
        const saleNet = catalogNet * 0.76;
        const saleGross = Math.round(saleNet * 1.23 * 100) / 100;

        return {
          id: `deante-${product.id}`,
          supplier: "deante",
          sku: product.id,
          ean: product.ean,
          brand: product.brand,
          name: product.name,
          collection: product.collection,
          categories: product.categories,
          images: product.images,
          description: product.description,
          properties: product.properties,
          features: product.features,
          package: product.package,
          price: saleGross,
          currency: "PLN",
          stock: stockData?.stock ?? null,
          inStock: stockData
            ? Number(stockData.stock) > 0
            : false,
          availabilityDate: stockData?.availabilityDate ?? null
        };
      });

    return Response.json({
      ok: true,
      supplier: "deante",
      catalogCount: catalog.length,
      stockCount: stocks.length,
      count: products.length,
      products
    }, {
      headers: { "Cache-Control": "no-store" }
    });

  } catch (error) {
    console.error("Deante integration:", error.message);

    return Response.json({
      ok: false,
      error: "Nie udało się połączyć danych Deante"
    }, { status: 502 });
  }
}
