import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VENUE_MENUS,
  calculateCartTotal,
  formatPrice,
  validateContactForm,
} from './demoStore';

test('calculateCartTotal and formatPrice compute accurate cart totals', () => {
  const cafe = VENUE_MENUS.Cafe;
  const total = calculateCartTotal([
    { dish: cafe[0], qty: 2 }, // 2 * 3.50 = 7.00
    { dish: cafe[2], qty: 1 }, // 1 * 9.50 = 9.50
  ]);
  assert.equal(total, 16.5);
  assert.equal(formatPrice(total), '16.50');
});

test('validateContactForm catches missing fields and short phone numbers', () => {
  const invalidErrors = validateContactForm({
    name: '',
    restaurantName: '',
    city: '',
    tablesCount: '0',
    level: 'Level 2',
    phone: '12345',
    notes: '',
  });
  assert.ok(invalidErrors.name);
  assert.ok(invalidErrors.restaurantName);
  assert.ok(invalidErrors.city);
  assert.ok(invalidErrors.tablesCount);
  assert.equal(
    invalidErrors.phone,
    'Enter a phone number with at least 8 digits.'
  );

  const validErrors = validateContactForm({
    name: 'Sam Patel',
    restaurantName: 'Roast & Co',
    city: 'Austin',
    tablesCount: '14',
    level: 'Level 3',
    phone: '+1 512 555 0192',
    notes: 'Evening rush',
  });
  assert.equal(Object.keys(validErrors).length, 0);
});
