import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCartTotal,
  createInitialCafeState,
  applyAdminDishPatch,
  SUPABASE_PROJECT_URL,
  SUPABASE_PUBLISHABLE_KEY,
  FCM_VAPID_PUBLIC_KEY,
} from './ecosystemStore';

test('Cafe Ecosystem initializes with 12 tables, Supabase URL, publishable key, and FCM VAPID key', () => {
  const state = createInitialCafeState();
  assert.equal(state.tables.length, 12);
  assert.equal(state.dishes.length, 6);
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
