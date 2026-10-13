
const API_URL = "https://plytki-net-bud.pages.dev/api/products";
const PAGE_SIZE = 100;
const MAX_PAGES = 200;
const DELAY_MS = 300;

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function getPage(pageNumber) {
  const url = new URL(API_URL);
  url.searchParams.set("pageSizeTest", "1");
  url.searchParams.set("pageNumber", String(pageNumber));

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "Cache-Control": "no-cache" }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (
        data.ok !== true ||
        !Array.isArray(data.products) ||
        data.saturnPageSize !== PAGE_SIZE ||
        data.pageNumber !== pageNumber ||
        typeof data.count !== "number" ||
        typeof data.totalFound !== "number" ||
        typeof data.hasMore !== "boolean" ||
        !Number.isInteger(data.diagnostic?.receivedFromSaturn) ||
data.diagnostic.receivedFromSaturn < data.count ||
data.diagnostic.receivedFromSaturn > PAGE_SIZE
      ) {
        throw new Error("Nieprawidłowa odpowiedź API");
      }

      return data;
    } catch (error) {
      if (attempt === 3) throw error;
      await sleep(attempt * 2000);
    }
  }
}

async function main() {
  let total = 0;
  let totalFound = null;
  let pagesChecked = 0;
  let completed = false;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await getPage(page);

    if (totalFound === null) {
      totalFound = data.totalFound;
    } else if (data.totalFound !== totalFound) {
      throw new Error("Katalog zmienił się podczas liczenia");
    }

    total += data.count;
    pagesChecked++;

    console.log(
      `Strona ${page}: ${data.count} produktów, razem ${total}`
    );

    if (data.hasMore === false) {
      completed = true;
      break;
    }

    await sleep(DELAY_MS);
  }

  if (!completed || totalFound === null) {
    throw new Error("Nie udało się policzyć całego katalogu");
  }

  const result = {
    count: total,
    source: "Saturn",
    totalFound,
    pagesChecked,
    updatedAt: new Date().toISOString()
  };

  const fs = await import("node:fs/promises");

  await fs.mkdir("shop", { recursive: true });
  await fs.writeFile(
    "shop/catalog-count.json",
    JSON.stringify(result, null, 2) + "\n",
    "utf8"
  );

  console.log(`Gotowe! Liczba produktów: ${total}`);
}

main().catch((error) => {
  console.error("Błąd liczenia:", error);
  process.exitCode = 1;
});
