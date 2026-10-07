export async function onRequestGet(context) {
  try {
    const apiKey = context.env.SATURN_API_KEY;

    if (!apiKey) {
      return json({
        ok: false,
        error: "Brak SATURN_API_KEY w Cloudflare."
      }, 500);
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

    // Jeżeli podasz ?ean=..., wyszukamy konkretny produkt
    const ean = new URL(context.request.url).searchParams.get("ean");

    if (ean) {
      url.searchParams.set("productsEan", ean);
    }

    const headerVariants = [
      { name: "ApiKey", value: apiKey },
      { name: "X-Api-Key", value: apiKey },
      { name: "Authorization", value: apiKey }
    ];

    let lastStatus = null;
    let lastText = "";
    let usedHeader = "";

    for (const variant of headerVariants) {

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Accept": "application/json",
          [variant.name]: variant.value
        }
      });

      const text = await response.text();

      lastStatus = response.status;
      lastText = text;

      // Tak samo jak w aplikacji Windows:
      // przy 401/403 próbujemy kolejny sposób autoryzacji.
      if (response.status === 401 || response.status === 403) {
        continue;
      }

      usedHeader = variant.name;

      if (!response.ok) {
        return json({
          ok: false,
          error: "Błąd API Saturn",
          status: response.status,
          response: text
        }, response.status);
      }

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        return json({
          ok: false,
          error: "Saturn zwrócił odpowiedź, która nie jest JSON.",
          response: text
        }, 502);
      }

      return json({
        ok: true,
        source: "Saturn",
        authorizationMethod: usedHeader,
        count: data.Count ?? data.Items?.length ?? 0,
        products: data.Items ?? data
      });
    }

    return json({
      ok: false,
      error: "Saturn odrzucił wszystkie sposoby autoryzacji.",
      status: lastStatus,
      response: lastText
    }, lastStatus || 401);

  } catch (error) {
    return json({
      ok: false,
      error: error?.message || String(error)
    }, 500);
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
