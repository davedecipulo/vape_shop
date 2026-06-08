-- Supabase SQL setup for the vape shop product catalog.
-- Run this entire file in Supabase SQL Editor, then create an owner account in Authentication.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.slugify(value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g'));
$$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  image text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  brand text not null default '',
  category_id uuid references public.categories(id) on delete set null,
  flavor text,
  price numeric(12,2) not null default 0 check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  description text,
  specifications jsonb not null default '{}'::jsonb,
  image_url text,
  gallery_urls text[] not null default '{}',
  status text not null default 'Out of Stock' check (status in ('In Stock', 'Low Stock', 'Out of Stock')),
  featured boolean not null default false,
  hidden boolean not null default false,
  archived boolean not null default false,
  popularity integer not null default 0,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null default 'owner' check (role in ('owner', 'manager')),
  created_at timestamptz not null default now()
);

create index if not exists idx_products_public
  on public.products (hidden, archived, created_at desc);
create index if not exists idx_products_category
  on public.products (category_id);
create index if not exists idx_products_brand
  on public.products (brand);
create index if not exists idx_products_status
  on public.products (status);
create index if not exists idx_products_price
  on public.products (price);
create index if not exists idx_products_slug
  on public.products (slug);
create index if not exists idx_categories_active
  on public.categories (active, name);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where id = auth.uid()
  );
$$;

create or replace function public.prepare_product()
returns trigger
language plpgsql
as $$
declare
  base_slug text;
  candidate text;
  suffix int := 1;
begin
  if new.stock > 10 then
    new.status := 'In Stock';
  elsif new.stock between 1 and 10 then
    new.status := 'Low Stock';
  else
    new.status := 'Out of Stock';
  end if;

  if new.slug is null or new.slug = '' then
    base_slug := public.slugify(concat_ws(' ', new.name, new.flavor));
  else
    base_slug := public.slugify(new.slug);
  end if;

  if base_slug = '' then
    base_slug := public.slugify(new.id::text);
  end if;

  candidate := base_slug;
  while exists (
    select 1 from public.products
    where slug = candidate and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) loop
    suffix := suffix + 1;
    candidate := base_slug || '-' || suffix;
  end loop;

  new.slug := candidate;
  return new;
end;
$$;

create or replace function public.increment_product_view(product_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
  set view_count = view_count + 1,
      popularity = popularity + 1
  where slug = product_slug
    and hidden = false
    and archived = false;
end;
$$;

drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists trg_prepare_product on public.products;
create trigger trg_prepare_product
before insert or update on public.products
for each row execute function public.prepare_product();

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists "Public can read active categories" on public.categories;
create policy "Public can read active categories"
on public.categories for select
using (active = true or public.is_admin());

drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories"
on public.categories for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read visible products" on public.products;
create policy "Public can read visible products"
on public.products for select
using ((hidden = false and archived = false) or public.is_admin());

drop policy if exists "Admins manage products" on public.products;
create policy "Admins manage products"
on public.products for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can read admin list" on public.admin_users;
create policy "Admins can read admin list"
on public.admin_users for select
using (public.is_admin());

-- Bootstrap note:
-- 1. Create the owner's Supabase Auth user.
-- 2. Copy that user's auth.users.id and email.
-- 3. Run:
-- insert into public.admin_users (id, email, role)
-- values ('AUTH_USER_UUID', 'owner@example.com', 'owner');

insert into public.categories (name, description)
values
  ('Disposable Vapes', 'Ready-to-use disposable vape devices.'),
  ('Pod Systems', 'Compact refillable and replaceable pod devices.'),
  ('E-Liquids', 'Premium vape juice flavors.'),
  ('Coils', 'Replacement coils and atomizers.'),
  ('Accessories', 'Chargers, cases, cotton, tools, and more.')
on conflict (name) do nothing;

-- Create the public storage bucket from Supabase Storage UI if this insert is blocked.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images"
on storage.objects for select
using (bucket_id = 'product-images');

drop policy if exists "Admins upload product images" on storage.objects;
create policy "Admins upload product images"
on storage.objects for insert
with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Admins update product images" on storage.objects;
create policy "Admins update product images"
on storage.objects for update
using (bucket_id = 'product-images' and public.is_admin())
with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Admins delete product images" on storage.objects;
create policy "Admins delete product images"
on storage.objects for delete
using (bucket_id = 'product-images' and public.is_admin());
