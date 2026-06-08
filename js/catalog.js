let page = 1;
let total = 0;
const limit = 12;
let latestProducts = [];

function params() {
  const url = new URL(location.href);
  return {
    search: document.getElementById("searchInput").value.trim(),
    category: document.getElementById("categoryFilter").value || url.searchParams.get("category") || "",
    brand: document.getElementById("brandFilter").value.trim(),
    maxPrice: document.getElementById("priceFilter").value,
    sort: document.getElementById("sortFilter").value || url.searchParams.get("sort") || "newest",
    page,
    limit
  };
}

async function loadCatalog() {
  const grid = document.getElementById("productGrid");
  grid.innerHTML = `<div class="admin-card">Loading products...</div>`;
  try {
    const result = await fetchProducts(params());
    latestProducts = result.data;
    total = result.count;
    grid.innerHTML = latestProducts.length ? latestProducts.map(productCard).join("") : `<div class="admin-card">No matching products.</div>`;
    wireProductActions(latestProducts);
    renderPager();
  } catch (error) {
    grid.innerHTML = `<div class="admin-card">${escapeHtml(error.message)}</div>`;
  }
}

function renderPager() {
  const pages = Math.max(1, Math.ceil(total / limit));
  document.getElementById("pageInfo").textContent = `Page ${page} of ${pages}`;
  document.getElementById("prevPage").disabled = page <= 1;
  document.getElementById("nextPage").disabled = page >= pages;
}

function renderCompare() {
  const items = JSON.parse(localStorage.getItem("compareProducts") || "[]");
  document.getElementById("compareTable").innerHTML = items.length ? `
    <table>
      <thead><tr><th>Product</th><th>Brand</th><th>Price</th><th>Status</th></tr></thead>
      <tbody>${items.map((item) => `<tr><td><a href="${productUrl(item)}">${escapeHtml(item.name)}</a></td><td>${escapeHtml(item.brand)}</td><td>${peso(item.price)}</td><td>${escapeHtml(item.status)}</td></tr>`).join("")}</tbody>
    </table>
  ` : `<div class="admin-card">No products selected for comparison.</div>`;
}

async function initCatalog() {
  const url = new URL(location.href);
  const categories = await fetchCategories();
  document.getElementById("categoryFilter").innerHTML += categories.map((cat) => `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`).join("");
  if (url.searchParams.get("category")) document.getElementById("categoryFilter").value = url.searchParams.get("category");
  if (url.searchParams.get("sort")) document.getElementById("sortFilter").value = url.searchParams.get("sort");
  ["searchInput", "categoryFilter", "brandFilter", "priceFilter", "sortFilter"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => { page = 1; loadCatalog(); });
  });
  document.getElementById("prevPage").addEventListener("click", () => { page -= 1; loadCatalog(); });
  document.getElementById("nextPage").addEventListener("click", () => { page += 1; loadCatalog(); });
  document.getElementById("clearCompare").addEventListener("click", () => { localStorage.removeItem("compareProducts"); renderCompare(); });
  await loadCatalog();
  renderCompare();
}

document.addEventListener("DOMContentLoaded", initCatalog);
