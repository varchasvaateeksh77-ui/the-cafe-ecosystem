export type VenueType = 'Cafe' | 'Restaurant' | 'Bakery';
export type ServiceLevel = 1 | 2 | 3;
export type OrderStatus = 'Idle' | 'Sent' | 'Cooking' | 'Ready' | 'Served';

export interface DishItem {
  id: string;
  name: string;
  price: number;
  category: string;
  plateColor: string;
  soldOut?: boolean;
}

export interface CartEntry {
  dish: DishItem;
  qty: number;
}

export interface WaiterNotification {
  id: string;
  table: number;
  status: 'Needs you' | 'Order taken';
  itemsSummary: string;
  total: number;
}

export interface OrderTicket {
  ticketNumber: string;
  table: number;
  items: CartEntry[];
  total: number;
  receptionConfirmed: boolean;
  kitchenStatus: 'New' | 'Cooking' | 'Ready' | 'Served';
}

export const VENUE_MENUS: Record<VenueType, DishItem[]> = {
  Cafe: [
    { id: 'c1', name: 'Flat white', price: 3.50, category: 'Coffee', plateColor: '#C88A5A' },
    { id: 'c2', name: 'Iced tea', price: 3.00, category: 'Drinks', plateColor: '#D97B38' },
    { id: 'c3', name: 'Smash burger', price: 9.50, category: 'Food', plateColor: '#8C3F19' },
    { id: 'c4', name: 'Garlic bread', price: 4.50, category: 'Food', plateColor: '#E2B46D' },
    { id: 'c5', name: 'Brownie', price: 4.00, category: 'Sweet', plateColor: '#4A2511' },
  ],
  Restaurant: [
    { id: 'r1', name: 'Margherita', price: 9.00, category: 'Mains', plateColor: '#D64924' },
    { id: 'r2', name: 'Smash burger', price: 9.50, category: 'Mains', plateColor: '#8C3F19' },
    { id: 'r3', name: 'Fries', price: 3.50, category: 'Sides', plateColor: '#E5B24C' },
    { id: 'r4', name: 'Lemonade', price: 3.00, category: 'Drinks', plateColor: '#E8C547' },
    { id: 'r5', name: 'Gelato', price: 4.50, category: 'Sweet', plateColor: '#F3D6B8' },
  ],
  Bakery: [
    { id: 'b1', name: 'Croissant', price: 2.80, category: 'Pastry', plateColor: '#D49448' },
    { id: 'b2', name: 'Sourdough loaf', price: 5.50, category: 'Bread', plateColor: '#A96B38' },
    { id: 'b3', name: 'Cinnamon roll', price: 3.20, category: 'Pastry', plateColor: '#9C5227' },
    { id: 'b4', name: 'Filter coffee', price: 2.50, category: 'Coffee', plateColor: '#5C3118' },
    { id: 'b5', name: 'Lemon tart', price: 4.20, category: 'Sweet', plateColor: '#E5B93C' },
  ],
};

export function calculateCartTotal(cart: CartEntry[]): number {
  const sum = cart.reduce((acc, entry) => acc + entry.dish.price * entry.qty, 0);
  return Math.round(sum * 100) / 100;
}

export function formatPrice(amount: number): string {
  return amount.toFixed(2);
}

export interface ContactFormInput {
  name: string;
  restaurantName: string;
  city: string;
  tablesCount: string;
  level: string;
  phone: string;
  notes: string;
}

export interface ContactFormErrors {
  name?: string;
  restaurantName?: string;
  city?: string;
  tablesCount?: string;
  phone?: string;
}

export function validateContactForm(input: ContactFormInput): ContactFormErrors {
  const errors: ContactFormErrors = {};
  if (!input.name.trim()) {
    errors.name = 'Enter your name so we know who to ask for.';
  }
  if (!input.restaurantName.trim()) {
    errors.restaurantName = 'Enter the name of your cafe or restaurant.';
  }
  if (!input.city.trim()) {
    errors.city = 'Enter your city or neighbourhood.';
  }
  const tablesNum = Number(input.tablesCount);
  if (!input.tablesCount.trim() || Number.isNaN(tablesNum) || tablesNum < 1) {
    errors.tablesCount = 'Enter the number of tables (at least 1).';
  }
  const digitsOnly = input.phone.replace(/\D/g, '');
  if (digitsOnly.length < 8) {
    errors.phone = 'Enter a phone number with at least 8 digits.';
  }
  return errors;
}
