export async function onRequestGet(context) {
  try {
    const apiKey = context.env.SATURN_API_KEY;
    const clientId = "101670";

    if (!apiKey) {
      return json({ ok: false, error: "Brak konfiguracji API." }, 500);
    }

    // --- LOGOWANIE DO SATURNA ---

    const timestamp = getSaturnTimestamp();
    const apiKeyUpper = apiKey.trim().toUpperCase();
    const hash = md5(apiKeyUpper + timestamp + clientId);

    const tokenResponse = await fetch(
      "https://phsaturn.pl/api3/token",
      {
        method: "POST",
        headers: {
          "Accept": "application/json",
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
      return json({
        ok: false,
        error: "Nie udało się połączyć z bazą produktów."
      }, 502);
    }

    const tokenData = await tokenResponse.json();

    const accessToken =
      tokenData.AccessToken ||
      tokenData.accessToken;

    if (!accessToken) {
      return json({
        ok: false,
        error: "Brak tokenu API."
      }, 502);
    }

    // --- PARAMETRY WYSZUKIWANIA ---

    const requestUrl = new URL(context.request.url);

    const q = (
      requestUrl.searchParams.get("q") || ""
    ).trim();
    const brand = (
  requestUrl.searchParams.get("brand") || ""
).trim();

    const ean = (
      requestUrl.searchParams.get("ean") || ""
    ).trim();

    const sku = (
      requestUrl.searchParams.get("sku") || ""
    ).trim();
const featured =
  requestUrl.searchParams.get("featured") === "1";
    const catalogTest =
  requestUrl.searchParams.get("catalogTest") === "1";
    
const brandTest =
  requestUrl.searchParams.get("brandTest") === "1";

    const pageNumber = Math.max(
  1,
  parseInt(requestUrl.searchParams.get("pageNumber") || "1", 10) || 1
);
    
if (!q && !brand && !ean && !sku && !featured && !catalogTest && !brandTest) {

      return json({
        ok: true,
        source: "Saturn",
        count: 0,
        products: [],
        message: "Wpisz nazwę, EAN lub SKU produktu."
      });
    }

    // Do przeglądarki pobieramy tylko dane,
    // które mogą być publiczne.
    const fields = [
      "Id",
      "Name",
      "Ean",
      "Sku",
      "Brand",
      "Unit",
      "Weight",
      "Vat",
      "Qty",
      "InStock",
      "Attributes",
      "PriceAfterDiscountNet",
      "RetailPriceNet",
      "Photo",
      "Photos",
      "RequiredBox",
      "QuantityPerBox"
    ].join(",");

    const saturnUrl = new URL(
      "https://phsaturn.pl/api3/product/findProduct"
    );

    saturnUrl.searchParams.set("field", fields);
    
if (brandTest) {
  saturnUrl.searchParams.set("optionsId", "823811401697764900");
}

saturnUrl.searchParams.set("pageNumber", String(pageNumber));
saturnUrl.searchParams.set("pageSize", "25");
if (ean) {
  saturnUrl.searchParams.set("productsEan", ean);
} else if (sku) {
  saturnUrl.searchParams.set("productsSku", sku);
} else if (brand) {
  saturnUrl.searchParams.set("where", brand);
} else if (q) {
  saturnUrl.searchParams.set("where", q);
} else if (featured) {
  const featuredTerms = [
    "calacatta",
    "wood",
    "marble",
    "stone",
    "beige",
    "grey",
    "white",
    "oak"
  ];

  const randomTerm = featuredTerms[
    Math.floor(Math.random() * featuredTerms.length)
  ];

  saturnUrl.searchParams.set("where", randomTerm);
}

    const productResponse = await fetch(
      saturnUrl.toString(),
      {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization": "Bearer " + accessToken
        }
      }
    );

    if (!productResponse.ok) {
      return json({
        ok: false,
        error: "Nie udało się pobrać produktów."
      }, 502);
    }

    const productData = await productResponse.json();

    const rawProducts = Array.isArray(productData.Items)
      ? productData.Items
      : [];

    // --- BEZPIECZNA ODPOWIEDŹ DLA SKLEPU ---
const shuffledProducts = featured
  ? [...rawProducts].sort(() => Math.random() - 0.5)
  : rawProducts;
    const products = shuffledProducts
        .filter(product =>
    !brand ||
    getProductBrand(product).trim().toLowerCase() === brand.toLowerCase()
  )
  .filter(product => !isWithdrawnProduct(product))
  .filter(product => isGradeOneProduct(product))
      .filter(product => hasValidSellingPrice(product))
  .slice(0, featured ? 12 : 50)
      .map(product => ({
        id: product.Id ?? null,

        name: product.Name ?? "",

        ean: product.Ean ?? "",

        sku: product.Sku ?? "",

        brand: getProductBrand(product),

        unit: product.Unit ?? "",

        weight: product.Weight ?? null,

        vat: product.Vat ?? null,

        quantity: product.Qty ?? 0,

        inStock: Boolean(product.InStock),

        requiredBox: Boolean(product.RequiredBox),

quantityPerBox:
  product.QuantityPerBox ?? null,

piecesPerBox: Array.isArray(product.Attributes)
  ? Number(
      product.Attributes
        .find(attribute =>
          attribute.Name === "Ilość sztuk w kartonie"
        )
        ?.Features?.[0]?.Name
    ) || null
  : null,

price: calculateSellingPrice(product),

        currency: "PLN",

        photo: normalizePhoto(product.Photo),

        photos: Array.isArray(product.Photos)
          ? product.Photos
              .map(normalizePhoto)
              .filter(Boolean)
          : []
      }));
    function getProductBrand(product) {
  if (product.Brand) {
    return product.Brand;
  }

  if (!Array.isArray(product.Attributes)) {
    return "";
  }

  const brandAttribute = product.Attributes.find(
    attribute => attribute.Name === "Marka"
  );

  if (!brandAttribute || !Array.isArray(brandAttribute.Features)) {
    return "";
  }

  return brandAttribute.Features[0]?.Name ?? "";
}
    function isWithdrawnProduct(product) {
  if (!Array.isArray(product.Attributes)) {
    return false;
  }

  const statusAttribute = product.Attributes.find(
    attribute => attribute.Name === "Status"
  );

  if (!statusAttribute || !Array.isArray(statusAttribute.Features)) {
    return false;
  }

  return statusAttribute.Features.some(
    feature =>
      typeof feature.Name === "string" &&
      feature.Name.toLowerCase().includes("wycof")
  );
}
function isGradeOneProduct(product) {
  if (!Array.isArray(product.Attributes)) {
    return false;
  }

  const gradeAttribute = product.Attributes.find(
    attribute => attribute.Name === "Gatunek"
  );

  if (!gradeAttribute || !Array.isArray(gradeAttribute.Features)) {
    return false;
  }

  return gradeAttribute.Features.some(
    feature => String(feature.Name).trim() === "1"
  );
}
    function hasValidSellingPrice(product) {
  const isInserto = Array.isArray(product.Attributes) &&
    product.Attributes.some(attribute =>
      attribute.Name === "Element Kolekcji" &&
      Array.isArray(attribute.Features) &&
      attribute.Features.some(feature => feature.Name === "Inserto")
    );

  if (isInserto) {
    const retailPrice = getMoneyValue(product.RetailPriceNet);
    return retailPrice != null && retailPrice > 0;
  }

  const purchaseNet = getMoneyValue(product.PriceAfterDiscountNet);
  return purchaseNet != null && purchaseNet > 0;
}
function calculateSellingPrice(product) {
  const isInserto = Array.isArray(product.Attributes) &&
    product.Attributes.some(attribute =>
      attribute.Name === "Element Kolekcji" &&
      Array.isArray(attribute.Features) &&
      attribute.Features.some(feature => feature.Name === "Inserto")
    );

  if (isInserto) {
    return getMoneyValue(product.RetailPriceNet);
  }

  const purchaseNet = getMoneyValue(product.PriceAfterDiscountNet);

  if (purchaseNet == null) {
    return null;
  }

  const sellingNet = purchaseNet + 7;
  const sellingGross = sellingNet * 1.23;

  return Math.round(sellingGross * 100) / 100;
}

    // TYMCZASOWA DIAGNOSTYKA LOGISTYKI
if (requestUrl.searchParams.get("logisticsTest") === "1") {
  const testProduct = rawProducts.find(
    product => Number(product.Id) === 100453
  );

  if (!testProduct) {
    return json({
      ok: false,
      message: "Nie znaleziono produktu 100453 w odpowiedzi Saturna."
    }, 404);
  }

  return json({
    ok: true,
    productId: testProduct.Id,
    unit: testProduct.Unit,
    weight: testProduct.Weight,
    quantityPerBox: testProduct.QuantityPerBox,
    logisticsAttributes: (testProduct.Attributes || [])
      .filter(attribute =>
        /palet|karton|opak|waga|logist|transport/i.test(
          String(attribute.Name || "")
        )
      )
      .map(attribute => ({
        name: attribute.Name,
        values: Array.isArray(attribute.Features)
          ? attribute.Features.map(feature => feature.Name)
          : []
      }))
  });
}
    return json({
  ok: true,
  source: "Saturn",
  count: products.length,
  totalFound: productData.Count ?? products.length,
      pageNumber,
saturnPageNumber: productData.PageNumber ?? null,
saturnPageSize: productData.PageSize ?? null,
hasMore: productData.HasMore ?? null,
  diagnostic: {
    receivedFromSaturn: rawProducts.length,
    responseKeys: Object.keys(productData),
    firstProductId: rawProducts[0]?.Id ?? null,
    lastProductId: rawProducts.at(-1)?.Id ?? null
  },
  products
});

  } catch (error) {
    return json({
      ok: false,
      error: "Błąd połączenia z bazą produktów."
    }, 500);
  }
}


// ---------- SATURN ----------

function getSaturnTimestamp() {
  const d = new Date();

  const year = d.getUTCFullYear();
  const month =
    String(d.getUTCMonth() + 1).padStart(2, "0");
  const day =
    String(d.getUTCDate()).padStart(2, "0");
  const hour =
    String(d.getUTCHours()).padStart(2, "0");
  const minute =
    String(d.getUTCMinutes()).padStart(2, "0");
  const second =
    String(d.getUTCSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function normalizePhoto(photo) {
  if (!photo || typeof photo !== "string") {
    return null;
  }

  const cleanPhoto = photo.split("?")[0];

  if (
    cleanPhoto.startsWith("http://") ||
    cleanPhoto.startsWith("https://")
  ) {
    return cleanPhoto;
  }

  if (cleanPhoto.startsWith("/")) {
    return "https://phsaturn.pl" + cleanPhoto;
  }

  return "https://phsaturn.pl/" + cleanPhoto;
}
function getMoneyValue(value) {
  if (value == null) return null;

  if (typeof value === "number") {
    return value;
  }

  if (
    typeof value === "object" &&
    typeof value.Value === "number"
  ) {
    return value.Value;
  }

  return null;
}


// ---------- MD5 ----------

function md5(input) {
  function add32(a, b) {
    return (a + b) & 0xffffffff;
  }

  function cmn(q, a, b, x, s, t) {
    a = add32(add32(a, q), add32(x, t));

    return add32(
      (a << s) | (a >>> (32 - s)),
      b
    );
  }

  function ff(a,b,c,d,x,s,t) {
    return cmn(
      (b & c) | ((~b) & d),
      a,b,x,s,t
    );
  }

  function gg(a,b,c,d,x,s,t) {
    return cmn(
      (b & d) | (c & (~d)),
      a,b,x,s,t
    );
  }

  function hh(a,b,c,d,x,s,t) {
    return cmn(
      b ^ c ^ d,
      a,b,x,s,t
    );
  }

  function ii(a,b,c,d,x,s,t) {
    return cmn(
      c ^ (b | (~d)),
      a,b,x,s,t
    );
  }

  function md5cycle(x, k) {
    let a=x[0], b=x[1], c=x[2], d=x[3];

    const oa=a, ob=b, oc=c, od=d;

    a=ff(a,b,c,d,k[0],7,-680876936);
    d=ff(d,a,b,c,k[1],12,-389564586);
    c=ff(c,d,a,b,k[2],17,606105819);
    b=ff(b,c,d,a,k[3],22,-1044525330);
    a=ff(a,b,c,d,k[4],7,-176418897);
    d=ff(d,a,b,c,k[5],12,1200080426);
    c=ff(c,d,a,b,k[6],17,-1473231341);
    b=ff(b,c,d,a,k[7],22,-45705983);
    a=ff(a,b,c,d,k[8],7,1770035416);
    d=ff(d,a,b,c,k[9],12,-1958414417);
    c=ff(c,d,a,b,k[10],17,-42063);
    b=ff(b,c,d,a,k[11],22,-1990404162);
    a=ff(a,b,c,d,k[12],7,1804603682);
    d=ff(d,a,b,c,k[13],12,-40341101);
    c=ff(c,d,a,b,k[14],17,-1502002290);
    b=ff(b,c,d,a,k[15],22,1236535329);

    a=gg(a,b,c,d,k[1],5,-165796510);
    d=gg(d,a,b,c,k[6],9,-1069501632);
    c=gg(c,d,a,b,k[11],14,643717713);
    b=gg(b,c,d,a,k[0],20,-373897302);
    a=gg(a,b,c,d,k[5],5,-701558691);
    d=gg(d,a,b,c,k[10],9,38016083);
    c=gg(c,d,a,b,k[15],14,-660478335);
    b=gg(b,c,d,a,k[4],20,-405537848);
    a=gg(a,b,c,d,k[9],5,568446438);
    d=gg(d,a,b,c,k[14],9,-1019803690);
    c=gg(c,d,a,b,k[3],14,-187363961);
    b=gg(b,c,d,a,k[8],20,1163531501);
    a=gg(a,b,c,d,k[13],5,-1444681467);
    d=gg(d,a,b,c,k[2],9,-51403784);
    c=gg(c,d,a,b,k[7],14,1735328473);
    b=gg(b,c,d,a,k[12],20,-1926607734);

    a=hh(a,b,c,d,k[5],4,-378558);
    d=hh(d,a,b,c,k[8],11,-2022574463);
    c=hh(c,d,a,b,k[11],16,1839030562);
    b=hh(b,c,d,a,k[14],23,-35309556);
    a=hh(a,b,c,d,k[1],4,-1530992060);
    d=hh(d,a,b,c,k[4],11,1272893353);
    c=hh(c,d,a,b,k[7],16,-155497632);
    b=hh(b,c,d,a,k[10],23,-1094730640);
    a=hh(a,b,c,d,k[13],4,681279174);
    d=hh(d,a,b,c,k[0],11,-358537222);
    c=hh(c,d,a,b,k[3],16,-722521979);
    b=hh(b,c,d,a,k[6],23,76029189);
    a=hh(a,b,c,d,k[9],4,-640364487);
    d=hh(d,a,b,c,k[12],11,-421815835);
    c=hh(c,d,a,b,k[15],16,530742520);
    b=hh(b,c,d,a,k[2],23,-995338651);

    a=ii(a,b,c,d,k[0],6,-198630844);
    d=ii(d,a,b,c,k[7],10,1126891415);
    c=ii(c,d,a,b,k[14],15,-1416354905);
    b=ii(b,c,d,a,k[5],21,-57434055);
    a=ii(a,b,c,d,k[12],6,1700485571);
    d=ii(d,a,b,c,k[3],10,-1894986606);
    c=ii(c,d,a,b,k[10],15,-1051523);
    b=ii(b,c,d,a,k[1],21,-2054922799);
    a=ii(a,b,c,d,k[8],6,1873313359);
    d=ii(d,a,b,c,k[15],10,-30611744);
    c=ii(c,d,a,b,k[6],15,-1560198380);
    b=ii(b,c,d,a,k[13],21,1309151649);
    a=ii(a,b,c,d,k[4],6,-145523070);
    d=ii(d,a,b,c,k[11],10,-1120210379);
    c=ii(c,d,a,b,k[2],15,718787259);
    b=ii(b,c,d,a,k[9],21,-343485551);

    x[0]=add32(a,oa);
    x[1]=add32(b,ob);
    x[2]=add32(c,oc);
    x[3]=add32(d,od);
  }

  function md5blk(s) {
    const blocks=[];

    for(let i=0;i<64;i+=4) {
      blocks[i>>2] =
        s.charCodeAt(i) +
        (s.charCodeAt(i+1)<<8) +
        (s.charCodeAt(i+2)<<16) +
        (s.charCodeAt(i+3)<<24);
    }

    return blocks;
  }

  function md51(s) {
    const n=s.length;

    const state=[
      1732584193,
      -271733879,
      -1732584194,
      271733878
    ];

    let i;

    for(i=64;i<=n;i+=64) {
      md5cycle(
        state,
        md5blk(s.substring(i-64,i))
      );
    }

    s=s.substring(i-64);

    const tail=new Array(16).fill(0);

    for(i=0;i<s.length;i++) {
      tail[i>>2] |=
        s.charCodeAt(i) <<
        ((i%4)<<3);
    }

    tail[i>>2] |=
      0x80 << ((i%4)<<3);

    if(i>55) {
      md5cycle(state,tail);
      tail.fill(0);
    }

    tail[14]=n*8;

    md5cycle(state,tail);

    return state;
  }

  function hex(x) {
    const chars="0123456789abcdef";
    let out="";

    for(let i=0;i<x.length;i++) {
      for(let j=0;j<4;j++) {
        const byte=
          (x[i]>>(j*8))&0xff;

        out +=
          chars[(byte>>4)&15] +
          chars[byte&15];
      }
    }

    return out;
  }

  return hex(md51(input));
}


// ---------- RESPONSE ----------

function json(data, status = 200) {
  return new Response(
    JSON.stringify(data, null, 2),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",

        "Cache-Control":
          "public, max-age=60"
      }
    }
  );
}

export { getSaturnTimestamp, md5 };
