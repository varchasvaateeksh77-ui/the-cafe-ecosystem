# Build Bros — The Cafe Ecosystem (Full Product & Direct Android APKs)

This repository (`https://github.com/varchasvaateeksh77-ui/the-cafe-ecosystem`) contains the complete **Build Bros Digital Ordering System** across all four operational surfaces:

## Direct Android Phone APK Downloads (Waiter · Kitchen · Owner)

Every push to `main` automatically compiles the three dedicated Android `.apk` packages via GitHub Actions (`.github/workflows/build-apks.yml`) and publishes them to [GitHub Releases (`latest`)](https://github.com/varchasvaateeksh77-ui/the-cafe-ecosystem/releases/latest):

| Staff Surface | Android Package ID | Direct `.apk` Download Link | Full-Screen Web Launch Parameter |
| :--- | :--- | :--- | :--- |
| **1. Waiter Phone APK** | `com.buildbros.waiter` | [**Download `buildbros-waiter.apk`**](https://github.com/varchasvaateeksh77-ui/the-cafe-ecosystem/releases/latest/download/buildbros-waiter.apk) | `?apk=waiter` |
| **2. Kitchen & Reception KDS APK** | `com.buildbros.kitchen` | [**Download `buildbros-kitchen.apk`**](https://github.com/varchasvaateeksh77-ui/the-cafe-ecosystem/releases/latest/download/buildbros-kitchen.apk) | `?apk=kitchen` |
| **3. Owner / Admin Phone APK** | `com.buildbros.admin` | [**Download `buildbros-admin.apk`**](https://github.com/varchasvaateeksh77-ui/the-cafe-ecosystem/releases/latest/download/buildbros-admin.apk) | `?apk=admin` |
| **4. Guest Swipe Deck Web Menu** | Browser (Zero App Install) | Triggered via Table QR (`?apk=guest&table=5`) | `?apk=guest` |

### Guest Swipe Deck Menu Workflow
- **Category Sub-Sections**: Guests filter cards by sub-section (`All`, `Coffee`, `Cold Bar`, `Kitchen Mains`, `All-Day Plates`, `Bakery`).
- **Interactive Dish Cards**:
  - **Swipe Left (`← Skip`)**: Dish is skipped and advances to the next card.
  - **Swipe Right (`Cart + →`)**: Dish is added to the table cart and advances to the next card.
- **Done Picking → Click the Cart**:
  - Clicking **Cart** opens the Table Cart drawer showing all picked dishes, `+`/`-` quantity controls, and total.
  - **In Level 2 (`Waiter Call`)**: Cart displays the **Call the Waiter** button (`Call the Waiter (Table X)`), alerting `com.buildbros.waiter` in real time with the cart snapshot.
  - **In Level 3 (`Full Ordering`)**: Cart displays the **Send the Order** button (`Send the Order (Table X)`), dispatching the ticket directly to `com.buildbros.kitchen` with a live 4-stage tracker (`Incoming → New → Cooking → Ready → Served`).

---

## 1. Reference Sources, Skills & Websites (Mandatory Build Context)

Every surface in the Build Bros ecosystem must follow the engineering and visual standards established by these reference repositories and websites:

### GitHub Repositories & Agent Skills
- **Taste Skill (High-Craft Web & UI Engineering)**: [`https://github.com/Leonxlnx/taste-skill`](https://github.com/Leonxlnx/taste-skill)
  - Enforces senior frontend judgment, typographic hierarchy, real functional product windows, tactile feedback, and zero AI-slop templates.
- **Replica Skill (Measured Visual & Motion Replication)**: [`https://github.com/Jakeschincariol/replica-skill`](https://github.com/Jakeschincariol/replica-skill)
  - Two-pass workflow: Pass 1 measures exact colour tokens, typography scales, variable font axes, and frame timings; Pass 2 builds and verifies in a real browser.
- **HyperFrames (Deterministic Motion Graphics)**: [`https://github.com/heygen-com/hyperframes`](https://github.com/heygen-com/hyperframes)
  - HTML + GSAP deterministic frame compositions rendered to 30fps MP4 loops with settled poster frames.
- **Brag Launch Video Skill**: [`https://github.com/latent-spaces/brag`](https://github.com/latent-spaces/brag)
  - Generates beat-synced launch videos (`brag.mp4`, `brag.jpg`, `brag-plan.md`, `share-copy.txt`).

### Core Websites & Design Benchmarks
- **Primary Visual & Motion Benchmark**: [`https://www.tasteskill.dev/`](https://www.tasteskill.dev/)
- **GSAP (GreenSock Animation Platform)**: [`https://gsap.com/`](https://gsap.com/)
- **ThreeUI / 3D Spatial Floor**: [`https://threeui.com/`](https://threeui.com/)

### Owner Contact & Brand Constants
- **Brand**: Build Bros (`2.5+ years in tech and web dev`)
- **Phone / WhatsApp**: `+91 92035 66401` and `9425411807`
- **Email**: `varchasvaateeksh77@gmail.com`
- **GitHub**: [`https://github.com/varchasvaateeksh77-ui`](https://github.com/varchasvaateeksh77-ui)

### Non-Negotiable Visual Rules (From `design.md`)
- **Palette**:
  - Ground Cream: `#F7F2ED`
  - Elevated Surface: `#FFFFFF` with `1px solid #E3D9D3` hairline
  - Dark Stage Espresso: `#140905`
  - Elevated Dark Wood: `#2A180D`
  - Primary Accent Spark: `#E8500C` (Burnt Orange)
  - Live Status Dot: `#C4F042` (Lime spark — used only for live dots and active ready indicators)
  - Ink: `#1A0C06` on light, `#FBEFE6` on dark, `#6C625C` muted
- **Typography**: `Google Sans Flex` for headlines and UI, `Google Sans Code` (`tabular-nums`) for prices, table numbers, timers, and ticket IDs (`#0412`).
- **Anti-AI-Slop Gate**: No purple/indigo, no glassmorphism (except top nav pill), no icon libraries (`lucide-react` / FontAwesome) inside product UI, no emojis, no 3-equal-card SaaS rows, no hover-scale/lift on cards, no em-dashes (`—`).

---

## 2. How Real-Time Sync + Push Notifications Work (< 300ms Latency)

We use **Supabase** (PostgreSQL + Supabase Realtime WebSockets + Supabase Edge Functions + Storage) paired with **Firebase Cloud Messaging (FCM)** for native Android APK push notifications:

```text
[Owner Admin APK] ──(Updates price / hides sold-out dish)──► [Supabase PostgreSQL]
                                                                    │
       ┌────────────────────────────────────────────────────────────┴───────────────────────────────────────────────┐
       ▼ (Supabase Realtime WebSocket < 200ms)                                                                      ▼
[Guest Web Menu (Phone Browser)]                                                            [Supabase Database Webhook / Edge Function]
  • Price or "Sold Out" updates live on screen without page reload                            • Triggers on INSERT to `waiter_calls` or `orders`
  • Guest taps "Call Waiter" (Level 2) or "Place Order" (Level 3)                                                   │
                                                                                                                    ▼
                                                                                            [Firebase Cloud Messaging (FCM HTTP v1)]
                                                                                              • Wakes up locked/background Android devices
                                                                                                                    │
                                                                                    ┌───────────────────────────────┴───────────────────────────────┐
                                                                                    ▼                                                               ▼
                                                                     [Waiter Dedicated APK]                                          [Kitchen & Reception APK]
                                                                       • Rings loud custom chime                                       • Rings kitchen pass bell
                                                                       • Shows "Table 5 Needs You"                                     • Displays Ticket #0412 immediately
```

### Why Both Supabase Realtime AND Firebase Cloud Messaging (FCM)?
1. **When the app or browser is open on screen**: **Supabase Realtime (`postgres_changes` & `broadcast`)** pushes updates over WebSockets in **100–300ms** (instant menu price updates, instant cart status updates, instant KDS ticket column changes).
2. **When the Waiter's phone is locked in their pocket or the Kitchen tablet is in the background**: Android kills background WebSockets after a few minutes. **Firebase Cloud Messaging (FCM)** uses Google Play Services' system-level wake channel (`priority: "high"`, custom notification channel with sound + vibration) to wake the Waiter APK or Kitchen APK immediately.

---

## 3. Surface-by-Surface Functional Specification

### Surface 1: Guest Web Menu (Browser — Zero App Install)
- **URL Structure**: `https://menu.buildbros.app/:venueSlug?table=:tableNumber` (encoded in each table's physical QR plaque).
- **Level 1 (Digital Menu)**:
  - Loads venue branding, categories, dish photos, dietary badges (`Veg`, `Spicy`, `Chef Special`), and live prices.
  - Subscribes to `supabase.channel('menu-sync').on('postgres_changes', { table: 'menu_items' })` so if the Owner changes a price or marks a dish `is_available = false` in the Admin APK, the guest's open menu updates in place within milliseconds.
- **Level 2 (Menu + Waiter Call)**:
  - Guests add dishes and quantities (`+` / `-`) into their local/table cart with rolling `tabular-nums` total.
  - Tapping **Call waiter to Table X** inserts a row into `waiter_calls` (`table_number`, `cart_snapshot`, `status = 'pending'`).
  - Button transitions to `Waiter notified · Walking over` and updates live when the waiter taps `Acknowledge / On my way` in the Waiter APK.
- **Level 3 (Full Ordering)**:
  - Guests tap **Place order** from the cart.
  - Inserts into `orders` and `order_items` (`ticket_number` e.g. `#0412`, `table_number`, `status = 'new'`).
  - Guest phone displays a live order tracker (`Sent → Confirmed → Cooking → Ready → Served`) driven by Supabase Realtime updates on `orders`.

---

### Surface 2: Waiter Dedicated Android APK (`com.buildbros.waiter`)
- **Tech Stack**: React + TypeScript + Vite packaged via **Capacitor 6 Android** (`@capacitor/android`, `@capacitor/push-notifications`, `@capacitor/haptics`, `@capacitor-community/keep-awake`).
- **Core Features**:
  1. **Shift Login & Role Binding**: Waiter logs in with a 4-digit staff PIN or phone number; APK registers its FCM device token in `device_push_tokens` (`role = 'waiter'`, `venue_id`).
  2. **High-Priority Push Notification Channel (`waiter_calls_urgent`)**:
     - Configured in Android `MainActivity.java` with `IMPORTANCE_HIGH`, custom audio chime (`res/raw/waiter_chime.wav`), lock-screen visibility, and vibration pattern `[0, 400, 200, 400]`.
  3. **Live Table Call Queue**:
     - Displays incoming Level 2 table calls (`Table 5 · Needs you · Cart: 2x Flat white, 1x Smash burger`) with elapsed timer.
     - One-tap **On My Way** button notifies the guest's phone (`Waiter is walking to Table 5`) and claims the call so other waiters see it is handled.
  4. **Ready-to-Serve Pickup Alerts (Level 3)**:
     - When the Kitchen APK marks Ticket `#0412` as **Ready**, the Waiter APK gets a push alert (`PICKUP READY · Ticket #0412 for Table 5`) and a 1-tap **Mark Served** button.
  5. **Assisted Table Ordering**:
     - Waiter can tap any of the 12 tables on the floor map and punch in or modify an order directly on behalf of guests who prefer not to use their phone.

---

### Surface 3: Kitchen & Reception Dedicated Android APK (`com.buildbros.kitchen`)
- **Tech Stack**: Capacitor 6 Android APK optimized for landscape tablets and counter screens (plus web access for desktop reception computers).
- **Core Features**:
  1. **Always-Awake KDS Mode**: Uses `@capacitor-community/keep-awake` so the kitchen tablet never dims or locks during a shift.
  2. **Reception Mode Toggle (for venues with a counter gate)**:
     - Incoming Level 3 orders appear under **Incoming** with an audible bell.
     - Reception taps **Confirm Order** (or venues can enable `auto_route_to_kitchen = true` in the Admin APK to skip reception and send orders straight to the kitchen pass).
  3. **Kitchen Pass 4-Stage Ticket Board (`New → Cooking → Ready → Served`)**:
     - Large, high-contrast ticket cards (`#0412 · Table 5`, elapsed minute counter, item quantities in bold `Google Sans Code`).
     - One tap advances the ticket:
       - `Start Cooking` → Guest phone immediately switches to `Cooking`.
       - `Mark Ready` → Fires instant FCM push to Waiter APK + updates Guest phone to `Ready · Coming to your table`.
       - `Mark Served` → Archives ticket into shift history and frees the table state.
  4. **Quick 86 (Out-of-Stock) Button**:
     - Kitchen staff can long-press any dish name to mark it **Sold Out**, immediately hiding/disabling it on all guest phones.

---

### Surface 4: Owner / Admin Dedicated Android APK (`com.buildbros.admin`)
- **Tech Stack**: Capacitor 6 Android APK + Supabase Auth (Owner login) + Realtime subscriptions.
- **Core Features (Changes Take Place Across All Screens in < 1 Second)**:
  1. **Live Floor & Shift Monitor**:
     - Top-down interactive floor map showing all tables (`Free`, `Browsing`, `Waiter Called`, `Ordering`, `Cooking`, `Ready`, `Served`), active tickets, wait times, and today's revenue.
  2. **Instant Menu, Price & Availability Editor**:
     - Tap any dish to edit its **price**, **title**, **category**, **photo** (uploads directly to Supabase Storage bucket `menu-photos`), or toggle **Available / Sold Out**.
     - On save, `supabase.from('menu_items').update(...)` executes and Supabase Realtime broadcasts the diff to every open Guest Web Menu, Waiter APK, and Kitchen APK in **< 300ms**.
  3. **Service Level Switcher (Level 1 / Level 2 / Level 3)**:
     - Owner can switch the entire venue (or specific tables/hours) between Level 1 (Digital Menu only), Level 2 (Menu + Waiter Call), and Level 3 (Full Ordering) with one tap.
  4. **Table & QR Code Generator**:
     - Add/remove tables and export print-ready SVG/PDF table QR plaques pre-linked to `https://menu.buildbros.app/:venueSlug?table=N`.
  5. **Staff & Device Manager**:
     - Manage waiter PINs, see which Waiter and Kitchen APKs are online, and send a **Test Push Chime** to verify floor devices before shift start.

---

## 4. Complete Supabase Database Schema & Realtime Setup (SQL)

Run this migration in the **Supabase SQL Editor** (`https://supabase.com/dashboard/project/_/sql/new`):

```sql
-- 1. Venues (Cafes & Restaurants)
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  service_level int not null default 3 check (service_level in (1, 2, 3)),
  auto_route_to_kitchen boolean not null default false,
  currency_symbol text not null default '₹',
  created_at timestamptz not null default now()
);

-- 2. Floor Tables
create table public.floor_tables (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  table_number int not null,
  shape text not null default 'round' check (shape in ('round', 'square')),
  status text not null default 'free' check (status in ('free', 'browsing', 'waiter_called', 'ordering', 'cooking', 'ready', 'served')),
  unique (venue_id, table_number)
);

-- 3. Menu Categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);

-- 4. Menu Items (Dishes) — Realtime synced to all phones in <300ms
create table public.menu_items (
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
create table public.waiter_calls (
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
create table public.orders (
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
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  dish_name text not null,
  unit_price numeric(10,2) not null,
  quantity int not null check (quantity > 0)
);

-- 8. Android APK FCM Push Tokens (Waiter, Kitchen, Admin devices)
create table public.device_push_tokens (
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
```

---

## 5. Building the 3 Dedicated Android APKs (`Waiter`, `Kitchen`, `Admin`)

All three Android APKs share a monorepo (`apps/guest-web`, `apps/waiter-apk`, `apps/kitchen-apk`, `apps/admin-apk`, `packages/shared-supabase`) using **Capacitor 6** so you get native Android APK builds, native FCM background push channels, wake locks, and instant OTA UI updates:

```bash
# 1. Initialize Capacitor inside each APK workspace
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/push-notifications @capacitor/haptics @capacitor-community/keep-awake
npx cap init "Build Bros Waiter" "com.buildbros.waiter" --web-dir dist
npx cap add android

# 2. Place Firebase's google-services.json inside:
#    android/app/google-services.json

# 3. Build the web bundle & compile the signed Android APK
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
# Outputs installable APK at:
# android/app/build/outputs/apk/debug/app-debug.apk
```

### Supabase Edge Function for Instant FCM Push (`supabase/functions/push-alert/index.ts`)
- Triggered automatically by a Supabase Database Webhook on:
  - `INSERT` into `public.waiter_calls` → Queries `device_push_tokens` where `device_role in ('waiter', 'admin')` and sends an FCM high-priority notification:
    - **Title**: `Table ${table_number} Needs a Waiter`
    - **Body**: `Cart ready (${item_count} items · ${total}) — Tap to acknowledge`
    - **Android Channel**: `waiter_calls_urgent`
  - `INSERT` or `UPDATE` on `public.orders` →
    - On `incoming` / `new`: Alerts `kitchen` and `reception` APKs (`New Order #${ticket_number} · Table ${table_number}`).
    - On `ready`: Alerts `waiter` APK (`Order #${ticket_number} Ready for Table ${table_number}`).

---

## 6. Credentials, Keys & Direct Setup Links

### A. Supabase Credentials
- **Provided Supabase Secret Key (`SUPABASE_SERVICE_ROLE_KEY`)**:
  - Key ID / Value provided by owner: `sb_secret_` + `5IpiX9foAL_sftvd93Wf7w_jTjabujh`
  - *Note on how this key is used*: `sb_secret_...` is Supabase's new **Secret (Service Role) API key**. It has full admin privileges and is used in **Supabase Edge Functions / Backend** to dispatch push notifications and perform admin writes.
- **2 Remaining Supabase Values Needed for Client Apps (`Guest Web`, `Waiter APK`, `Kitchen APK`, `Admin APK`)**:
  1. `VITE_SUPABASE_URL` (looks like `https://<project-ref>.supabase.co`)
  2. `VITE_SUPABASE_ANON_KEY` (looks like `sb_publishable_...` or `eyJhbGci...`)
  - **Direct Link to copy your Supabase Project URL & Publishable Key**:
    - [https://supabase.com/dashboard/project/_/settings/api](https://supabase.com/dashboard/project/_/settings/api)
    - [https://supabase.com/dashboard/project/_/settings/api-keys](https://supabase.com/dashboard/project/_/settings/api-keys)

### B. Firebase Credentials (For Android APK Push Notifications & Optional Auth/Firestore)
To let the Waiter, Kitchen, and Admin APKs receive background/locked-screen push notifications via Firebase Cloud Messaging (FCM):
1. **Open Firebase Console & Select/Create Your Project**:
   - [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. **Download `google-services.json` for the Android APKs**:
   - Open **Project Settings → General**: [https://console.firebase.google.com/project/_/settings/general](https://console.firebase.google.com/project/_/settings/general)
   - Click **Add app → Android**, register package names `com.buildbros.waiter`, `com.buildbros.kitchen`, and `com.buildbros.admin`, and download `google-services.json`.
3. **Generate Firebase Service Account JSON (for Supabase Edge Function to send FCM pushes)**:
   - Open **Project Settings → Service accounts**: [https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk](https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk)
   - Click **Generate new private key** and save the JSON (contains `project_id`, `client_email`, and `private_key`).
4. **One-Click Firebase Provisioning Inside Google AI Studio**:
   - When building in Google AI Studio, you can also simply say *"Set up Firebase"* in chat—AI Studio has a built-in `set_up_firebase` tool that provisions and connects your Firebase project with a 1-click confirmation modal in the UI.
