import test from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import {
  calculateCartTotal,
  createInitialCafeState,
  applyAdminDishPatch,
  SUPABASE_PROJECT_URL,
  SUPABASE_PUBLISHABLE_KEY,
  FCM_VAPID_PUBLIC_KEY,
} from './ecosystemStore';
import { buildTableQrUrl } from '../components/TableQrGenerator';

test('Cafe Ecosystem initializes with 12 tables, 10 dishes across 5 sub-sections, Supabase URL, publishable key, and FCM VAPID key', () => {
  const state = createInitialCafeState();
  assert.equal(state.tables.length, 12);
  assert.equal(state.dishes.length, 10);
  const categories = Array.from(new Set(state.dishes.map((d) => d.category)));
  assert.deepEqual(categories, ['Coffee', 'Cold Bar', 'Kitchen Mains', 'All-Day Plates', 'Bakery']);
  assert.ok(SUPABASE_PROJECT_URL.includes('vidryxsmxjvtcgbvrfix.supabase.co'));
  assert.ok(SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_'));
  assert.ok(FCM_VAPID_PUBLIC_KEY.length > 20);
});

test('applyAdminDishPatch updates dish prices and 86 sold-out state across Guest Web Menu and Cart', () => {
  const initial = createInitialCafeState();
  // Initial cart: 2x Flat White (240) + 1x Smash Burger (490) = 970
  assert.equal(calculateCartTotal(initial.cart), 970);

  // Update Flat White price from 240 to 260
  const afterPrice = applyAdminDishPatch(initial, 'd-1', { price: 260 });
  assert.equal(afterPrice.dishes[0].price, 260);
  assert.equal(calculateCartTotal(afterPrice.cart), 1010);

  // Mark Flat White as 86 Sold Out (isAvailable = false) -> removes from active guest cart
  const after86 = applyAdminDishPatch(afterPrice, 'd-1', { isAvailable: false });
  assert.equal(after86.dishes[0].isAvailable, false);
  assert.equal(after86.cart.some((c) => c.dish.id === 'd-1'), false);
  assert.equal(calculateCartTotal(after86.cart), 490);
});

test('buildTableQrUrl and QRCode generate direct working table URLs and valid scannable SVG QR matrices', async () => {
  const url = buildTableQrUrl('https://menu.buildbros.app/', 'roast-and-co', 7, 3);
  assert.equal(url, 'https://menu.buildbros.app/?apk=guest&venue=roast-and-co&table=7&level=3');
  const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'H' });
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('<path'));
});
