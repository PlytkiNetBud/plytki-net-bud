let products = [];
let cart = [];
let category = "Wszystkie";
let arrangements = {};

let currentPage = 1;
let hasMoreProducts = false;
let currentSearchQuery = "";
let currentFeatured = false;
let isLoadingMore = false;
let currentApiUrl = "";

let searchRequestId = 0;


async function loadArrangements() {
  try {
    const response = await fetch("/arrangements.json");

    if (!response.ok) {
      throw new Error("Nie udało się pobrać aranżacji");
    }

    arrangements = await response.json();
    console.log("Baza aranżacji wczytana");
  } catch (error) {
    console.warn("Błąd wczytywania aranżacji:", error);
  }
}

loadArrangements();

async function loadBrands() {
  try {
    const response = await fetch("/brands.json");

    if (!response.ok) {
      throw new Error("Nie udało się pobrać producentów");
    }

    const brands = await response.json();
    const brandSelect = document.querySelector("#filterBrand");

    if (!brandSelect || !Array.isArray(brands)) return;

    const previousBrand = brandSelect.value;

    brandSelect.innerHTML =
      '<option value="">Wszyscy producenci</option>';

    brands.forEach(brand => {
      const option = document.createElement("option");
      option.value = brand;
      option.textContent = brand;
      brandSelect.appendChild(option);
    });

    brandSelect.value = previousBrand;
  } catch (error) {
    console.error("Błąd pobierania producentów:", error);
  }
}

loadBrands();

const searchInput = document.querySelector("#search");
const urlParams = new URLSearchParams(window.location.search);
const selectedBrand = urlParams.get("brand");

// ================================
// POBIERANIE PRODUKTÓW Z SATURNA
// ================================

async function searchProducts(query, featured = false) {
 
const requestId = ++searchRequestId;
 
currentPage = 1;
currentSearchQuery = String(query || "").trim();
currentFeatured = featured;
hasMoreProducts = false;

const loadMoreBtn = document.querySelector("#loadMoreBtn");
if (loadMoreBtn) {
  loadMoreBtn.hidden = true;
}

  const q = String(query || "").trim();

  if (!q && !featured) {
    products = [];
    render();
    return;
  }

  showLoading();

  try {
    const featuredTerms = [
  "calacatta",
  "wood",
  "stone",
  "marble",
  "beige",
  "grey",
  "oak",
  "beton",
  "marmur",
  "gres"
];

const randomTerm = featuredTerms[
  Math.floor(Math.random() * featuredTerms.length)
];


const isEan = /^\d{8,14}$/.test(q);
const isSku = /^CP\d+$/i.test(q);


const apiUrl = featured
  ? "/api/products?featured=1&q=" + encodeURIComponent(randomTerm)
  : (document.querySelector("#filterBrand")?.value === q ||
   (selectedBrand && q.toLowerCase() === selectedBrand.toLowerCase()))
    ? "/api/products?brand=" + encodeURIComponent(q)
    : isEan
      ? "/api/products?ean=" + encodeURIComponent(q)
      : isSku
        ? "/api/products?sku=" + encodeURIComponent(q)
        : "/api/products?q=" + encodeURIComponent(q);


const paginatedApiUrl = new URL(apiUrl, window.location.origin);
paginatedApiUrl.searchParams.set("pageNumber", String(currentPage));

currentApiUrl = paginatedApiUrl.toString();


const response = await fetch(paginatedApiUrl.toString());

    const data = await response.json();

if (requestId !== searchRequestId) return;

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error || "Nie udało się pobrać produktów."
      );
    }

hasMoreProducts = data.hasMore === true;

const moreButton = document.querySelector("#loadMoreBtn");

if (moreButton) {
  moreButton.hidden = !hasMoreProducts;
}

    products = (data.products || []).map(p => ({
      id: p.id,
      cat: "Płytki",
      brand: p.brand || "",
      name: p.name || "",
      ean: p.ean || "",
      sku: p.sku || "",
      price: p.price,
      box: p.quantityPerBox,
      stock: p.quantity || 0,
      inStock: p.inStock,
      requiredBox: p.requiredBox,
      unit: p.unit || "",
      weight: p.weight,
      img: p.photo || (
  Array.isArray(p.photos) && p.photos.length
    ? p.photos[0]
    : ""
),
photos: [...new Set(
  [p.photo, ...(Array.isArray(p.photos) ? p.photos : [])]
    .filter(Boolean)
)]
}));



render();

    render();

  } catch (error) {
    console.error(error);

    const grid = getProductGrid();

    if (grid) {
      grid.innerHTML = `
        <div class="empty">
          Nie udało się pobrać produktów.
          Spróbuj ponownie za chwilę.
        </div>
      `;
    }
  }
}


async function loadMoreProducts() {
  if (isLoadingMore || !hasMoreProducts || !currentApiUrl) return;

  isLoadingMore = true;
  const button = document.querySelector("#loadMoreBtn");

  if (button) {
    button.disabled = true;
    button.textContent = "Ładowanie produktów…";
  }

  try {
    const nextPage = currentPage + 1;
    const url = new URL(currentApiUrl);
    url.searchParams.set("pageNumber", String(nextPage));

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Błąd pobierania produktów");
    }

    const newProducts = (data.products || []).map(p => ({
      id: p.id,
      cat: "Płytki",
      brand: p.brand || "",
      name: p.name || "",
      ean: p.ean || "",
      sku: p.sku || "",
      price: p.price,
      box: p.quantityPerBox,
      stock: p.quantity || 0,
      inStock: p.inStock,
      requiredBox: p.requiredBox,
      unit: p.unit || "",
      weight: p.weight,
      img: p.photo || (Array.isArray(p.photos) ? p.photos[0] : ""),
      photos: [...new Set(
        [p.photo, ...(Array.isArray(p.photos) ? p.photos : [])]
          .filter(Boolean)
      )]
    }));

    const existingIds = new Set(products.map(p => String(p.id)));

    products.push(
      ...newProducts.filter(p => !existingIds.has(String(p.id)))
    );

    currentPage = nextPage;
    hasMoreProducts = data.hasMore === true;

    
    render();

    if (button) button.hidden = !hasMoreProducts;

  } catch (error) {
    console.error(error);
    alert("Nie udało się pobrać kolejnych produktów.");
  } finally {
    isLoadingMore = false;

    if (button) {
      button.disabled = false;
      button.textContent = "Pokaż więcej produktów";
    }
  }
}


const brandFilter = document.querySelector("#filterBrand");

if (brandFilter) {
  brandFilter.addEventListener("change", () => {
    const brand = brandFilter.value;

    if (brand) {
      searchProducts(brand);
    } else {
      searchProducts("", true);
    }
  });
}

let searchTimer;

if (searchInput) {
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);

    const value = searchInput.value.trim();

    if (!value) {
      products = [];
      render();
      return;
    }

    searchTimer = setTimeout(() => {
      searchProducts(value);
    }, 450);
  });

  searchInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      clearTimeout(searchTimer);
      searchProducts(searchInput.value);
    }
  });
}


// ================================
// KATEGORIE
// ================================

document
  .querySelectorAll("[data-cat]")
  .forEach(button => {

    button.onclick = () => {
      category = button.dataset.cat;

      render();

      const section =
        document.querySelector("#products");

      if (section) {
        section.scrollIntoView({
          behavior: "smooth"
        });
      }
    };
  });


// ================================
// FORMATOWANIE CENY
// ================================

function money(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "Zapytaj o cenę";
  }

  return number.toLocaleString(
    "pl-PL",
    {
      style: "currency",
      currency: "PLN"
    }
  );
}


// ================================
// GRID PRODUKTÓW
// ================================

function getProductGrid() {
  return (
    document.querySelector("#productGrid") ||
    document.querySelector(".product-grid") ||
    document.querySelector("#products .grid")
  );
}


function showLoading() {
  const grid = getProductGrid();

  if (grid) {
    grid.innerHTML = `
      <div class="empty">
        Szukamy produktów…
      </div>
    `;
  }
}


// ================================
// RENDEROWANIE PRODUKTÓW
// ================================

function render() {
  const grid = getProductGrid();

  if (!grid) {
    return;
  }

  let list = products.filter(product => {
    return (
      category === "Wszystkie" ||
      product.cat === category
    );
  }); 
const availabilityFilter =
  document.querySelector("#filterAvailability")?.value || "all";

if (availabilityFilter === "available") {
  list = list.filter(product =>
    product.inStock || Number(product.stock) > 0
  );
}

const selectedFilterBrand =
  document.querySelector("#filterBrand")?.value || "";

if (selectedFilterBrand) {
  list = list.filter(product =>
    product.brand === selectedFilterBrand
  );
}

  const sort =
    document.querySelector("#sort")?.value;

  if (sort === "priceAsc") {
    list.sort(
      (a, b) =>
        (a.price ?? Infinity) -
        (b.price ?? Infinity)
    );
  }

  if (sort === "priceDesc") {
    list.sort(
      (a, b) =>
        (b.price ?? -Infinity) -
        (a.price ?? -Infinity)
    );
  }

  if (!list.length) {
    grid.innerHTML = `
      <div class="empty">
        <strong>Chwilowo brak produktów w ofercie</strong>
<br>
Aktualnie nie mamy produktów spełniających wybrane kryteria.
      </div>
    `;

    return;
  }

  grid.innerHTML = list.map(product => {

    const image = product.img
      ? `
        <img
          src="${escapeHtml(product.img)}"
          alt="${escapeHtml(product.name)}"
          loading="lazy"
        >
      `
      : `
        <div class="no-photo">
          Brak zdjęcia
        </div>
      `;

    const availability =
      product.inStock || product.stock > 0
        ? `Dostępne: ${Number(product.stock).toLocaleString("pl-PL", {
            maximumFractionDigits: 2
          })} ${product.unit || ""}`
        : "Sprawdź dostępność";

    const boxInfo =
      product.box
        ? `
          <span>
            Opakowanie:
            ${formatNumber(product.box)} m²
          </span>
        `
        : "";

    return `
  <article class="product-card">

    <div class="product-image">
      ${product.inStock || Number(product.stock) > 0
        ? '<span class="stock-badge">Dostępny</span>'
        : ''}
      ${image}
    </div>
        <div class="product-body">

          ${
            product.brand
              ? `
                <div class="product-brand">
                  ${escapeHtml(product.brand)}
                </div>
              `
              : ""
          }

          <h3>
            ${escapeHtml(product.name)}
          </h3>

          <div class="product-code">
            ${
              product.sku
                ? `SKU: ${escapeHtml(product.sku)}`
                : ""
            }

            ${
              product.ean
                ? `<br>EAN: ${escapeHtml(product.ean)}`
                : ""
            }
          </div>

          <div class="product-info">
            ${boxInfo}

            <span>
              ${escapeHtml(availability)}
            </span>
          </div>

        <div class="product-price">
  ${money(product.price)}
  ${product.unit ? `<small>/ ${escapeHtml(product.unit)}</small>` : ""}

  ${
    product.box && Number(product.box) > 0
      ? `
        <div class="box-price">
          Opakowanie ${Number(product.box).toLocaleString("pl-PL", {
            maximumFractionDigits: 2
          })} ${escapeHtml(product.unit || "")}:
          <strong>${money(product.price * Number(product.box))}</strong>
        </div>
      `
      : ""
  }
</div>

          <div class="product-actions">

            <button
              type="button"
              onclick="details(${Number(product.id)})"
            >
              Szczegóły
            </button>

            <button
              type="button"
              onclick="add(${Number(product.id)})"
            >
              Dodaj do zapytania
            </button>

          </div>

        </div>

      </article>
    `;
  }).join("");
}


// ================================
// DODAWANIE DO ZAPYTANIA
// ================================

function add(id) {
  const product =
    products.find(
      p => Number(p.id) === Number(id)
    );

  if (!product) {
    return;
  }

  const exists =
    cart.some(
      p => Number(p.id) === Number(id)
    );

  if (!exists) {
    cart.push(product);
  }

  updateCart();

  const panel =
    document.querySelector("#cartPanel");

  if (
    panel &&
    !panel.classList.contains("open")
  ) {
    toggleCart();
  }
}


// ================================
// KOSZYK / LISTA ZAPYTANIA
// ================================

function updateCart() {
  const count =
    document.querySelector("#cartCount");

  if (count) {
    count.textContent = cart.length;
  }

  const items =
    document.querySelector("#cartItems");

  if (!items) {
    return;
  }

  if (!cart.length) {
    items.innerHTML = `
      <p>
        Nie dodałeś jeszcze żadnego produktu.
      </p>
    `;

    return;
  }

  items.innerHTML = cart.map(product => `
    <div class="cart-item">

      <div>
        <strong>
          ${escapeHtml(product.name)}
        </strong>

        ${
          product.sku
            ? `
              <small>
                ${escapeHtml(product.sku)}
              </small>
            `
            : ""
        }
      </div>

      <div>
        ${money(product.price)}
      </div>

      <button
        type="button"
        onclick="removeFromCart(${Number(product.id)})"
        aria-label="Usuń produkt"
      >
        ×
      </button>

    </div>
  `).join("");
}


function removeFromCart(id) {
  cart = cart.filter(
    product =>
      Number(product.id) !== Number(id)
  );

  updateCart();
}


function toggleCart() {
  document
    .querySelector("#cartPanel")
    ?.classList.toggle("open");

  document
    .querySelector("#shade")
    ?.classList.toggle("open");
}


// ================================
// SZCZEGÓŁY PRODUKTU
// ================================


function getProductArrangements(product) {
  const name = String(product.name || "").toLowerCase();
  const ean = String(product.ean || "").trim();

  if (
    ean === "5904584110085" ||
    (name.includes("monpelli") && name.includes("olive"))
  ) {
    return arrangements.paradyz?.monpelli?.olive?.images || [];
  }

  return [];
}

function details(id) {
  const product = products.find(
    p => Number(p.id) === Number(id)
  );

  if (!product) return;
const arrangementPhotos = getProductArrangements(product);

const galleryPhotos = [
  ...(product.photos || []),
  ...arrangementPhotos
];

product.galleryPhotos = [...new Set(galleryPhotos)];
  const modal = document.querySelector("#productModal");
  const content = document.querySelector("#productDetails");

  if (!modal || !content) return;

  const unit = String(product.unit || "").trim().toLowerCase();
  const isArea = unit === "m2" || unit === "m²";
  const box = Number(product.box);
  const price = Number(product.price);

  const canOrder =
    Number.isFinite(price) &&
    price > 0 &&
    (!isArea || (Number.isFinite(box) && box > 0));

  const purchaseControls = !canOrder
    ? `<p>Skontaktuj się z nami w celu ustalenia ilości i ceny.</p>`
    : isArea
      ? `
        <div class="detail-calculator">
          <h3>Kalkulator płytek</h3>

          <label for="detailArea">Potrzebna powierzchnia (m²)</label>
          <input id="detailArea" type="number"
                 min="0.01" step="any" value="${box}">

          <label for="detailWaste">Zapas na docinki (%)</label>
          <select id="detailWaste">
            <option value="0">0%</option>
            <option value="5">5%</option>
            <option value="10" selected>10%</option>
            <option value="15">15%</option>
          </select>

          <p id="detailQuantity"></p>
          <p id="detailTotal"></p>
        </div>
      `
      : `
        <div class="detail-calculator">
          <label for="detailPieces">Liczba sztuk</label>
          <input id="detailPieces" type="number"
                 min="1" step="1" value="1">

          <p id="detailQuantity"></p>
          <p id="detailTotal"></p>
        </div>
      `;

  content.innerHTML = `
    <div class="detail-layout">
      <div class="detail-image">
  ${product.img
    ? `
      <img
      onclick="openImageZoom(this.src)"
        id="detailMainImage"
        src="${escapeHtml(product.img)}"
        alt="${escapeHtml(product.name)}"
      >

      <div class="detail-thumbnails">
        ${(product.galleryPhotos || []).map((photo, index) => `
          <button
            type="button"
            class="detail-thumbnail"
            onclick="changeDetailPhoto(${Number(product.id)}, ${index})"
            aria-label="Pokaż zdjęcie ${index + 1}"
          >
            <img
              src="${escapeHtml(photo)}"
              alt="Zdjęcie ${index + 1}"
              loading="lazy"
            >
          </button>
        `).join("")}
      </div>
    `
    : `<div class="no-photo">Brak zdjęcia</div>`
  }
</div>

      <div class="detail-info">
        <p>${escapeHtml(product.brand)}</p>
        <h2>${escapeHtml(product.name)}</h2>

        <h3>${money(product.price)}
          <small>/ ${escapeHtml(product.unit)}</small>
        </h3>

        <p>EAN: ${escapeHtml(product.ean)}</p>
        <p>SKU: ${escapeHtml(product.sku)}</p>

        <p>Opakowanie: ${
          Number.isFinite(box) && box > 0
            ? formatNumber(box) + " " + escapeHtml(product.unit)
            : "Brak danych"
        }</p>

        <p>${
          product.inStock || product.stock > 0
            ? "Produkt dostępny"
            : "Sprawdź dostępność"
        }</p>

        ${purchaseControls}

        ${canOrder
          ? `<button class="primary" type="button"
                     onclick="add(${Number(product.id)})">
               Dodaj do zapytania
             </button>`
          : ""}
      </div>
    </div>
  `;

  modal.classList.add("open");

  if (!canOrder) return;

  function updateDetailCalculation() {
    let quantity;
    let total;

    if (isArea) {
      const area = Number(
        document.querySelector("#detailArea")?.value
      );
      const waste = Number(
        document.querySelector("#detailWaste")?.value
      );

      if (!Number.isFinite(area) || area <= 0) {
        document.querySelector("#detailQuantity").textContent =
          "Podaj powierzchnię większą od zera.";
        document.querySelector("#detailTotal").textContent = "";
        return;
      }

      const boxes = Math.ceil(
        (area * (1 + waste / 100)) / box - 1e-9
      );

      quantity = boxes * box;
      total = quantity * price;

      document.querySelector("#detailQuantity").textContent =
        `Do zamówienia: ${boxes} op. / ${formatNumber(quantity)} m²`;
    } else {
      const pieces = Number(
        document.querySelector("#detailPieces")?.value
      );

      if (!Number.isInteger(pieces) || pieces < 1) {
        document.querySelector("#detailQuantity").textContent =
          "Podaj pełną liczbę sztuk, minimum 1.";
        document.querySelector("#detailTotal").textContent = "";
        return;
      }

      quantity = pieces;
      total = pieces * price;

      document.querySelector("#detailQuantity").textContent =
        `Do zamówienia: ${pieces} szt.`;
    }

    document.querySelector("#detailTotal").textContent =
      `Wartość produktów: ${money(total)}`;
  }

  document.querySelector("#detailArea")
    ?.addEventListener("input", updateDetailCalculation);

  document.querySelector("#detailWaste")
    ?.addEventListener("change", updateDetailCalculation);

  document.querySelector("#detailPieces")
    ?.addEventListener("input", updateDetailCalculation);

  updateDetailCalculation();
}

function changeDetailPhoto(productId, photoIndex) {
  const product = products.find(
    p => Number(p.id) === Number(productId)
  );

  const photo = product?.galleryPhotos?.[photoIndex];
  const mainImage = document.querySelector("#detailMainImage");

  if (!photo || !mainImage) return;

  mainImage.src = photo;
}
function openImageZoom(src) {
  if (!src) return;

  const overlay = document.createElement("div");
  overlay.id = "imageZoomOverlay";

  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.92);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: zoom-out;
    padding: 20px;
    box-sizing: border-box;
  `;

  const image = document.createElement("img");
  image.src = src;
  image.alt = "Powiększone zdjęcie produktu";

  image.style.cssText = `
    max-width: 100%;
    max-height: 90vh;
    object-fit: contain;
    border-radius: 6px;
  `;

  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKeyDown);
  };

  const onKeyDown = event => {
    if (event.key === "Escape") close();
  };

  overlay.addEventListener("click", close);
  document.addEventListener("keydown", onKeyDown);

    const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "×";
  closeButton.setAttribute("aria-label", "Zamknij powiększenie");

  closeButton.style.cssText = `
    position: absolute;
    top: 20px;
    right: 25px;
    width: 48px;
    height: 48px;
    border: none;
    border-radius: 50%;
    background: rgba(255,255,255,0.15);
    color: white;
    font-size: 34px;
    cursor: pointer;
    z-index: 1;
  `;

  closeButton.addEventListener("click", close);
  overlay.appendChild(closeButton);
  overlay.appendChild(image);
  document.body.appendChild(overlay);
}
function closeProduct() {
  document.querySelector("#productModal")?.classList.remove("open");
}


// ================================
// KALKULATOR PŁYTEK
// ================================

function calculate() {
  const areaInput =
    document.querySelector("#area");

  const wasteInput =
    document.querySelector("#waste");

  const boxInput =
    document.querySelector("#boxArea");

  const result =
    document.querySelector("#calcResult");

  if (
    !areaInput ||
    !wasteInput ||
    !boxInput ||
    !result
  ) {
    return;
  }

  const area =
    Number(areaInput.value) || 0;

  const waste =
    Number(wasteInput.value) || 0;

  const box =
    Number(boxInput.value) || 0;

  if (area <= 0 || box <= 0) {
    result.textContent = "—";
    return;
  }

  const requiredArea =
    area * (1 + waste / 100);

  const boxes =
    Math.ceil(requiredArea / box);

  const finalArea =
    boxes * box;

  result.textContent =
    `${boxes} op. / ${formatNumber(finalArea)} m²`;
}


// ================================
// POMOCNICZE
// ================================

function formatNumber(value) {
  return Number(value).toLocaleString(
    "pl-PL",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }
  );
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// ================================
// START
// ================================
if (selectedBrand) {
  if (searchInput) {
    searchInput.value = selectedBrand;
  }

  searchProducts(selectedBrand);
} else {
  searchProducts("", true);
}

calculate();
updateCart();
