# Vape Shop Product Catalog Management System

A modern web-based product catalog for a physical vape shop. This is not an e-commerce site: there is no cart, checkout, online payment, order processing, or customer account system.

## Features

- Public homepage with hero banner, featured products, new arrivals, categories, store info, contact info, map, contact form, announcement banner, and footer.
- Product catalog with search, category filter, brand filter, max price filter, price sorting, newest sorting, popularity sorting, pagination, favorites, and comparison.
- Product detail pages with SEO-friendly URLs, gallery, specifications, availability badge, structured data, view counter, recently viewed products, and inquiry links.
- Protected admin dashboard with Supabase Authentication.
- Product management: add, edit, delete, archive, restore, duplicate, hide, image upload, gallery upload, stock management, and featured flags.
- Category management: create, edit, hide, delete.
- Inventory status automation:
  - Stock greater than 10: In Stock
  - Stock 1 to 10: Low Stock
  - Stock 0: Out of Stock
- CSV and Excel bulk product imports.
- Supabase PostgreSQL database and Supabase Storage image uploads.
- Static frontend deployable to Netlify.

## Project Structure

```text
.
|-- admin/
|   |-- dashboard.html
|   `-- login.html
|-- css/
|   `-- styles.css
|-- js/
|   |-- admin.js
|   |-- app.js
|   |-- catalog.js
|   |-- config.example.js
|   |-- config.js
|   |-- home.js
|   `-- product.js
|-- sql/
|   `-- schema.sql
|-- catalog.html
|-- index.html
|-- product.html
|-- netlify.toml
`-- README.md
```

## Dashboard Locations

There is no customer or public user dashboard because this project is intentionally not an e-commerce system and does not include customer accounts.

## Access Guide

### Local Access on This Computer

Open this folder:

```text
C:\Users\Dave Adrian Carlo\OneDrive\Desktop\VAPESHOP
```

Double-click these files:

```text
Homepage:
index.html

Customer product catalog:
catalog.html

Admin login:
admin\login.html

Admin dashboard:
admin\dashboard.html
```

The product detail page is opened by clicking a product from the catalog after Supabase is configured and products exist. For local testing, product detail URLs look like this:

```text
product.html?slug=geek-bar-pulse-blue-razz-ice
```

### Netlify Access After Deployment

If your Netlify domain is:

```text
https://your-vape-shop.netlify.app
```

Use these links:

```text
Homepage:
https://your-vape-shop.netlify.app/

Customer product catalog:
https://your-vape-shop.netlify.app/catalog

Product detail:
https://your-vape-shop.netlify.app/products/geek-bar-pulse-blue-razz-ice

Admin login:
https://your-vape-shop.netlify.app/admin/login.html

Admin dashboard:
https://your-vape-shop.netlify.app/admin/dashboard.html

Clean admin route:
https://your-vape-shop.netlify.app/admin
```

### What Works Before Supabase Setup

Before editing `js/config.js`, you can open the pages and see the layout/design. Product data, filters, login, uploads, and admin saving will not work yet.

### What Works After Supabase Setup

After running `sql/schema.sql`, creating the owner Auth user, adding the owner to `admin_users`, and editing `js/config.js`, these features work:

- Public product listings
- Product detail pages
- Search and filters
- Admin login
- Add/edit/delete/archive/hide products
- Image uploads
- Category management
- Stock updates
- Bulk import

### Dashboard Locations

The owner/admin dashboard is here:

```text
/admin/login.html
/admin/dashboard.html
```

On Netlify, the clean admin route also works:

```text
/admin
```

The public customer-facing pages are:

```text
/                 Homepage
/catalog.html     Product catalog
/catalog          Clean catalog route on Netlify
/products/slug    Product detail route on Netlify
```

## Supabase Setup

1. Create a new Supabase project.
2. Open `sql/schema.sql`, copy the whole file, and run it in the Supabase SQL Editor.
3. In Supabase Authentication, create the owner user with email and password.
4. Open Authentication > Users, copy the owner user's UUID.
5. Run this SQL with the real UUID and email:

```sql
insert into public.admin_users (id, email, role)
values ('AUTH_USER_UUID', 'owner@example.com', 'owner');
```

6. Confirm Storage has a public bucket named `product-images`. The SQL attempts to create it automatically. If Supabase blocks that insert, create it manually in Storage.

Passwords are stored and secured by Supabase Auth. The `admin_users` table is an allowlist for owner/admin access and intentionally does not store plaintext passwords.

## Configure the Website

Edit `js/config.js`:

```js
window.VAPE_SHOP_CONFIG = {
  SUPABASE_URL: "https://YOUR_PROJECT_ID.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_Hhr4bIb-EZUyw2_Mo1E8zw_WzJrSteo",
  STORAGE_BUCKET: "product-images",
  STORE: {
    name: "Blue Volt Vape Shop",
    phone: "+63 969 243 4251",
    email: "davepalomado2005@gmail.com",
    facebookUrl: "https://facebook.com/your-vape-shop",
    messengerUrl: "https://m.me/your-vape-shop",
    address: "Your physical store address",
    mapEmbedUrl: "https://www.google.com/maps?q=Your%20Store%20Address&output=embed"
  }
};
```

Use the Supabase anon public key, not the service role key.

## Admin Usage

Open:

```text
/admin/login.html
```

After signing in, the owner can manage the catalog entirely through the dashboard:

- Add products by filling out the form and uploading images.
- Edit products from the product table.
- Hide products from the public website without deleting them.
- Archive and restore products.
- Duplicate products for faster entry.
- Update stock in Inventory.
- Import products from CSV or Excel.

## User Guide

### For Store Customers

1. Open the homepage.
2. Click Browse Products or open `/catalog.html`.
3. Use the search bar to find a product by name, brand, or flavor.
4. Use filters for category, brand, maximum price, and sorting.
5. Open a product card to view product details, image gallery, specifications, price, and availability.
6. Use Contact Store, Facebook Inquiry, or Messenger Inquiry to ask the shop about the product.
7. Use the favorite button to save products on the same device.
8. Use Compare to compare up to four products.
9. Visit the physical store to buy or ask staff for final availability.

Customers cannot create accounts, place orders, checkout, or pay online.

### For Store Owner/Admin

1. Open `/admin/login.html`.
2. Sign in using the Supabase Auth owner account.
3. Use Dashboard to view product totals, active products, out-of-stock products, categories, and recent additions.
4. Use Products to add, edit, duplicate, hide, archive, restore, or delete products.
5. When adding or editing a product, fill in the product details and upload images directly from the form.
6. Use Categories to create, edit, hide, or delete catalog categories.
7. Use Inventory to update stock quantities.
8. Use Bulk Import to upload CSV or Excel product lists.
9. Sign out when finished.

### Product Status Rules

Product availability is automatic:

- Stock greater than 10: In Stock
- Stock from 1 to 10: Low Stock
- Stock 0: Out of Stock

The owner only needs to update the stock quantity.

Example import columns:

```csv
Product Name,Brand,Category,Flavor,Price,Stock,Description
Geek Bar Pulse,Geek Bar,Disposable Vapes,Blue Razz Ice,750,15,Popular disposable device
Lost Mary,Lost Mary,Disposable Vapes,Watermelon Ice,700,20,Available in store
```

## Netlify Deployment

1. Push this folder to a Git repository.
2. In Netlify, choose Add new site > Import an existing project.
3. Select the repository.
4. Build command: leave empty.
5. Publish directory: `.`
6. Deploy.

`netlify.toml` includes clean routes such as:

```text
/products/geek-bar-pulse-blue-razz-ice
/catalog
/admin
```

## Security Notes

- Admin routes require Supabase Auth.
- Database row-level security is enabled.
- Only users listed in `admin_users` can manage products and categories.
- Public users can only read visible, non-archived products and active categories.
- Image uploads are limited to image MIME types and 5 MB in the browser and storage policy.
- User input is escaped or sanitized before display.

## Store Owner Notes

This website displays products available in the physical store only. Customers can browse online, save favorites, compare products, and contact the shop through phone, Facebook, or Messenger. It intentionally does not include online buying features.
