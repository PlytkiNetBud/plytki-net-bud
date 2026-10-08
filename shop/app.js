let products = [];
let cart = [];
let category = "Wszystkie";

const searchInput = document.querySelector("#search");
const urlParams = new URLSearchParams(window.location.search);
const selectedBrand = urlParams.get("brand");

// ================================
// POBIERANIE PRODUKTÓW Z SATURNA
// ================================

async function searchProducts(query) {
  const q = String(query || "").trim();

  if (!q) {
    products = [];
    render();
    return;
  }

  showLoading();

  try {
    const apiUrl = selectedBrand
  ? "/api/products?brand=" + encodeURIComponent(selectedBrand)
  : "/api/products?q=" + encodeURIComponent(q);

const response = await fetch(apiUrl);

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error || "Nie udało się pobrać produktów."
      );
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
      )
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


// ================================
// WYSZUKIWARKA
// ================================

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
        <strong>Wyszukaj produkt</strong>
        <br>
        Wpisz u góry nazwę, producenta,
        EAN lub symbol produktu.
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

function details(id) {
  const product = products.find(
    p => Number(p.id) === Number(id)
  );

  if (!product) return;

  const modal = document.querySelector("#productModal");
  const content = document.querySelector("#productDetails");

  if (!modal || !content) return;

  content.innerHTML = `
    <div class="detail-layout">
      <div class="detail-image">
        ${product.img
          ? `<img src="${escapeHtml(product.img)}" alt="${escapeHtml(product.name)}">`
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
          product.box
            ? formatNumber(product.box) + " " + escapeHtml(product.unit)
            : "Brak danych"
        }</p>

        <p>${product.inStock
          ? "Produkt dostępny"
          : "Sprawdź dostępność"
        }</p>

        <button class="primary" onclick="add(${Number(product.id)})">
          Dodaj do zapytania
        </button>
      </div>
    </div>
  `;

  modal.classList.add("open");
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
}
render();
calculate();
updateCart();
