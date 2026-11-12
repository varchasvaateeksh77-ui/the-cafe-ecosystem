-- Build Bros: The Cafe Ecosystem — Complete Supabase Schema & Realtime Migration
-- Project: https://vidryxsmxjvtcgbvrfix.supabase.co

-- 1. Venues (Cafes & Restaurants)
create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  service_level int not null default 3 check (service_level in (1, 2, 3)),
  auto_route_to_kitchen boolean not null default false,
  currency_symbol text not null default '₹',
  created_at timestamptz not null default now()
);

-- 2. Floor Tables
create table if not exists public.floor_tables (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  table_number int not null,
  shape text not null default 'round' check (shape in ('round', 'square')),
  status text not null default 'free' check (status in ('free', 'browsing', 'waiter_called', 'ordering', 'cooking', 'ready', 'served')),
  unique (venue_id, table_number)
);

-- 3. Menu Categories
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);

-- 4. Menu Items (Dishes) — Realtime synced to all phones in <300ms
create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  description text default '',
  price numeric(10,2) not null,
  image_url text default '',
  plate_color text default '#C87D4B',
  is_available boolean not null default true,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

-- 5. Level 2 Waiter Calls
create table if not exists public.waiter_calls (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  table_number int not null,
  cart_snapshot jsonb not null default '[]'::jsonb,
  cart_total numeric(10,2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'acknowledged', 'completed')),
  acknowledged_by text,
  created_at timestamptz not null default now()
);

-- 6. Level 3 Orders (Tickets)
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  ticket_number text not null,
  table_number int not null,
  status text not null default 'incoming' check (status in ('incoming', 'new', 'cooking', 'ready', 'served', 'cancelled')),
  total_amount numeric(10,2) not null default 0,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. Order Line Items
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  dish_name text not null,
  unit_price numeric(10,2) not null,
  quantity int not null check (quantity > 0)
);

-- 8. Android APK FCM Push Tokens (Waiter, Kitchen, Admin devices)
create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  device_role text not null check (device_role in ('waiter', 'kitchen', 'reception', 'admin')),
  staff_name text default '',
  fcm_token text unique not null,
  updated_at timestamptz not null default now()
);

-- Enable Instant Supabase Realtime across all operational tables
alter publication supabase_realtime add table
  public.venues,
  public.floor_tables,
  public.categories,
  public.menu_items,
  public.waiter_calls,
  public.orders,
  public.order_items;
