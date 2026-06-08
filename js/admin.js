const isLoginPage = location.pathname.includes("/admin/login");
const isDashboardPage = location.pathname.includes("/admin/dashboard");
let adminProducts = [];
let adminCategories = [];

document.addEventListener("DOMContentLoaded", async () => {
  if (isLoginPage) setupLogin();
  if (isDashboardPage) await setupDashboard();
});

function setupLogin() {
  document.getElementById("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.auth.signInWithPassword({
      email: form.get("email"),
      password: form.get("password")
    });
    if (error) return toast(error.message);
    location.href = "/admin/dashboard.html";
  });
}

async function setupDashboard() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    location.href = "/admin/login.html";
    return;
  }
  const { data: admin } = await supabase.from("admin_users").select("*").eq("id", user.id).maybeSingle();
  if (!admin) {
    await supabase.auth.signOut();
    location.href = "/admin/login.html";
    return;
  }
  bindAdminEvents();
  await refreshAdmin();
}

function bindAdminEvents() {
  document.querySelectorAll("[data-section]").forEach((button) => {
    button.addEventListener("click", () => showSection(button.dataset.section));
  });
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await supabase.auth.signOut();
    location.href = "/admin/login.html";
  });
  document.getElementById("newProductBtn").addEventListener("click", () => openProductForm());
  document.getElementById("cancelProduct").addEventListener("click", closeProductForm);
  document.getElementById("productForm").addEventListener("submit", saveProduct);
  document.getElementById("categoryForm").addEventListener("submit", saveCategory);
  document.getElementById("clearCategory").addEventListener("click", () => document.getElementById("categoryForm").reset());
  document.getElementById("importBtn").addEventListener("click", importProducts);
}

function showSection(id) {
  document.querySelectorAll(".admin-section").forEach((section) => section.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

async function refreshAdmin() {
  const [productsResult, categoriesResult] = await Promise.all([
    supabase.from("products").select("*, categories(name)").order("created_at", { ascending: false }),
    supabase.from("categories").select("*").order("name")
  ]);
  if (productsResult.error) toast(productsResult.error.message);
  if (categoriesResult.error) toast(categoriesResult.error.message);
  adminProducts = productsResult.data || [];
  adminCategories = categoriesResult.data || [];
  renderDashboard();
  renderProductFormCategories();
  renderProductsTable();
  renderCategoriesTable();
  renderInventoryTable();
}

function renderDashboard() {
  document.getElementById("totalProducts").textContent = adminProducts.length;
  document.getElementById("activeProducts").textContent = adminProducts.filter((p) => !p.archived && !p.hidden).length;
  document.getElementById("outProducts").textContent = adminProducts.filter((p) => p.stock === 0).length;
  document.getElementById("totalCategories").textContent = adminCategories.length;
  document.getElementById("recentProducts").innerHTML = table(
    ["Name", "Brand", "Category", "Price", "Stock", "Status"],
    adminProducts.slice(0, 8).map((p) => [p.name, p.brand, p.categories?.name || "", peso(p.price), p.stock, p.status])
  );
}

function renderProductFormCategories() {
  const select = document.querySelector("#productForm [name='category_id']");
  select.innerHTML = adminCategories.map((cat) => `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`).join("");
}

function renderProductsTable() {
  document.getElementById("productsTable").innerHTML = `
    <table>
      <thead><tr><th>Image</th><th>Name</th><th>Brand</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Visibility</th><th>Actions</th></tr></thead>
      <tbody>${adminProducts.map((p) => `
        <tr>
          <td><img class="preview-img" src="${escapeHtml(productImage(p))}" alt=""></td>
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(p.brand)}</td>
          <td>${escapeHtml(p.categories?.name || "")}</td>
          <td>${peso(p.price)}</td>
          <td>${p.stock}</td>
          <td>${statusBadge(p.status)}</td>
          <td>${p.archived ? "Archived" : p.hidden ? "Hidden" : "Visible"}</td>
          <td><div class="actions">
            <button class="btn" data-edit="${p.id}">Edit</button>
            <button class="btn" data-duplicate="${p.id}">Duplicate</button>
            <button class="btn" data-hide="${p.id}">${p.hidden ? "Show" : "Hide"}</button>
            <button class="btn" data-archive="${p.id}">${p.archived ? "Restore" : "Archive"}</button>
            <button class="btn danger" data-delete="${p.id}">Delete</button>
          </div></td>
        </tr>`).join("")}</tbody>
    </table>`;
  bindProductTableActions();
}

function bindProductTableActions() {
  document.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openProductForm(adminProducts.find((p) => p.id === b.dataset.edit))));
  document.querySelectorAll("[data-duplicate]").forEach((b) => b.addEventListener("click", () => duplicateProduct(b.dataset.duplicate)));
  document.querySelectorAll("[data-hide]").forEach((b) => b.addEventListener("click", () => toggleProduct(b.dataset.hide, "hidden")));
  document.querySelectorAll("[data-archive]").forEach((b) => b.addEventListener("click", () => toggleProduct(b.dataset.archive, "archived")));
  document.querySelectorAll("[data-delete]").forEach((b) => b.addEventListener("click", () => deleteProduct(b.dataset.delete)));
}

function openProductForm(product = null) {
  const panel = document.getElementById("productFormPanel");
  const form = document.getElementById("productForm");
  form.reset();
  document.getElementById("productFormTitle").textContent = product ? "Edit Product" : "Add Product";
  if (product) {
    form.elements.id.value = product.id;
    form.name.value = product.name || "";
    form.brand.value = product.brand || "";
    form.category_id.value = product.category_id || "";
    form.flavor.value = product.flavor || "";
    form.price.value = product.price || 0;
    form.stock.value = product.stock || 0;
    form.description.value = product.description || "";
    form.specifications.value = JSON.stringify(product.specifications || {}, null, 2);
    form.featured.checked = product.featured;
    form.hidden.checked = product.hidden;
  }
  panel.classList.remove("hidden");
  showSection("products");
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeProductForm() {
  document.getElementById("productFormPanel").classList.add("hidden");
  document.getElementById("productForm").reset();
}

async function saveProduct(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fd = new FormData(form);
  let imageUrl = null;
  let galleryUrls = [];
  try {
    if (form.image.files[0]) imageUrl = await uploadImage(form.image.files[0]);
    if (form.gallery.files.length) galleryUrls = await Promise.all([...form.gallery.files].map(uploadImage));
    const existing = adminProducts.find((p) => p.id === fd.get("id"));
    const payload = {
      name: sanitize(fd.get("name")),
      brand: sanitize(fd.get("brand")),
      category_id: fd.get("category_id"),
      flavor: sanitize(fd.get("flavor")),
      price: Number(fd.get("price") || 0),
      stock: Number(fd.get("stock") || 0),
      description: sanitize(fd.get("description")),
      specifications: parseSpecs(fd.get("specifications")),
      featured: fd.get("featured") === "on",
      hidden: fd.get("hidden") === "on",
      image_url: imageUrl || existing?.image_url || null,
      gallery_urls: galleryUrls.length ? galleryUrls : existing?.gallery_urls || []
    };
    const id = fd.get("id");
    const result = id
      ? await supabase.from("products").update(payload).eq("id", id)
      : await supabase.from("products").insert(payload);
    if (result.error) throw result.error;
    toast("Product saved");
    closeProductForm();
    await refreshAdmin();
  } catch (error) {
    toast(error.message);
  }
}

async function uploadImage(file) {
  if (!file.type.startsWith("image/")) throw new Error("Only image uploads are allowed.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be 5MB or smaller.");
  const ext = file.name.split(".").pop().toLowerCase();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(cfg.STORAGE_BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  return supabase.storage.from(cfg.STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

function parseSpecs(value) {
  if (!value?.trim()) return {};
  try { return JSON.parse(value); } catch { throw new Error("Specifications must be valid JSON."); }
}

function sanitize(value) {
  return String(value || "").replace(/[<>]/g, "").trim();
}

async function duplicateProduct(id) {
  const product = adminProducts.find((p) => p.id === id);
  const copy = { ...product };
  delete copy.id;
  delete copy.created_at;
  delete copy.updated_at;
  delete copy.categories;
  copy.name = `${copy.name} Copy`;
  copy.slug = "";
  copy.hidden = true;
  const { error } = await supabase.from("products").insert(copy);
  if (error) return toast(error.message);
  toast("Product duplicated and hidden");
  refreshAdmin();
}

async function toggleProduct(id, field) {
  const product = adminProducts.find((p) => p.id === id);
  const { error } = await supabase.from("products").update({ [field]: !product[field] }).eq("id", id);
  if (error) return toast(error.message);
  refreshAdmin();
}

async function deleteProduct(id) {
  if (!confirm("Delete this product permanently?")) return;
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return toast(error.message);
  toast("Product deleted");
  refreshAdmin();
}

async function saveCategory(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fd = new FormData(form);
  const payload = {
    name: sanitize(fd.get("name")),
    description: sanitize(fd.get("description")),
    image: sanitize(fd.get("image")),
    active: fd.get("active") === "on"
  };
  const result = fd.get("id")
    ? await supabase.from("categories").update(payload).eq("id", fd.get("id"))
    : await supabase.from("categories").insert(payload);
  if (result.error) return toast(result.error.message);
  toast("Category saved");
  form.reset();
  form.active.checked = true;
  refreshAdmin();
}

function renderCategoriesTable() {
  document.getElementById("categoriesTable").innerHTML = `
    <table>
      <thead><tr><th>Name</th><th>Description</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${adminCategories.map((c) => `
        <tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.description || "")}</td><td>${c.active ? "Visible" : "Hidden"}</td>
        <td><div class="actions"><button class="btn" data-cat-edit="${c.id}">Edit</button><button class="btn" data-cat-hide="${c.id}">${c.active ? "Hide" : "Show"}</button><button class="btn danger" data-cat-delete="${c.id}">Delete</button></div></td></tr>
      `).join("")}</tbody>
    </table>`;
  document.querySelectorAll("[data-cat-edit]").forEach((b) => b.addEventListener("click", () => editCategory(b.dataset.catEdit)));
  document.querySelectorAll("[data-cat-hide]").forEach((b) => b.addEventListener("click", () => toggleCategory(b.dataset.catHide)));
  document.querySelectorAll("[data-cat-delete]").forEach((b) => b.addEventListener("click", () => deleteCategory(b.dataset.catDelete)));
}

function editCategory(id) {
  const cat = adminCategories.find((c) => c.id === id);
  const form = document.getElementById("categoryForm");
  form.elements.id.value = cat.id;
  form.name.value = cat.name || "";
  form.description.value = cat.description || "";
  form.image.value = cat.image || "";
  form.active.checked = cat.active;
}

async function toggleCategory(id) {
  const cat = adminCategories.find((c) => c.id === id);
  const { error } = await supabase.from("categories").update({ active: !cat.active }).eq("id", id);
  if (error) return toast(error.message);
  refreshAdmin();
}

async function deleteCategory(id) {
  if (!confirm("Delete this category? Products will become uncategorized.")) return;
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return toast(error.message);
  refreshAdmin();
}

function renderInventoryTable() {
  document.getElementById("inventoryTable").innerHTML = `
    <table>
      <thead><tr><th>Product</th><th>Current Stock</th><th>Status</th><th>Low Stock Alert</th><th>Update</th></tr></thead>
      <tbody>${adminProducts.map((p) => `
        <tr>
          <td>${escapeHtml(p.name)}</td>
          <td><input class="input" type="number" min="0" value="${p.stock}" data-stock="${p.id}" style="max-width:120px"></td>
          <td>${statusBadge(p.status)}</td>
          <td>${p.stock <= 10 ? "Needs attention" : "Healthy"}</td>
          <td><button class="btn" data-stock-save="${p.id}">Save</button></td>
        </tr>`).join("")}</tbody>
    </table>`;
  document.querySelectorAll("[data-stock-save]").forEach((b) => b.addEventListener("click", () => updateStock(b.dataset.stockSave)));
}

async function updateStock(id) {
  const stock = Number(document.querySelector(`[data-stock="${id}"]`).value || 0);
  const { error } = await supabase.from("products").update({ stock }).eq("id", id);
  if (error) return toast(error.message);
  toast("Stock updated");
  refreshAdmin();
}

async function importProducts() {
  const file = document.getElementById("importFile").files[0];
  if (!file) return toast("Choose a CSV or Excel file first.");
  const rows = await readImportFile(file);
  const normalized = rows.map(normalizeImportRow).filter((row) => row.name && row.brand);
  if (!normalized.length) return toast("No valid products found.");
  const payload = [];
  for (const row of normalized) {
    const categoryId = await findOrCreateCategory(row.category || "Uncategorized");
    payload.push({ ...row, category_id: categoryId });
    delete payload[payload.length - 1].category;
  }
  const { error } = await supabase.from("products").insert(payload);
  if (error) return toast(error.message);
  document.getElementById("importPreview").innerHTML = table(["Imported", "Brand", "Price", "Stock"], payload.map((p) => [p.name, p.brand, peso(p.price), p.stock]));
  toast(`${payload.length} products imported`);
  refreshAdmin();
}

function readImportFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(sheet, { defval: "" }));
      } catch (error) { reject(error); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function normalizeImportRow(row) {
  const pick = (...names) => names.map((name) => row[name]).find((value) => value !== undefined && value !== "");
  return {
    name: sanitize(pick("Product Name", "Name", "name")),
    brand: sanitize(pick("Brand", "brand")),
    category: sanitize(pick("Category", "category")),
    flavor: sanitize(pick("Flavor", "flavor")),
    price: Number(pick("Price", "price") || 0),
    stock: Number(pick("Stock", "Stock Quantity", "stock") || 0),
    description: sanitize(pick("Description", "description")),
    specifications: {},
    hidden: false,
    archived: false,
    featured: false
  };
}

async function findOrCreateCategory(name) {
  const existing = adminCategories.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  const { data, error } = await supabase.from("categories").insert({ name, active: true }).select().single();
  if (error) throw error;
  adminCategories.push(data);
  return data.id;
}

function table(headings, rows) {
  return `
    <table>
      <thead><tr>${headings.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>`;
}
