export async function onRequestGet(context) {
  try {
    const apiKey = context.env.SATURN_API_KEY;

    if (!apiKey) {
      return json(
        {
          ok: false,
          error: "Brak SATURN_API_KEY w Cloudflare."
        },
        500
      );
    }

    const fields = [
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
    ].join(",");

    const url = new URL(
      "https://phsaturn.pl/api3/product/findProduct"
    );

    url.searchParams.set("field", fields);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        ApiKey: apiKey
      }
    });

    const text = await response.text();

    if (!response.ok) {
      return json(
        {
          ok: false,
          error: "Błąd API Saturn",
          status: response.status,
          response: text
        },
        response.status
      );
    }

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return json(
        {
          ok: false,
          error: "Saturn zwrócił odpowiedź, która nie jest JSON.",
          response: text
        },
        502
      );
    }

    return json({
      ok: true,
      source: "Saturn",
      count: data.Count ?? 0,
      products: data.Items ?? []
    });

  } catch (error) {
    return json(
      {
        ok: false,
        error: error?.message || String(error)
      },
      500
    );
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
