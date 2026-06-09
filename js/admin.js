const isLoginPage = location.pathname.includes("/admin/login");
const isDashboardPage = location.pathname.includes("/admin/dashboard");
const adminLoginUrl = location.protocol === "file:" ? "login.html" : "/admin/login.html";
const adminDashboardUrl = location.protocol === "file:" ? "dashboard.html" : "/admin/dashboard.html";
let adminProducts = [];
let adminCategories = [];

function getSupabaseClient() {
  return window.catalogSupabaseClient || null;
}

document.addEventListener("DOMContentLoaded", async () => {
  if (isLoginPage) setupLogin();
  if (isDashboardPage) await setupDashboard();
});

function setupLogin() {
  document.getElementById("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const client = getSupabaseClient();
    if (!client) {
      showLoginNotice(window.catalogSetupMessage || "Supabase is not configured.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password: form.get("password")
    });
    if (error) {
      showLoginNotice(`Login failed: ${error.message}`);
      return;
    }
    const user = data.user;
    const { data: admin, error: adminError } = await client
      .from("admin_users")
      .select("id,email,role")
      .eq("id", user.id)
      .maybeSingle();
    if (adminError || !admin) {
      await client.auth.signOut();
      showLoginNotice(`
        Auth login worked, but this user is not in public.admin_users yet.
        Run this in Supabase SQL Editor:
        <code>insert into public.admin_users (id, email, role) values ('${escapeHtml(user.id)}', '${escapeHtml(email)}', 'owner') on conflict (id) do update set email = excluded.email, role = excluded.role;</code>
      `);
      return;
    }
    location.href = adminDashboardUrl;
  });
}

function showLoginNotice(message) {
  let notice = document.getElementById("loginNotice");
  if (!notice) {
    notice = document.createElement("div");
    notice.id = "loginNotice";
    notice.className = "admin-card";
    notice.style.marginTop = "16px";
    document.querySelector(".login-card").appendChild(notice);
  }
  notice.innerHTML = `<p>${message}</p>`;
}

async function setupDashboard() {
  const client = getSupabaseClient();
  if (!client) {
    document.querySelector(".admin-main").innerHTML = `
      <div class="admin-card">
        <h1>Supabase setup required</h1>
        <p class="muted">${escapeHtml(window.catalogSetupMessage || "Supabase is not configured.")}</p>
        <p>After setup, open <strong>/admin/login.html</strong> and sign in with the owner account.</p>
      </div>
    `;
    return;
  }
  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    location.href = adminLoginUrl;
    return;
  }
  const { data: admin } = await client.from("admin_users").select("*").eq("id", user.id).maybeSingle();
  if (!admin) {
    await client.auth.signOut();
    location.href = adminLoginUrl;
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
    await getSupabaseClient().auth.signOut();
    location.href = adminLoginUrl;
  });
  document.getElementById("newProductBtn").addEventListener("click", () => openProductForm());
  document.getElementById("cancelProduct").addEventListener("click", closeProductForm);
  document.getElementById("productForm").addEventListener("submit", saveProduct);
  document.getElementById("categoryForm").addEventListener("submit", saveCategory);
  document.getElementById("clearCategory").addEventListener("click", () => document.getElementById("categoryForm").reset());
  document.getElementById("importBtn").addEventListener("click", importProducts);
  document.getElementById("bulkHideBtn").addEventListener("click", () => bulkToggle("hidden", true));
  document.getElementById("bulkShowBtn").addEventListener("click", () => bulkToggle("hidden", false));
  document.getElementById("bulkArchiveBtn").addEventListener("click", () => bulkToggle("archived", true));
  document.getElementById("bulkRestoreBtn").addEventListener("click", () => bulkToggle("archived", false));
  document.getElementById("bulkDeleteBtn").addEventListener("click", openBulkDeleteConfirm);
  document.getElementById("bulkClearBtn").addEventListener("click", clearBulkSelection);
  document.getElementById("bulkConfirmOk").addEventListener("click", confirmBulkDelete);
  document.getElementById("bulkConfirmCancel").addEventListener("click", () => document.getElementById("bulkConfirm").classList.add("hidden"));
}

function showSection(id) {
  document.querySelectorAll(".admin-section").forEach((section) => section.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

async function refreshAdmin() {
  const [productsResult, categoriesResult] = await Promise.all([
    getSupabaseClient().from("products").select("*, categories(name)").order("created_at", { ascending: false }),
    getSupabaseClient().from("categories").select("*").order("name")
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
  document.getElementById("bulkBar").classList.add("hidden");
  document.getElementById("bulkConfirm").classList.add("hidden");
  document.getElementById("productsTable").innerHTML = `
    <table>
      <thead><tr><th><input type="checkbox" id="selectAll" title="Select all"></th><th>Image</th><th>Name</th><th>Brand</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Visibility</th><th>Actions</th></tr></thead>
      <tbody>${adminProducts.map((p) => `
        <tr>
          <td><input type="checkbox" class="bulk-check" data-bulk="${p.id}"></td>
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
  document.getElementById("selectAll").addEventListener("change", (e) => {
    document.querySelectorAll(".bulk-check").forEach((cb) => (cb.checked = e.target.checked));
    updateBulkBar();
  });
  document.querySelectorAll(".bulk-check").forEach((cb) => cb.addEventListener("change", updateBulkBar));
}

function updateBulkBar() {
  const count = document.querySelectorAll(".bulk-check:checked").length;
  document.getElementById("bulkCount").textContent = `${count} selected`;
  document.getElementById("bulkBar").classList.toggle("hidden", count === 0);
}

function getSelectedIds() {
  return [...document.querySelectorAll(".bulk-check:checked")].map((cb) => cb.dataset.bulk);
}

function clearBulkSelection() {
  document.querySelectorAll(".bulk-check").forEach((cb) => (cb.checked = false));
  const all = document.getElementById("selectAll");
  if (all) all.checked = false;
  updateBulkBar();
}

async function bulkToggle(field, value) {
  const ids = getSelectedIds();
  if (!ids.length) return;
  const { error } = await getSupabaseClient().from("products").update({ [field]: value }).in("id", ids);
  if (error) return toast(error.message);
  toast(`${ids.length} products updated`);
  refreshAdmin();
}

function openBulkDeleteConfirm() {
  const ids = getSelectedIds();
  if (!ids.length) return;
  const products = adminProducts.filter((p) => ids.includes(p.id));
  document.getElementById("bulkConfirmList").innerHTML = products.map((p) => `
    <label class="choice-item">
      <input type="checkbox" class="confirm-check" value="${p.id}" checked>
      <div>${escapeHtml(p.name)}<span>${escapeHtml(p.brand)} · ${peso(p.price)}</span></div>
    </label>
  `).join("");
  document.getElementById("bulkConfirm").classList.remove("hidden");
  document.getElementById("bulkConfirm").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function confirmBulkDelete() {
  const ids = [...document.querySelectorAll(".confirm-check:checked")].map((cb) => cb.value);
  if (!ids.length) return;
  const { error } = await getSupabaseClient().from("products").delete().in("id", ids);
  if (error) return toast(error.message);
  document.getElementById("bulkConfirm").classList.add("hidden");
  toast(`${ids.length} products deleted`);
  refreshAdmin();
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
      ? await getSupabaseClient().from("products").update(payload).eq("id", id)
      : await getSupabaseClient().from("products").insert(payload);
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
  const { error } = await getSupabaseClient().storage.from(cfg.STORAGE_BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  return getSupabaseClient().storage.from(cfg.STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
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
  const { error } = await getSupabaseClient().from("products").insert(copy);
  if (error) return toast(error.message);
  toast("Product duplicated and hidden");
  refreshAdmin();
}

async function toggleProduct(id, field) {
  const product = adminProducts.find((p) => p.id === id);
  const { error } = await getSupabaseClient().from("products").update({ [field]: !product[field] }).eq("id", id);
  if (error) return toast(error.message);
  refreshAdmin();
}

async function deleteProduct(id) {
  if (!confirm("Delete this product permanently?")) return;
  const { error } = await getSupabaseClient().from("products").delete().eq("id", id);
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
    ? await getSupabaseClient().from("categories").update(payload).eq("id", fd.get("id"))
    : await getSupabaseClient().from("categories").insert(payload);
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
  const { error } = await getSupabaseClient().from("categories").update({ active: !cat.active }).eq("id", id);
  if (error) return toast(error.message);
  refreshAdmin();
}

async function deleteCategory(id) {
  if (!confirm("Delete this category? Products will become uncategorized.")) return;
  const { error } = await getSupabaseClient().from("categories").delete().eq("id", id);
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
  const { error } = await getSupabaseClient().from("products").update({ stock }).eq("id", id);
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
  const { error } = await getSupabaseClient().from("products").insert(payload);
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
  const { data, error } = await getSupabaseClient().from("categories").insert({ name, active: true }).select().single();
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


