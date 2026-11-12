import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRODUCT_THEMES,
  getThemeById,
  filterThemeMenu,
  computeThemeCartSummary,
  nextTicketStatus,
  updateDishInMenu,
  addDishToMenu,
} from './themeCatalogData';

test('PRODUCT_THEMES defines all 4 distinct themes with complete menus, imageUrls, and palettes', () => {
  assert.equal(PRODUCT_THEMES.length, 4);
  const ids = PRODUCT_THEMES.map((t) => t.id);
  assert.deepEqual(ids, [
    'classy-elegant',
    'minimalist',
    'street-style',
    'artisanal-terracotta',
  ]);

  for (const theme of PRODUCT_THEMES) {
    assert.ok(theme.menu.length >= 6, `${theme.id} should have at least 6 dishes`);
    assert.ok(theme.categories.includes('All'));
    for (const dish of theme.menu) {
      assert.ok(dish.imageUrl && dish.imageUrl.length > 0, `${dish.id} must have an imageUrl placeholder`);
    }
  }
});

test('filterThemeMenu filters accurately by category and search query', () => {
  const street = getThemeById('street-style');
  const burgers = filterThemeMenu(street.menu, 'Smash Burgers', '');
  assert.equal(burgers.length, 2);

  const searchMatch = filterThemeMenu(street.menu, 'All', 'jalapeño');
  assert.equal(searchMatch.length, 1);
  assert.equal(searchMatch[0].id, 'ss-2');
});

test('computeThemeCartSummary calculates item quantities and subtotal accurately and skips soldOut items', () => {
  const elegant = getThemeById('classy-elegant');
  const summary = computeThemeCartSummary(elegant.menu, {
    'ce-1': 2, // 2 * 18.00 = 36.00
    'ce-3': 1, // 1 * 34.00 = 34.00
  });
  assert.equal(summary.totalCount, 3);
  assert.equal(summary.subtotal, 70.0);

  const withSoldOut = elegant.menu.map((m) =>
    m.id === 'ce-1' ? { ...m, soldOut: true } : m
  );
  const summaryAfterSoldOut = computeThemeCartSummary(withSoldOut, {
    'ce-1': 2,
    'ce-3': 1,
  });
  assert.equal(summaryAfterSoldOut.totalCount, 1);
  assert.equal(summaryAfterSoldOut.subtotal, 34.0);
});

test('nextTicketStatus advances ticket lifecycle deterministically', () => {
  assert.equal(nextTicketStatus('incoming'), 'confirmed');
  assert.equal(nextTicketStatus('confirmed'), 'cooking');
  assert.equal(nextTicketStatus('cooking'), 'ready');
  assert.equal(nextTicketStatus('ready'), 'served');
  assert.equal(nextTicketStatus('served'), 'served');
});

test('updateDishInMenu and addDishToMenu update prices, photos, and add new dishes cleanly', () => {
  const elegant = getThemeById('classy-elegant');
  const updated = updateDishInMenu(elegant.menu, 'ce-1', {
    price: 22.5,
    imageUrl: 'https://example.com/burrata.jpg',
  });
  const burrata = updated.find((d) => d.id === 'ce-1');
  assert.equal(burrata?.price, 22.5);
  assert.equal(burrata?.imageUrl, 'https://example.com/burrata.jpg');

  const withNewDish = addDishToMenu(
    updated,
    {
      name: 'Lobster Bisque',
      category: 'Small Plates',
      price: 19.0,
      description: 'Cognac cream and tarragon oil.',
      imageUrl: '',
      prepMinutes: 9,
    },
    elegant
  );
  assert.equal(withNewDish.length, elegant.menu.length + 1);
  assert.equal(withNewDish[0].name, 'Lobster Bisque');
  assert.equal(withNewDish[0].price, 19.0);
  assert.ok(withNewDish[0].imageUrl.startsWith('data:image/svg+xml'));
});
