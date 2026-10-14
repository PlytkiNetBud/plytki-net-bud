let products = [];
let cart = [];

try {
  const savedCart = JSON.parse(localStorage.getItem("plytkiNetBudCart"));

  if (Array.isArray(savedCart)) {
    cart = savedCart;
  }
} catch (error) {
  console.warn("Nie udało się przywrócić koszyka:", error);
}

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




function cleanProductName(name, brand) {
  let result = String(name || "").trim();

  // Usuwanie technicznych prefiksów dostawcy
  result = result.replace(/^S\s+ITC\s+/i, "");
  result = result.replace(/^CC\s+/i, "");
  result = result.replace(/^[A-Z]\s+/i, "");

  // Naturalny zapis nazw produktów
  result = result.toLocaleLowerCase("pl-PL");

  result = result.replace(
    /(^|[\s\-\/(])(\p{L})/gu,
    (match, separator, letter) =>
      separator + letter.toLocaleUpperCase("pl-PL")
  );

  // Zachowanie ważnych oznaczeń technicznych
  result = result.replace(/\bpei\s*(iv|iii|ii|v|i)\b/gi,
    (_, level) => "PEI " + level.toUpperCase()
  );

  result = result.replace(/\br\s*(9|10|11|12|13)\b/gi,
    (_, level) => "R" + level
  );

  result = result.replace(/\b(\d+(?:[.,]\d+)?)\s*mm\b/gi,
    (_, size) => size + " mm"
  );

  result = result.replace(/\b(\d+(?:[.,]\d+)?)\s*cm\b/gi,
    (_, size) => size + " cm"
  );

  result = result.replace(/\b(\d+(?:[.,]\d+)?)\s*m2\b/gi,
    (_, size) => size + " m²"
  );

  // Standardowy zapis wymiarów
  result = result.replace(
    /(\d)\s*[x×]\s*(\d)/gi,
    "$1x$2"
  );

  return result;
}

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



const apiUrl = !q && !featured
  ? "/api/products"
  : featured
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
      name: cleanProductName(p.name, p.brand),
      ean: p.ean || "",
      sku: p.sku || "",
      price: p.price,
      box: p.quantityPerBox,
piecesPerBox: p.piecesPerBox,
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
      name: cleanProductName(p.name, p.brand),
      ean: p.ean || "",
      sku: p.sku || "",
      price: p.price,
      box: p.quantityPerBox,
piecesPerBox: p.piecesPerBox,
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
      searchProducts("", false);
    }
  });
}

let searchTimer;

if (searchInput) {
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);

    const value = searchInput.value.trim();

    if (!value) {
  searchProducts("", false);
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

${isOversizedProduct(product)
  ? `
    <p class="product-logistics-note">
      🚚 Transport wielkoformatowy —
      koszt dostawy i nośnika paletowego
      wyceniany indywidualnie.
    </p>
  `
  : ""}

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
              Dodaj do koszyka
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

function add(id, quantity = null) {
  const product =
    products.find(
      p => Number(p.id) === Number(id)
    );

  if (!product) {
    return;
  }

  const unit = String(product.unit || "").trim().toLowerCase();
  const isArea = unit === "m2" || unit === "m²";
  const box = Number(product.box);

  let selectedQuantity = Number(quantity);

  if (!Number.isFinite(selectedQuantity) || selectedQuantity <= 0) {
    selectedQuantity = isArea && box > 0 ? box : 1;
  }

  if (isArea && box > 0) {
    selectedQuantity =
      Math.ceil(selectedQuantity / box - 1e-9) * box;
  } else {
    selectedQuantity = Math.max(1, Math.ceil(selectedQuantity));
  }

  
 
  const existingProduct = cart.find(
    p => Number(p.id) === Number(id)
  );

  if (existingProduct) {
    existingProduct.quantity += selectedQuantity;
  } else {
    cart.push({
      ...product,
      quantity: selectedQuantity
    });
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


function calculateCartWeight() {
  let totalWeight = 0;
  let missingWeight = false;

  cart.forEach(product => {
    const weight = Number(product.weight);
    const quantity = Number(product.quantity);

    if (
      product.weight == null ||
      product.weight === "" ||
      !Number.isFinite(weight) ||
      weight <= 0
    ) {
      missingWeight = true;
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) return;

    totalWeight += weight * quantity;
  });

  return {
    totalWeight,
    missingWeight
  };
}



function updateCart() {
  try {
    localStorage.setItem("plytkiNetBudCart", JSON.stringify(cart));
  } catch (error) {
    console.warn("Nie udało się zapisać koszyka:", error);
  }

  const checkoutButton = document.querySelector("#cartCheckoutButton");

  if (checkoutButton) {
    const hasOversizedProducts = cart.some(isOversizedProduct);

    checkoutButton.textContent = hasOversizedProducts
      ? "Zapytaj o wycenę →"
      : "Przejdź do zamówienia →";
  }


  
  const cartTotal = cart.reduce((sum, product) => {
    return sum + Number(product.price) * Number(product.quantity);
  }, 0);
  
  const deliveryInfo = document.querySelector("#cartDeliveryInfo");

  if (deliveryInfo) {
    const costs = calculateOrderCosts();

    if (costs.oversizedDelivery) {
      deliveryInfo.textContent =
        "Transport: wycena indywidualna. " +
        "Nośnik paletowy: wycena indywidualna. " +
        "Ostateczne koszty potwierdzimy przed przyjęciem zamówienia.";
    } else {
      deliveryInfo.textContent =
        (costs.delivery === 0
          ? "Transport: GRATIS. "
          : "Transport: 249 zł brutto (GRATIS od 2500 zł brutto). ") +
        "Nośnik paletowy: 49,20 zł brutto za paletę. " +
        "Liczba palet zostanie potwierdzona przed przyjęciem zamówienia.";
    }
  }


  const totalElement = document.querySelector("#cartTotal");

  if (totalElement) {
    totalElement.textContent = money(cartTotal);
  }

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
      <span class="cart-product-brand">
        ${escapeHtml(product.brand || "")}
      </span>

      <strong>
        ${escapeHtml(cleanProductName(product.name, product.brand))}
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
        <small>Ilość:</small>

        <div class="cart-quantity">
          <button
            type="button"
            onclick="changeCartQuantity(${Number(product.id)}, -1)"
            aria-label="Zmniejsz ilość"
          >−</button>

          <span>
            ${formatNumber(product.quantity)}
            ${escapeHtml(product.unit)}
          </span>

          <button
            type="button"
            onclick="changeCartQuantity(${Number(product.id)}, 1)"
            aria-label="Zwiększ ilość"
          >+</button>
        </div>

        <div>
          ${money(product.price)} / ${escapeHtml(product.unit)}
        </div>
        <strong>
          Razem: ${money(Number(product.price) * product.quantity)}
        </strong>
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


function changeCartQuantity(id, direction) {
  const product = cart.find(
    p => Number(p.id) === Number(id)
  );

  if (!product || ![1, -1].includes(direction)) {
    return;
  }

  const unit = String(product.unit || "").trim().toLowerCase();
  const isArea = unit === "m2" || unit === "m²";
  const box = Number(product.box);

  const step = isArea && Number.isFinite(box) && box > 0
    ? box
    : 1;

  const currentSteps = Math.max(
    1,
    Math.round(Number(product.quantity) / step)
  );

  const newSteps = currentSteps + direction;

  if (newSteps < 1) {
    return;
  }

  product.quantity = Number((newSteps * step).toFixed(6));

  updateCart();
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



const DELIVERY_FREE_FROM = 2500;
const DELIVERY_PRICE = 249;
const PALLET_PRICE = 49.20;


function isOversizedProduct(product) {
  const name = String(product.name || "").toLowerCase();

  const dimensions = name.matchAll(
    /(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/g
  );

  for (const match of dimensions) {
    const width = Number(match[1].replace(",", "."));
    const height = Number(match[2].replace(",", "."));

    const shortSide = Math.min(width, height);
    const longSide = Math.max(width, height);

    const is120x120 =
      shortSide >= 119 && shortSide <= 120 &&
      longSide >= 119 && longSide <= 120;

    const is120x280 =
      shortSide >= 119 && shortSide <= 120 &&
      longSide >= 279 && longSide <= 280;

    const is120x360 =
      shortSide >= 119 && shortSide <= 120 &&
      longSide >= 359 && longSide <= 360;

    if (is120x120 || is120x280 || is120x360) {
      return true;
    }
  }

  return false;
}


function calculateOrderCosts() {
  const productsTotal = Math.round(
    cart.reduce((sum, product) => {
      return sum +
        Number(product.price) * Number(product.quantity);
    }, 0) * 100
  ) / 100;

  const oversizedDelivery = cart.some(isOversizedProduct);

  const delivery = oversizedDelivery
    ? null
    : productsTotal >= DELIVERY_FREE_FROM
      ? 0
      : DELIVERY_PRICE;

  return {
    productsTotal,
    delivery,
    palletPrice: oversizedDelivery ? null : PALLET_PRICE,
    oversizedDelivery
  };
}


function renderOrderSummary() {
  const container = document.querySelector("#orderSummary");
  if (!container) return;

  const weightInfo = calculateCartWeight();
  const costs = calculateOrderCosts();

  
container.innerHTML = `
    <h3>${costs.oversizedDelivery
      ? "Podsumowanie zapytania o wycenę"
      : "Podsumowanie zamówienia"}</h3>

    ${costs.oversizedDelivery
      ? `<p class="product-logistics-note">
          To jest niezobowiązujące zapytanie o indywidualną wycenę.
          Nie stanowi złożenia zamówienia ani zobowiązania do zakupu.
          Koszt transportu i nośnika paletowego ustalimy indywidualnie.
        </p>`
      : ""}


    <div class="total">
      <span>Wartość produktów</span>
      <strong>${money(costs.productsTotal)}</strong>
    </div>

        <div class="total">
      <span>Łączna waga produktów</span>
      <strong>
        ${weightInfo.missingWeight
          ? "Niepełne dane"
          : formatNumber(weightInfo.totalWeight) + " kg"}
      </strong>
    </div>

    <p class="product-logistics-note">
      ${weightInfo.missingWeight
        ? "Nie wszystkie produkty mają podaną wagę."
        : "Waga orientacyjna na podstawie danych dostawcy."}
    </p>
    
    <div class="total">
      <span>Transport</span>
      <strong>
        ${costs.oversizedDelivery
          ? "Wycena indywidualna"
          : costs.delivery === 0
            ? "GRATIS"
            : money(costs.delivery)}
      </strong>
    </div>

    <div class="total">
      <span>Nośnik paletowy</span>
      <strong>
        ${costs.oversizedDelivery
          ? "Wycena indywidualna"
          : "49,20 zł / paleta"}
      </strong>
    </div>

    ${costs.oversizedDelivery
      ? `<p class="product-logistics-note">
          Zamówienie zawiera płytki wielkoformatowe.
          Koszt transportu i nośnika paletowego zostanie
          ustalony indywidualnie przed potwierdzeniem zamówienia.
        </p>`
      : ""}


    <p>
      Liczba palet i ostateczna kwota zamówienia
      zostaną potwierdzone przed przyjęciem zamówienia.
    </p>
  `;
}

 // ================================
 // FORMULARZ ZAMÓWIENIA
 // ================================

function openCheckout() {
  if (!cart.length) {
    alert("Najpierw dodaj produkt do koszyka.");
    return;
  }

  const modal = document.querySelector("#checkoutModal");
  const form = document.querySelector("#checkoutForm");

  if (!modal || !form) {
    alert("Formularz zamówienia nie jest jeszcze dostępny.");
    return;
  }

  document.querySelector("#cartPanel")?.classList.remove("open");
  document.querySelector("#shade")?.classList.remove("open");

  
  const isInquiry = cart.some(isOversizedProduct);

  const title = document.querySelector("#checkoutTitle");
  const submitButton = form.querySelector('button[type="submit"]');

  if (title) {
    title.textContent = isInquiry
      ? "Zapytanie o indywidualną wycenę"
      : "Dane do zamówienia";
  }

  if (submitButton) {
    submitButton.textContent = isInquiry
      ? "Wyślij zapytanie o wycenę →"
      : "Przejdź do podsumowania →";
  }

  modal.classList.add("open");
  renderOrderSummary();
  document.querySelector("#customerName")?.focus();

}


function closeCheckout() {
  document.querySelector("#checkoutModal")
    ?.classList.remove("open");
}


document.querySelector("#checkoutForm")
  ?.addEventListener("submit", async event => {
    event.preventDefault();

    const form = event.currentTarget;
    if (!form.reportValidity()) return;

    if (!cart.length) {
      alert("Koszyk jest pusty.");
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    if (button.disabled) return;

    const originalText = button.textContent;
    const isInquiry = cart.some(isOversizedProduct);
    const costs = calculateOrderCosts();

    const productsText = cart.map(product => {
      return [
        `Produkt: ${product.name}`,
        `Producent: ${product.brand || "-"}`,
        `SKU: ${product.sku || "-"}`,
        `Ilość: ${formatNumber(product.quantity)} ${product.unit || ""}`,
        `Cena jednostkowa: ${money(product.price)}`,
        `Wartość: ${money(Number(product.price) * Number(product.quantity))}`
      ].join("\n");
    }).join("\n\n");

    const data = new FormData(form);

    data.set("rodzaj_zgloszenia", isInquiry
      ? "Niewiążące zapytanie o indywidualną wycenę"
      : "Zgłoszenie zamówienia do potwierdzenia"
    );

    data.set("produkty", productsText);
    data.set("wartosc_produktow", money(costs.productsTotal));

    data.set("transport", costs.oversizedDelivery
      ? "Wycena indywidualna"
      : costs.delivery === 0
        ? "GRATIS"
        : money(costs.delivery)
    );

    data.set("nosnik_paletowy", costs.oversizedDelivery
      ? "Wycena indywidualna"
      : "49,20 zł brutto za paletę; liczba palet do potwierdzenia"
    );

    data.set("_subject", isInquiry
      ? "Nowe zapytanie o wycenę - PŁYTKI NET BUD"
      : "Nowe zgłoszenie zamówienia - PŁYTKI NET BUD"
    );

    data.set("email", data.get("customerEmail"));

    button.disabled = true;
    button.textContent = "Wysyłanie...";

    try {
      const response = await fetch(
        "https://formspree.io/f/xbgdpjza",
        {
          method: "POST",
          body: data,
          headers: { Accept: "application/json" }
        }
      );

      if (!response.ok) {
        throw new Error("Nie udało się wysłać zgłoszenia.");
      }

      alert(
        "Dziękujemy! Zgłoszenie zostało wysłane. " +
        "Skontaktujemy się w celu potwierdzenia szczegółów."
      );

    } catch (error) {
      console.error("Błąd formularza:", error);

      alert(
        "Nie udało się wysłać zgłoszenia. " +
        "Spróbuj ponownie lub napisz na sklep@plytki-net-bud.pl."
      );

    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });


document.querySelector("#checkoutModal")
  ?.addEventListener("click", event => {
    if (event.target.id === "checkoutModal") {
      closeCheckout();
    }
  });

updateCompanyFields();

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
  const piecesPerBox = Number(product.piecesPerBox);
const weightPerUnit = Number(product.weight);

const hasBox = Number.isFinite(box) && box > 0;
const hasWeight =
  product.weight != null &&
  Number.isFinite(weightPerUnit) &&
  weightPerUnit > 0;

const boxWeight = hasBox && hasWeight
  ? box * weightPerUnit
  : null;

const logisticsRows = [
  hasBox && isArea
    ? `<tr><td>Powierzchnia opakowania</td><td>${formatNumber(box)} ${escapeHtml(product.unit)}</td></tr>`
    : "",
  Number.isFinite(piecesPerBox) && piecesPerBox > 0
    ? `<tr><td>Liczba sztuk w opakowaniu</td><td>${piecesPerBox}</td></tr>`
    : "",
  hasWeight
    ? `<tr><td>Waga jednostkowa</td><td>${formatNumber(weightPerUnit)} kg / ${escapeHtml(product.unit)}</td></tr>`
    : "",
  isArea && boxWeight != null
    ? `<tr><td>Waga opakowania (orientacyjna)</td><td>${formatNumber(boxWeight)} kg</td></tr>`
    : ""
].filter(Boolean).join("");

const logisticsTable = logisticsRows
  ? `
    <div class="product-logistics">
  <div class="product-logistics-title">
    Informacje o opakowaniu i wadze
  </div>
  <table>
    <tbody>${logisticsRows}</tbody>
  </table>
  <p class="product-logistics-note">
    Waga opakowania obliczona na podstawie danych dostawcy.
  </p>
</div>
  `
  : "";

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
        
${isOversizedProduct(product)
  ? `
    <p class="product-logistics-note">
      🚚 <strong>Transport wielkoformatowy</strong><br>
      Koszty transportu oraz nośnika paletowego
      ustalane są indywidualnie.
      Ostateczną wycenę przedstawimy
      przed potwierdzeniem zamówienia.
    </p>
  `
  : ""}

        ${logisticsTable}


        ${canOrder
          ? `<button class="primary" type="button"
                     id="detailAddButton">
               Dodaj do koszyka
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
  
  document.querySelector("#detailAddButton")
    ?.addEventListener("click", () => {
      let quantity;

      if (isArea) {
        const area = Number(document.querySelector("#detailArea")?.value);
        const waste = Number(document.querySelector("#detailWaste")?.value);

        if (!Number.isFinite(area) || area <= 0) {
          alert("Podaj prawidłową powierzchnię.");
          return;
        }

        const boxes = Math.ceil(
          (area * (1 + waste / 100)) / box - 1e-9
        );

        quantity = boxes * box;
      } else {
        quantity = Number(document.querySelector("#detailPieces")?.value);

        if (!Number.isInteger(quantity) || quantity < 1) {
          alert("Podaj prawidłową liczbę sztuk.");
          return;
        }
      }

      add(product.id, quantity);
    });

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
  const photos = [
    ...document.querySelectorAll(".detail-thumbnail img")
  ].map(img => img.src);

  const gallery = [...new Set([...photos, src])];
  let currentIndex = gallery.indexOf(src);
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
    if (event.key === "Escape") {
      close();
      return;
    }

    if (gallery.length < 2) return;

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();

      const direction = event.key === "ArrowRight" ? 1 : -1;

      currentIndex =
        (currentIndex + direction + gallery.length) % gallery.length;

      image.src = gallery[currentIndex];
    }
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
  
  if (gallery.length > 1) {
    const createArrow = (symbol, direction, position) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = symbol;
      button.setAttribute(
        "aria-label",
        direction === -1 ? "Poprzednie zdjęcie" : "Następne zdjęcie"
      );

      button.style.cssText = `
        position: absolute;
        ${position}: 12px;
        top: 50%;
        transform: translateY(-50%);
        width: 48px;
        height: 56px;
        border: none;
        border-radius: 8px;
        background: rgba(0,0,0,0.55);
        color: white;
        font-size: 38px;
        cursor: pointer;
        z-index: 2;
      `;

      button.addEventListener("click", event => {
        event.stopPropagation();
        currentIndex =
          (currentIndex + direction + gallery.length) % gallery.length;
        image.src = gallery[currentIndex];
      });

      overlay.appendChild(button);
    };

    createArrow("‹", -1, "left");
    createArrow("›", 1, "right");
  }

  let touchStartX = 0;

  image.addEventListener("touchstart", event => {
    touchStartX = event.changedTouches[0].screenX;
  }, { passive: true });

  image.addEventListener("touchend", event => {
    if (gallery.length < 2) return;

    const touchEndX = event.changedTouches[0].screenX;
    const difference = touchStartX - touchEndX;

    if (Math.abs(difference) < 50) return;

    const direction = difference > 0 ? 1 : -1;

    currentIndex =
      (currentIndex + direction + gallery.length) % gallery.length;

    image.src = gallery[currentIndex];
  }, { passive: true });

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
  searchProducts("", false);
}

calculate();
updateCart();

/* GALERIA ARANŻACJI NA STRONIE GŁÓWNEJ */


const heroImages = [
  "/images/Luksusowa kuchnia z zielonym marmurem i ogrodem.png",
  "/images/Luksusowa łazienka w stylu spa.png",
  "/images/Luksusowe wnętrze salonu i jadalni.png",
  "/images/Luksusowe wnętrze z zielonymi akcentami.png",
  "/images/Luksusowy salon z marmurowym kominkiem.png",
  "/images/aa.jpg",
  "/images/image.jpg",
  "/images/k.jpg",
  "/images/l.jpg",
  "/images/q.jpg",
  "/images/w.jpg"
];


let heroSlideIndex = 0;
let heroSlideTimer;

function showHeroSlide(index) {
  const slides = document.querySelectorAll(".hero-gallery-slide");
  const dots = document.querySelectorAll(".hero-gallery-dot");

  if (!slides.length) return;

  heroSlideIndex = (index + slides.length) % slides.length;

  slides.forEach((slide, i) => {
    slide.classList.toggle("active", i === heroSlideIndex);
  });

  dots.forEach((dot, i) => {
    dot.classList.toggle("active", i === heroSlideIndex);
  });
}

function changeHeroSlide(direction) {
  showHeroSlide(heroSlideIndex + direction);
  startHeroSlideshow();
}

function startHeroSlideshow() {
  clearInterval(heroSlideTimer);

  heroSlideTimer = setInterval(() => {
    showHeroSlide(heroSlideIndex + 1);
  }, 5000);
}

function initHeroGallery() {
  const slidesContainer = document.querySelector("#heroGallerySlides");
  const dotsContainer = document.querySelector("#heroGalleryDots");

  if (!slidesContainer || !dotsContainer) return;

  slidesContainer.innerHTML = heroImages.map((src, i) => `
    <div class="hero-gallery-slide ${i === 0 ? "active" : ""}">
      <img src="${src}" alt="Inspiracja wnętrza ${i + 1}"
           loading="${i === 0 ? "eager" : "lazy"}">
    </div>
  `).join("");

  dotsContainer.innerHTML = heroImages.map((_, i) => `
    <button class="hero-gallery-dot ${i === 0 ? "active" : ""}"
            type="button"
            onclick="showHeroSlide(${i}); startHeroSlideshow();"
            aria-label="Pokaż aranżację ${i + 1}">
    </button>
  `).join("");

  startHeroSlideshow();
}

initHeroGallery();


async function updateCatalogCount() {
  const element = document.querySelector("#catalogCount");
  if (!element) return;

  try {
    const response = await fetch("/catalog-count.json");
    if (!response.ok) throw new Error("Brak licznika");

    const data = await response.json();

    if (!Number.isInteger(data.count) || data.count < 0) {
      throw new Error("Nieprawidłowa liczba produktów");
    }

    element.textContent =
      "W naszej ofercie: " +
      data.count.toLocaleString("pl-PL") +
      " produktów";
  } catch (error) {
    element.textContent = "";
  }
}

updateCatalogCount();
