async function initHome() {
  document.getElementById("year").textContent = new Date().getFullYear();
  try {
    const [featured, newest, categories] = await Promise.all([
      fetchProducts({ featured: true, limit: 4 }),
      fetchProducts({ sort: "newest", limit: 4 }),
      fetchCategories()
    ]);
    document.getElementById("statProducts").textContent = newest.count;
    document.getElementById("statCategories").textContent = categories.length;
    document.getElementById("featuredGrid").innerHTML = featured.data.length ? featured.data.map(productCard).join("") : empty("No featured products yet.");
    document.getElementById("newGrid").innerHTML = newest.data.length ? newest.data.map(productCard).join("") : empty("No products published yet.");
    document.getElementById("categoryGrid").innerHTML = categories.map((cat) => `
      <a class="admin-card" href="catalog.html?category=${cat.id}">
        <h3>${escapeHtml(cat.name)}</h3>
        <p class="muted">${escapeHtml(cat.description || "Browse category")}</p>
      </a>
    `).join("");
    wireProductActions([...featured.data, ...newest.data]);
  } catch (error) {
    toast(error.message);
  }

  const recent = JSON.parse(localStorage.getItem("recentlyViewed") || "[]");
  document.getElementById("recentGrid").innerHTML = recent.length
    ? recent.map((item) => `<a class="product-card" href="${productUrl(item)}"><img class="product-img" loading="lazy" src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}"><div class="product-body"><h3>${escapeHtml(item.name)}</h3><p class="meta">${escapeHtml(item.brand)}</p></div></a>`).join("")
    : empty("Recently viewed products will appear here.");

  document.getElementById("contactForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = encodeURIComponent(`Hi, I have a product inquiry.%0AName: ${form.get("name")}%0AContact: ${form.get("contact")}%0AMessage: ${form.get("message")}`);
    window.open(`${cfg.STORE.messengerUrl}?text=${message}`, "_blank", "noopener");
  });
}

function empty(message) {
  return `<div class="admin-card full"><p class="muted">${escapeHtml(message)}</p></div>`;
}

document.addEventListener("DOMContentLoaded", initHome);
