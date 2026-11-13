import { createClient } from '@supabase/supabase-js';

const env = (import.meta as unknown as { env?: Record<string, string> })?.env || {};

export const SUPABASE_PROJECT_URL =
  env.VITE_SUPABASE_URL || 'https://vidryxsmxjvtcgbvrfix.supabase.co';
export const SUPABASE_REST_ENDPOINT =
  env.VITE_SUPABASE_REST_URL || 'https://vidryxsmxjvtcgbvrfix.supabase.co/rest/v1/';
export const SUPABASE_PUBLISHABLE_KEY =
  env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Ypt97zDNyK14_Jv5LRvbeA_rcDstDlV';
export const FCM_VAPID_PUBLIC_KEY =
  env.VITE_FCM_VAPID_KEY ||
  'BDHHUeG53kBo0731JU9vEMkaqebz7x0Set-km70k02gdHe5pW1lxPeb5VXvducVTV4yQiBz-Hkt7Ds1zCM1IyGo';

export const GH_CLOUD_REPO = 'varchasvaateeksh77-ui/the-cafe-ecosystem';
export function getCloudSyncToken(): string {
  if (env.VITE_GH_SYNC_TOKEN) return env.VITE_GH_SYNC_TOKEN;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem('bb_owner_sync_token') || '';
    }
  } catch {
    // Ignore storage errors
  }
  return '';
}

export const supabase = createClient(SUPABASE_PROJECT_URL, SUPABASE_PUBLISHABLE_KEY, {
  realtime: {
    params: { eventsPerSecond: 20 },
  },
});

export const SYNC_BUCKET = 'cafe-ecosystem-sync';
const LOCAL_STORAGE_KEY = 'build_bros_cafe_ecosystem_state_v3';

export type ServiceLevel = 1 | 2 | 3;
export type FloorTableStatus =
  | 'free'
  | 'browsing'
  | 'waiter_called'
  | 'ordering'
  | 'cooking'
  | 'ready'
  | 'served';

export interface DishItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  dietary: 'Veg' | 'Non-Veg' | 'Chef Special' | 'Spicy';
  plateColor: string;
  isAvailable: boolean;
  prepTime?: string;
  imageUrl?: string;
}

export interface CartItem {
  dish: DishItem;
  qty: number;
}

export interface WaiterCall {
  id: string;
  tableNumber: number;
  cartSnapshot: CartItem[];
  cartTotal: number;
  status: 'pending' | 'acknowledged' | 'completed';
  acknowledgedBy?: string;
  createdAt: string;
}

export interface KitchenOrder {
  id: string;
  ticketNumber: string;
  tableNumber: number;
  items: CartItem[];
  totalAmount: number;
  receptionConfirmed: boolean;
  status: 'incoming' | 'new' | 'cooking' | 'ready' | 'served';
  notes: string;
  createdAt: string;
  checkedItemIds?: string[];
}

export interface FloorTable {
  tableNumber: number;
  shape: 'round' | 'square';
  seats: number;
  status: FloorTableStatus;
  activeTicket?: string;
  cartTotal?: number;
  updatedAt: string;
}

export interface PushNotificationEvent {
  id: string;
  timestamp: string;
  targetApk:
    | 'com.buildbros.waiter'
    | 'com.buildbros.kitchen'
    | 'com.buildbros.admin'
    | 'guest-web';
  channel: string;
  title: string;
  body: string;
  latencyMs: number;
}

export interface CrossDeviceAlert {
  id: string;
  targetApk: PushNotificationEvent['targetApk'];
  title: string;
  body: string;
  createdAtMs: number;
}

export interface OtaManifest {
  otaVersion: number;
  releaseChannel: string;
  updatedAt: string;
  notes: string;
}

export interface CafeEcosystemState {
  stateVersion: number;
  otaVersion: number;
  updatedAtMs: number;
  venueName: string;
  venueSlug: string;
  serviceLevel: ServiceLevel;
  autoRouteToKitchen: boolean;
  currencySymbol: string;
  activeTable: number;
  dishes: DishItem[];
  cart: CartItem[];
  waiterCalls: WaiterCall[];
  orders: KitchenOrder[];
  tables: FloorTable[];
  pushEvents: PushNotificationEvent[];
  lastAlert?: CrossDeviceAlert;
  realtimeConnected: boolean;
  lastSyncLatencyMs: number;
}

export const INITIAL_DISHES: DishItem[] = [
  {
    id: 'd-1',
    name: 'Single Origin Flat White',
    description:
      'Double ristretto of Chikmagalur estate arabica over velvety micro-foam milk.',
    price: 240,
    category: 'Coffee',
    dietary: 'Veg',
    plateColor: '#C88A5A',
    isAvailable: true,
    prepTime: '4 mins',
    imageUrl: '/dishes/flat-white.jpg',
  },
  {
    id: 'd-2',
    name: 'Yuzu Cold Brew Tonic',
    description:
      '18-hour steeped estate arabica over artisanal citrus tonic & rosemary sprig.',
    price: 280,
    category: 'Cold Bar',
    dietary: 'Chef Special',
    plateColor: '#D97B38',
    isAvailable: true,
    prepTime: '3 mins',
    imageUrl: '/dishes/yuzu-cold-brew.jpg',
  },
  {
    id: 'd-3',
    name: 'Truffle Brioche Smash Burger',
    description:
      'Crispy lacy edges, aged cheddar, black truffle aioli, house pickle & brioche bun.',
    price: 490,
    category: 'Kitchen Mains',
    dietary: 'Chef Special',
    plateColor: '#8C3F19',
    isAvailable: true,
    prepTime: '12 mins',
    imageUrl: '/dishes/truffle-burger.jpg',
  },
  {
    id: 'd-4',
    name: 'Chilli Crisp Sourdough Toast',
    description:
      'Whipped ricotta, house smoky chilli oil, toasted sesame on charred country loaf.',
    price: 360,
    category: 'All-Day Plates',
    dietary: 'Spicy',
    plateColor: '#D64924',
    isAvailable: true,
    prepTime: '8 mins',
    imageUrl: '/dishes/sourdough-toast.jpg',
  },
  {
    id: 'd-5',
    name: 'Burnt Basque Cheesecake',
    description:
      'Caramelized high-heat crust with a warm, custard-soft Madagascar vanilla center.',
    price: 340,
    category: 'Bakery',
    dietary: 'Veg',
    plateColor: '#E2B46D',
    isAvailable: true,
    prepTime: '3 mins',
    imageUrl: '/dishes/basque-cheesecake.jpg',
  },
  {
    id: 'd-6',
    name: '70% Dark Chocolate Sea Salt Tart',
    description:
      'Warm Valrhona dark chocolate ganache finished with flaky Maldon sea salt.',
    price: 260,
    category: 'Bakery',
    dietary: 'Veg',
    plateColor: '#4A2511',
    isAvailable: true,
    prepTime: '3 mins',
    imageUrl: '/dishes/basque-cheesecake.jpg',
  },
  {
    id: 'd-7',
    name: 'Salted Maple Cortado',
    description:
      'Equal parts rich espresso and steamed milk kissed with smoked sea salt & pure maple.',
    price: 250,
    category: 'Coffee',
    dietary: 'Veg',
    plateColor: '#A66A38',
    isAvailable: true,
    prepTime: '4 mins',
    imageUrl: '/dishes/flat-white.jpg',
  },
  {
    id: 'd-8',
    name: 'Sparkling Blood Orange Espresso',
    description:
      'Chilled double espresso layered over Sicilian blood orange tonic and thyme.',
    price: 310,
    category: 'Cold Bar',
    dietary: 'Veg',
    plateColor: '#5E8C4A',
    isAvailable: true,
    prepTime: '5 mins',
    imageUrl: '/dishes/yuzu-cold-brew.jpg',
  },
  {
    id: 'd-9',
    name: 'Charred Harissa Brioche Melt',
    description:
      'Wood-roasted harissa glaze, aged provolone, pickled shallots & tahini aioli.',
    price: 540,
    category: 'Kitchen Mains',
    dietary: 'Non-Veg',
    plateColor: '#B84A24',
    isAvailable: true,
    prepTime: '14 mins',
    imageUrl: '/dishes/truffle-burger.jpg',
  },
  {
    id: 'd-10',
    name: 'Truffle & Wild Mushroom Tartine',
    description:
      'Roasted cremini mushrooms, whipped herb ricotta, chives & warm country sourdough.',
    price: 390,
    category: 'All-Day Plates',
    dietary: 'Chef Special',
    plateColor: '#C9963B',
    isAvailable: true,
    prepTime: '9 mins',
    imageUrl: '/dishes/sourdough-toast.jpg',
  },
];

export const INITIAL_TABLES: FloorTable[] = [
  { tableNumber: 1, shape: 'round', seats: 2, status: 'served', cartTotal: 520, updatedAt: '4m ago' },
  { tableNumber: 2, shape: 'round', seats: 2, status: 'free', updatedAt: '12m ago' },
  { tableNumber: 3, shape: 'square', seats: 4, status: 'cooking', activeTicket: '#0410', cartTotal: 1120, updatedAt: '3m ago' },
  { tableNumber: 4, shape: 'round', seats: 2, status: 'browsing', updatedAt: '1m ago' },
  { tableNumber: 5, shape: 'square', seats: 4, status: 'ordering', activeTicket: '#0412', cartTotal: 970, updatedAt: 'Just now' },
  { tableNumber: 6, shape: 'square', seats: 4, status: 'ready', activeTicket: '#0411', cartTotal: 840, updatedAt: 'Just now' },
  { tableNumber: 7, shape: 'round', seats: 2, status: 'free', updatedAt: '9m ago' },
  { tableNumber: 8, shape: 'square', seats: 6, status: 'browsing', updatedAt: '2m ago' },
  { tableNumber: 9, shape: 'round', seats: 2, status: 'free', updatedAt: '18m ago' },
  { tableNumber: 10, shape: 'square', seats: 4, status: 'served', cartTotal: 1460, updatedAt: '7m ago' },
  { tableNumber: 11, shape: 'round', seats: 2, status: 'free', updatedAt: '15m ago' },
  { tableNumber: 12, shape: 'square', seats: 6, status: 'free', updatedAt: '11m ago' },
];

export function calculateCartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.dish.price * item.qty, 0);
}

export function createInitialCafeState(): CafeEcosystemState {
  const dishes = INITIAL_DISHES.map((d) => ({ ...d }));
  const initialCart: CartItem[] = [
    { dish: dishes[0], qty: 2 },
    { dish: dishes[2], qty: 1 },
  ];
  const cartTotal = calculateCartTotal(initialCart);
  const now = new Date().toLocaleTimeString([], {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return {
    stateVersion: 1,
    otaVersion: 240,
    updatedAtMs: Date.now(),
    venueName: 'Roast & Co. Flagship',
    venueSlug: 'roast-and-co',
    serviceLevel: 3,
    autoRouteToKitchen: false,
    currencySymbol: '₹',
    activeTable: 5,
    dishes,
    cart: initialCart,
    waiterCalls: [
      {
        id: 'wc-501',
        tableNumber: 5,
        cartSnapshot: initialCart,
        cartTotal,
        status: 'pending',
        createdAt: now,
      },
    ],
    orders: [
      {
        id: 'ord-412',
        ticketNumber: '#0412',
        tableNumber: 5,
        items: initialCart,
        totalAmount: cartTotal,
        receptionConfirmed: false,
        status: 'incoming',
        notes: 'Extra hot flat white',
        createdAt: now,
        checkedItemIds: [],
      },
      {
        id: 'ord-411',
        ticketNumber: '#0411',
        tableNumber: 6,
        items: [
          { dish: dishes[1], qty: 2 },
          { dish: dishes[4], qty: 1 },
        ],
        totalAmount: 900,
        receptionConfirmed: true,
        status: 'ready',
        notes: '',
        createdAt: now,
        checkedItemIds: ['d-2', 'd-5'],
      },
    ],
    tables: INITIAL_TABLES.map((t) => ({ ...t })),
    pushEvents: [
      {
        id: 'evt-1',
        timestamp: now,
        targetApk: 'com.buildbros.kitchen',
        channel: 'supabase_realtime:orders',
        title: 'New Order #0412 · Table 5',
        body: '2x Single Origin Flat White, 1x Truffle Brioche Smash Burger',
        latencyMs: 134,
      },
      {
        id: 'evt-2',
        timestamp: now,
        targetApk: 'com.buildbros.waiter',
        channel: 'fcm:waiter_calls_urgent',
        title: 'PICKUP READY · Ticket #0411',
        body: 'Table 6 order ready at kitchen pass — Tap to serve',
        latencyMs: 162,
      },
    ],
    realtimeConnected: false,
    lastSyncLatencyMs: 134,
  };
}

let lastGithubSha: string | null = null;
let isSavingToCloud = false;
let inMemoryStateCache: CafeEcosystemState | null = null;

function encodeBase64Utf8(str: string): string {
  if (typeof btoa === 'function') {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  return '';
}

export async function saveCloudEcosystemState(
  state: CafeEcosystemState
): Promise<void> {
  const payloadObj: CafeEcosystemState = {
    ...state,
    updatedAtMs: Date.now(),
  };
  inMemoryStateCache = normalizeDishes(payloadObj);
  const payload = JSON.stringify(payloadObj);

  // 1. Instant local persistence
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, payload);
    }
  } catch {
    // Ignore storage quota errors
  }

  // 2. Optional GitHub Contents API cloud snapshot if device has an owner sync token configured
  const token = getCloudSyncToken();
  if (!token || isSavingToCloud) return;
  isSavingToCloud = true;
  try {
    const apiUrl = `https://api.github.com/repos/${GH_CLOUD_REPO}/contents/cloud-sync/state.json`;
    if (!lastGithubSha) {
      const metaRes = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
        cache: 'no-store',
      });
      if (metaRes.ok) {
        const meta = (await metaRes.json()) as { sha?: string };
        if (meta.sha) lastGithubSha = meta.sha;
      }
    }

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `sync: state v${payloadObj.stateVersion} [skip ci]`,
        content: encodeBase64Utf8(payload),
        ...(lastGithubSha ? { sha: lastGithubSha } : {}),
      }),
    });

    if (putRes.ok) {
      const putData = (await putRes.json()) as { content?: { sha?: string } };
      if (putData?.content?.sha) {
        lastGithubSha = putData.content.sha;
      }
    } else if (putRes.status === 409 || putRes.status === 422) {
      lastGithubSha = null;
    }
  } catch {
    // Ignore transient network errors
  } finally {
    isSavingToCloud = false;
  }
}

function normalizeDishes(parsed: CafeEcosystemState): CafeEcosystemState {
  const dishImageMap = new Map(INITIAL_DISHES.map((d) => [d.id, d.imageUrl]));
  return {
    ...parsed,
    otaVersion: parsed.otaVersion || 240,
    dishes: parsed.dishes.map((d) => ({
      ...d,
      imageUrl: dishImageMap.get(d.id) || d.imageUrl,
    })),
  };
}

export function loadLocalEcosystemState(): CafeEcosystemState | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CafeEcosystemState;
        if (parsed && Array.isArray(parsed.orders) && Array.isArray(parsed.dishes)) {
          return normalizeDishes(parsed);
        }
      }
    }
  } catch {
    // Ignore local storage errors
  }
  return null;
}

export async function fetchCloudEcosystemState(): Promise<CafeEcosystemState | null> {
  let bestState: CafeEcosystemState | null = inMemoryStateCache || loadLocalEcosystemState();
  const token = getCloudSyncToken();
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.raw+json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  // Fetch uncached live cloud baseline from public GitHub repo (no secret needed to read)
  try {
    const apiUrl = `https://api.github.com/repos/${GH_CLOUD_REPO}/contents/cloud-sync/state.json?t=${Date.now()}`;
    let res = await fetch(apiUrl, { headers, cache: 'no-store' });
    if (!res.ok) {
      res = await fetch(
        `https://raw.githubusercontent.com/${GH_CLOUD_REPO}/main/cloud-sync/state.json?t=${Date.now()}`,
        { cache: 'no-store' }
      );
    }
    if (res.ok) {
      const parsed = (await res.json()) as CafeEcosystemState;
      if (parsed && Array.isArray(parsed.orders) && Array.isArray(parsed.dishes)) {
        const normalized = normalizeDishes(parsed);
        if (!bestState || (normalized.stateVersion || 0) >= (bestState.stateVersion || 0)) {
          bestState = normalized;
          inMemoryStateCache = normalized;
        }
      }
    }
  } catch {
    // Ignore network glitch
  }

  return bestState;
}

export async function fetchOtaManifest(): Promise<OtaManifest | null> {
  const token = getCloudSyncToken();
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.raw+json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const apiUrl = `https://api.github.com/repos/${GH_CLOUD_REPO}/contents/ota/manifest.json?t=${Date.now()}`;
    let res = await fetch(apiUrl, { headers, cache: 'no-store' });
    if (!res.ok) {
      res = await fetch(
        `https://raw.githubusercontent.com/${GH_CLOUD_REPO}/main/ota/manifest.json?t=${Date.now()}`,
        { cache: 'no-store' }
      );
    }
    if (!res.ok) return null;
    return (await res.json()) as OtaManifest;
  } catch {
    return null;
  }
}

export async function pushOtaManifestUpdate(
  nextOtaVersion: number,
  notes: string
): Promise<OtaManifest> {
  const manifest: OtaManifest = {
    otaVersion: nextOtaVersion,
    releaseChannel: 'production-live',
    updatedAt: new Date().toLocaleTimeString([], {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    notes,
  };
  const token = getCloudSyncToken();
  if (!token) return manifest;
  try {
    const apiUrl = `https://api.github.com/repos/${GH_CLOUD_REPO}/contents/ota/manifest.json`;
    let sha: string | undefined;
    const metaRes = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
      cache: 'no-store',
    });
    if (metaRes.ok) {
      const meta = (await metaRes.json()) as { sha?: string };
      sha = meta.sha;
    }
    await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `ota: publish live update v${nextOtaVersion} [skip ci]`,
        content: encodeBase64Utf8(JSON.stringify(manifest, null, 2)),
        ...(sha ? { sha } : {}),
      }),
    });
  } catch {
    // Ignore transient network error
  }
  return manifest;
}

export function applyAdminDishPatch(
  state: CafeEcosystemState,
  dishId: string,
  patch: Partial<DishItem>
): CafeEcosystemState {
  const nextDishes = state.dishes.map((d) => (d.id === dishId ? { ...d, ...patch } : d));
  const nextCart = state.cart
    .map((c) => {
      if (c.dish.id !== dishId) return c;
      const updated = nextDishes.find((d) => d.id === dishId);
      if (!updated || !updated.isAvailable) return null;
      return { ...c, dish: updated };
    })
    .filter((c): c is CartItem => Boolean(c));

  const target = nextDishes.find((d) => d.id === dishId);
  const latencyMs = Math.floor(105 + Math.random() * 80);
  const now = new Date().toLocaleTimeString([], {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const title = `Admin Updated: ${target?.name || dishId}`;
  const body =
    patch.isAvailable !== undefined
      ? patch.isAvailable
        ? 'Restocked Available on all guest phones'
        : 'Marked 86 SOLD OUT — hidden on all guest phones'
      : `Price updated to ${state.currencySymbol}${target?.price} across all tables`;

  const event: PushNotificationEvent = {
    id: `evt-${Date.now()}`,
    timestamp: now,
    targetApk: 'guest-web',
    channel: 'supabase_realtime:menu_items',
    title,
    body,
    latencyMs,
  };

  return {
    ...state,
    stateVersion: (state.stateVersion || 1) + 1,
    updatedAtMs: Date.now(),
    dishes: nextDishes,
    cart: nextCart,
    lastSyncLatencyMs: latencyMs,
    pushEvents: [event, ...state.pushEvents.slice(0, 19)],
    lastAlert: {
      id: event.id,
      targetApk: 'guest-web',
      title,
      body,
      createdAtMs: Date.now(),
    },
  };
}
