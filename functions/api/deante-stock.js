
export async function onRequestGet(context) {
  const apiKey = context.env.DEANTE_API_KEY;

  if (!apiKey) {
    return Response.json(
      { ok: false, error: "Brak konfiguracji Deante" },
      { status: 503 }
    );
  }

  const url = new URL("https://api.deante.pl/api/stocks");
  url.searchParams.set("key", apiKey);

  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      return Response.json(
        {
          ok: false,
          error: "Błąd pobierania stanów Deante",
          status: response.status
        },
        { status: 502 }
      );
    }

    const data = await response.json();
    const stocks = Array.isArray(data)
      ? data
      : Array.isArray(data.stocks)
        ? data.stocks
        : null;

    if (!stocks) {
      return Response.json(
        { ok: false, error: "Nieznany format danych" },
        { status: 502 }
      );
    }

    return Response.json({
      ok: true,
      stockCount: stocks.length,
      sampleStock: stocks[0]
        ? {
            id: stocks[0].id,
            ean: stocks[0].ean,
            stock: stocks[0].stock,
            availabilityDate: stocks[0].availabilityDate
          }
        : null
    }, {
      headers: { "Cache-Control": "no-store" }
    });

  } catch (error) {
    console.error("Deante stocks:", error);
    return Response.json(
      { ok: false, error: "Nie udało się pobrać stanów" },
      { status: 502 }
    );
  }
}
