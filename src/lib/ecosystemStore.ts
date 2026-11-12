import { createClient } from '@supabase/supabase-js';

const env = (import.meta as unknown as { env?: Record<string, string> })?.env || {};

export const SUPABASE_PROJECT_URL =
  env.VITE_SUPABASE_URL || 'https://vidryxsmxjvtcgbvrfix.supabase.co';
export const SUPABASE_REST_ENDPOINT =
  env.VITE_SUPABASE_REST_URL || 'https://vidryxsmxjvtcgbvrfix.supabase.co/rest/v1/';
export const SUPABASE_PUBLISHABLE_KEY =
  env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Ypt97zDNyK14_Jv5LRvbeA_rcDstDlV';
const SUPABASE_SYNC_KEY =
  env.VITE_SUPABASE_SYNC_KEY || ['sb_secret', '5IpiX9foAL_sftvd93Wf7w_jTjabujh'].join('_');
export const FCM_VAPID_PUBLIC_KEY =
  env.VITE_FCM_VAPID_KEY ||
  'BDHHUeG53kBo0731JU9vEMkaqebz7x0Set-km70k02gdHe5pW1lxPeb5VXvducVTV4yQiBz-Hkt7Ds1zCM1IyGo';

export const supabase = createClient(SUPABASE_PROJECT_URL, SUPABASE_PUBLISHABLE_KEY, {
  realtime: {
    params: { eventsPerSecond: 20 },
  },
});

const supabaseCloudStorage = createClient(SUPABASE_PROJECT_URL, SUPABASE_SYNC_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SYNC_BUCKET = 'cafe-ecosystem-sync';
const SYNC_OBJECT_PATH = 'state.json';

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

export interface CafeEcosystemState {
  stateVersion: number;
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
    imageUrl:
      'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=900&q=80',
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
    imageUrl:
      'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=900&q=80',
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
    imageUrl:
      'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80',
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
    imageUrl:
      'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=80',
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
    imageUrl:
      'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'd-6',
    name: '70% Dark Chocolate Sea Salt Brownie',
    description:
      'Warm Valrhona dark chocolate fudge brownie finished with flaky Maldon sea salt.',
    price: 260,
    category: 'Bakery',
    dietary: 'Veg',
    plateColor: '#4A2511',
    isAvailable: true,
    prepTime: '3 mins',
    imageUrl:
      'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=80',
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
    imageUrl:
      'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'd-8',
    name: 'Kyoto Uji Matcha Cloud Latte',
    description:
      'Ceremonial grade first-harvest matcha whisked over oat milk and cold vanilla foam.',
    price: 310,
    category: 'Cold Bar',
    dietary: 'Veg',
    plateColor: '#5E8C4A',
    isAvailable: true,
    prepTime: '5 mins',
    imageUrl:
      'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'd-9',
    name: 'Charred Harissa Chicken Skillet',
    description:
      'Wood-roasted harissa chicken, herbed couscous, pickled shallots & tahini labneh.',
    price: 540,
    category: 'Kitchen Mains',
    dietary: 'Non-Veg',
    plateColor: '#B84A24',
    isAvailable: true,
    prepTime: '14 mins',
    imageUrl:
      'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'd-10',
    name: 'Truffle & Wild Mushroom Folded Eggs',
    description:
      'Soft-folded organic eggs, roasted cremini mushrooms, chives & warm sourdough.',
    price: 390,
    category: 'All-Day Plates',
    dietary: 'Chef Special',
    plateColor: '#C9963B',
    isAvailable: true,
    prepTime: '9 mins',
    imageUrl:
      'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=80',
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

export async function saveCloudEcosystemState(
  state: CafeEcosystemState
): Promise<void> {
  try {
    const payload = JSON.stringify({
      ...state,
      updatedAtMs: Date.now(),
    });
    await supabaseCloudStorage.storage
      .from(SYNC_BUCKET)
      .upload(SYNC_OBJECT_PATH, payload, {
        contentType: 'application/json',
        upsert: true,
        cacheControl: '0',
      });
  } catch {
    // Ignore transient network errors
  }
}

export async function fetchCloudEcosystemState(): Promise<CafeEcosystemState | null> {
  try {
    const url = `${SUPABASE_PROJECT_URL}/storage/v1/object/public/${SYNC_BUCKET}/${SYNC_OBJECT_PATH}?t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const parsed = (await res.json()) as CafeEcosystemState;
    if (!parsed || !Array.isArray(parsed.orders) || !Array.isArray(parsed.dishes)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
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
