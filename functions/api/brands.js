
import { getSaturnTimestamp, md5 } from "./products.js";

export async function onRequestGet(context) {
  try {
    const apiKey = context.env.SATURN_API_KEY;

    if (!apiKey) {
      return Response.json(
        { ok: false, error: "Brak konfiguracji API" },
        { status: 500 }
      );
    }

    const url = new URL(context.request.url);
    const page = Math.max(
      1,
      parseInt(url.searchParams.get("page") || "1", 10) || 1
    );

    const batchSize = 10;
    const clientId = "101670";
    const timestamp = getSaturnTimestamp();

    const hash = md5(
      apiKey.trim().toUpperCase() + timestamp + clientId
    );

    const tokenResponse = await fetch(
      "https://phsaturn.pl/api3/token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          Hash: hash,
          ClientId: Number(clientId),
          Timestamp: timestamp
        })
      }
    );

    if (!tokenResponse.ok) {
      throw new Error("Nie udało się zalogować do Saturna");
    }

    const tokenData = await tokenResponse.json();
    const token =
      tokenData.AccessToken || tokenData.accessToken;

    if (!token) {
      throw new Error("Saturn nie zwrócił tokenu");
    }

    const brands = new Set();
    let nextPage = page;
    let hasMore = true;
    let processedPages = 0;

    for (let i = 0; i < batchSize; i++) {
      const saturnUrl = new URL(
        "https://phsaturn.pl/api3/product/findProduct"
      );

      saturnUrl.searchParams.set(
        "field",
        "Id,Brand,Attributes"
      );
      saturnUrl.searchParams.set(
        "pageNumber",
        String(nextPage)
      );
      saturnUrl.searchParams.set("pageSize", "25");

      const response = await fetch(saturnUrl.toString(), {
        headers: {
          Accept: "application/json",
          Authorization: "Bearer " + token
        }
      });

      if (!response.ok) {
        throw new Error(
          "Błąd Saturna na stronie " + nextPage
        );
      }

      const data = await response.json();
      const items = Array.isArray(data.Items)
        ? data.Items
        : [];

      for (const product of items) {
        let brand = product.Brand;

        if (!brand && Array.isArray(product.Attributes)) {
          const attribute = product.Attributes.find(
            item => item.Name === "Marka"
          );

          brand = attribute?.Features?.[0]?.Name;
        }

        if (typeof brand === "string" && brand.trim()) {
          brands.add(brand.trim());
        }
      }

      processedPages++;
      nextPage++;

      hasMore = data.HasMore === true;

      if (!hasMore) break;
    }

    return Response.json({
      ok: true,
      brands: [...brands].sort((a, b) =>
        a.localeCompare(b, "pl")
      ),
      processedPages,
      nextPage: hasMore ? nextPage : null,
      hasMore
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
