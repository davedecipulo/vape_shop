async function initProduct() {
  const slug = new URL(location.href).searchParams.get("slug") || location.pathname.split("/").filter(Boolean).pop();
  const root = document.getElementById("productDetail");
  if (!supabase) {
    root.innerHTML = `<div class="admin-card">${escapeHtml(setupMessage)}</div>`;
    return;
  }
  if (!slug || slug === "product.html") {
    root.innerHTML = `<div class="admin-card">Product not found.</div>`;
    return;
  }
  const { data: product, error } = await supabase
    .from("products")
    .select("*, categories(name)")
    .eq("slug", slug)
    .eq("hidden", false)
    .eq("archived", false)
    .single();
  if (error || !product) {
    root.innerHTML = `<div class="admin-card">Product not found.</div>`;
    return;
  }
  supabase.rpc("increment_product_view", { product_slug: slug });
  addRecentlyViewed(product);
  updateSeo(product);
  const images = [productImage(product), ...(product.gallery_urls || []).filter((url) => url && url !== product.image_url)];
  const specs = normalizeSpecs(product.specifications);
  root.innerHTML = `
    <div class="detail-grid">
      <div>
        <img id="mainImage" class="gallery-main" src="${escapeHtml(images[0])}" alt="${escapeHtml(product.name)}">
        <div class="thumbs">${images.map((url) => `<img src="${escapeHtml(url)}" alt="${escapeHtml(product.name)} thumbnail" loading="lazy" data-thumb>`).join("")}</div>
      </div>
      <div class="glass" style="padding:24px">
        <div class="eyebrow">${escapeHtml(product.brand)}</div>
        <h1 style="font-size:clamp(2rem,4vw,3.8rem)">${escapeHtml(product.name)}</h1>
        ${statusBadge(product.status)}
        <p class="lead">${escapeHtml(product.description || "Contact the store for more product details.")}</p>
        <div class="price">${peso(product.price)}</div>
        <p class="meta">Category: ${escapeHtml(product.categories?.name || "Uncategorized")}<br>Flavor: ${escapeHtml(product.flavor || "Assorted")}</p>
        <div class="spec-list">${specs}</div>
        <div class="hero-actions">
          <a class="btn primary" href="tel:${escapeHtml(cfg.STORE.phone)}">Contact Store</a>
          <a class="btn" data-facebook target="_blank" rel="noreferrer">Facebook Inquiry</a>
          <a class="btn" data-messenger target="_blank" rel="noreferrer">Messenger Inquiry</a>
          <button class="btn ghost" id="compareBtn">Compare</button>
        </div>
      </div>
    </div>
    <script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      brand: product.brand,
      category: product.categories?.name,
      image: images[0],
      description: product.description,
      offers: { "@type": "Offer", priceCurrency: "PHP", price: product.price, availability: product.status === "Out of Stock" ? "https://schema.org/OutOfStock" : "https://schema.org/InStock" }
    }).replaceAll("<", "\\u003c")}</script>
  `;
  applyStoreChrome();
  document.querySelectorAll("[data-thumb]").forEach((thumb) => {
    thumb.addEventListener("click", () => (document.getElementById("mainImage").src = thumb.src));
  });
  document.getElementById("compareBtn").addEventListener("click", () => addCompare(product));
  renderRecent(product.id);
}

function normalizeSpecs(specifications) {
  const specs = typeof specifications === "string" ? safeJson(specifications) : specifications || {};
  const entries = Object.entries(specs);
  if (!entries.length) return `<div><span>Specifications</span><strong class="muted">Ask store</strong></div>`;
  return entries.map(([key, value]) => `<div><span>${escapeHtml(key)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
}

function safeJson(value) {
  try { return JSON.parse(value || "{}"); } catch { return {}; }
}

function updateSeo(product) {
  document.title = `${product.name} | ${cfg.STORE.name}`;
  document.querySelector("meta[name='description']").content = product.description || `${product.name} available at ${cfg.STORE.name}.`;
  document.querySelector("meta[property='og:title']").content = product.name;
  document.querySelector("meta[property='og:description']").content = product.description || "Contact the store for inquiries.";
}

function renderRecent(currentId) {
  const recent = JSON.parse(localStorage.getItem("recentlyViewed") || "[]").filter((item) => item.id !== currentId);
  document.getElementById("recentGrid").innerHTML = recent.length
    ? recent.map((item) => `<a class="product-card" href="${productUrl(item)}"><img class="product-img" loading="lazy" src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}"><div class="product-body"><h3>${escapeHtml(item.name)}</h3><p class="meta">${escapeHtml(item.brand)}</p></div></a>`).join("")
    : `<div class="admin-card">No other recently viewed products yet.</div>`;
}

document.addEventListener("DOMContentLoaded", initProduct);
