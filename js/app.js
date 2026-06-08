const cfg = window.VAPE_SHOP_CONFIG;
const supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

const placeholderImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='800' viewBox='0 0 800 800'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='%231f7cff'/%3E%3Cstop offset='1' stop-color='%2300c2ff'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='800' height='800' fill='%23070b14'/%3E%3Crect x='170' y='110' width='460' height='580' rx='34' fill='url(%23g)' opacity='.24'/%3E%3Cpath d='M290 190h220v420H290z' fill='%23f5f8ff' opacity='.12'/%3E%3Ctext x='400' y='430' fill='%23dbeafe' font-family='Arial' font-size='42' font-weight='700' text-anchor='middle'%3EProduct%3C/text%3E%3C/svg%3E";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function peso(value) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value || 0));
}

function statusFromStock(stock) {
  const qty = Number(stock || 0);
  if (qty > 10) return "In Stock";
  if (qty > 0) return "Low Stock";
  return "Out of Stock";
}

function statusBadge(status) {
  const safe = escapeHtml(status || "Out of Stock");
  const cls = safe === "In Stock" ? "in" : safe === "Low Stock" ? "low" : "out";
  return `<span class="badge ${cls}">${safe}</span>`;
}

function productImage(product) {
  return product?.image_url || product?.gallery_urls?.[0] || placeholderImage;
}

function productUrl(product) {
  return `/products/${encodeURIComponent(product.slug)}`;
}

function toast(message) {
  let root = document.querySelector(".toast");
  if (!root) {
    root = document.createElement("div");
    root.className = "toast";
    document.body.appendChild(root);
  }
  const item = document.createElement("div");
  item.textContent = message;
  root.appendChild(item);
  setTimeout(() => item.remove(), 3200);
}

function getFavorites() {
  return JSON.parse(localStorage.getItem("favorites") || "[]");
}

function toggleFavorite(id) {
  const favorites = new Set(getFavorites());
  favorites.has(id) ? favorites.delete(id) : favorites.add(id);
  localStorage.setItem("favorites", JSON.stringify([...favorites]));
  return favorites.has(id);
}

function addRecentlyViewed(product) {
  const item = { id: product.id, name: product.name, slug: product.slug, image_url: productImage(product), brand: product.brand };
  const current = JSON.parse(localStorage.getItem("recentlyViewed") || "[]").filter((entry) => entry.id !== item.id);
  localStorage.setItem("recentlyViewed", JSON.stringify([item, ...current].slice(0, 8)));
}

function addCompare(product) {
  const item = { id: product.id, name: product.name, slug: product.slug, brand: product.brand, price: product.price, status: product.status };
  const current = JSON.parse(localStorage.getItem("compareProducts") || "[]").filter((entry) => entry.id !== item.id);
  localStorage.setItem("compareProducts", JSON.stringify([item, ...current].slice(0, 4)));
  toast("Added to comparison");
}

function productCard(product) {
  const favorites = getFavorites();
  const category = product.categories?.name || "Uncategorized";
  return `
    <article class="product-card">
      <button class="icon-btn favorite" title="Save favorite" data-favorite="${product.id}">${favorites.includes(product.id) ? "★" : "☆"}</button>
      <a href="${productUrl(product)}">
        <img class="product-img" loading="lazy" src="${escapeHtml(productImage(product))}" alt="${escapeHtml(product.name)}">
        <div class="product-body">
          ${statusBadge(product.status)}
          <h3>${escapeHtml(product.name)}</h3>
          <div class="meta">${escapeHtml(product.brand)} · ${escapeHtml(product.flavor || "Assorted")}<br>${escapeHtml(category)}</div>
          <div class="price">${peso(product.price)}</div>
        </div>
      </a>
      <div class="product-body" style="padding-top:0">
        <button class="btn ghost" data-compare="${product.id}">Compare</button>
      </div>
    </article>
  `;
}

function wireProductActions(products) {
  document.querySelectorAll("[data-favorite]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const active = toggleFavorite(button.dataset.favorite);
      button.textContent = active ? "★" : "☆";
    });
  });
  document.querySelectorAll("[data-compare]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const product = products.find((item) => item.id === button.dataset.compare);
      if (product) addCompare(product);
    });
  });
}

function applyStoreChrome() {
  document.querySelectorAll("[data-store-name]").forEach((el) => (el.textContent = cfg.STORE.name));
  document.querySelectorAll("[data-store-tagline]").forEach((el) => (el.textContent = cfg.STORE.tagline));
  document.querySelectorAll("[data-store-phone]").forEach((el) => (el.textContent = cfg.STORE.phone));
  document.querySelectorAll("[data-store-email]").forEach((el) => (el.textContent = cfg.STORE.email));
  document.querySelectorAll("[data-store-address]").forEach((el) => (el.textContent = cfg.STORE.address));
  document.querySelectorAll("[data-facebook]").forEach((el) => (el.href = cfg.STORE.facebookUrl));
  document.querySelectorAll("[data-messenger]").forEach((el) => (el.href = cfg.STORE.messengerUrl));
  const banner = document.querySelector("[data-announcement]");
  if (banner) banner.textContent = cfg.STORE.announcement;
  const hours = document.querySelector("[data-store-hours]");
  if (hours) hours.innerHTML = cfg.STORE.hours.map((line) => `<div>${escapeHtml(line)}</div>`).join("");
  const map = document.querySelector("[data-map]");
  if (map) map.src = cfg.STORE.mapEmbedUrl;
}

function setupThemeToggle() {
  const saved = localStorage.getItem("theme") || "dark";
  document.body.classList.toggle("light", saved === "light");
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const light = !document.body.classList.contains("light");
      document.body.classList.toggle("light", light);
      localStorage.setItem("theme", light ? "light" : "dark");
    });
  });
}

async function fetchCategories(includeHidden = false) {
  let query = supabase.from("categories").select("*").order("name");
  if (!includeHidden) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function fetchProducts(options = {}) {
  const page = options.page || 1;
  const limit = options.limit || 12;
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  let query = supabase
    .from("products")
    .select("*, categories(name)", { count: "exact" })
    .eq("hidden", false)
    .eq("archived", false)
    .range(from, to);

  if (options.featured) query = query.eq("featured", true);
  if (options.category) query = query.eq("category_id", options.category);
  if (options.brand) query = query.ilike("brand", `%${options.brand}%`);
  if (options.search) query = query.or(`name.ilike.%${options.search}%,brand.ilike.%${options.search}%,flavor.ilike.%${options.search}%`);
  if (options.maxPrice) query = query.lte("price", Number(options.maxPrice));

  const sort = options.sort || "newest";
  if (sort === "price-asc") query = query.order("price", { ascending: true });
  else if (sort === "price-desc") query = query.order("price", { ascending: false });
  else if (sort === "popular") query = query.order("popularity", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

document.addEventListener("DOMContentLoaded", () => {
  applyStoreChrome();
  setupThemeToggle();
});
