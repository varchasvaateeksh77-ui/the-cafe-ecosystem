export type ThemeId =
  | 'classy-elegant'
  | 'minimalist'
  | 'street-style'
  | 'artisanal-terracotta';

export type ServiceLevel = 1 | 2 | 3;

export interface ThemeMenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  imageUrl: string;
  tag?: string;
  soldOut?: boolean;
  prepMinutes: number;
}

export interface ThemePalette {
  mode: 'dark' | 'light';
  canvas: string;
  surface: string;
  elevated: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  border: string;
  floorGround: string;
  floorTable: string;
}

export interface ProductThemeConfig {
  id: ThemeId;
  indexNumber: string;
  styleName: string;
  defaultVenueName: string;
  venueSubtitle: string;
  tagline: string;
  description: string;
  heroImage: string;
  displayFont: string;
  bodyFont: string;
  cardRadius: string;
  buttonRadius: string;
  currencySymbol: string;
  palette: ThemePalette;
  categories: string[];
  menu: ThemeMenuItem[];
}

export interface LiveOrderTicket {
  ticketNumber: string;
  tableNumber: number;
  items: { id: string; name: string; qty: number; price: number; note?: string; imageUrl?: string }[];
  total: number;
  status: 'incoming' | 'confirmed' | 'cooking' | 'ready' | 'served';
  createdAt: string;
  source?: 'guest-direct' | 'waiter-confirmed';
}

export interface LiveWaiterCall {
  id: string;
  tableNumber: number;
  cartCount: number;
  cartTotal: number;
  cartItems: { id: string; name: string; qty: number; price: number }[];
  note?: string;
  reason: 'Order ready in cart' | 'Question for waiter' | 'Bill requested';
  status: 'calling' | 'walking' | 'confirmed' | 'assisted';
  createdAt: string;
}

/**
 * Generates a deterministic, appetizing SVG data-URI dish photo placeholder
 * whenever a custom photo hasn't been uploaded yet, so every dish card in the
 * Swipe Deck has an immediate visual dish plate illustration + photo frame.
 */
export function createDishPhotoPlaceholder(
  dishName: string,
  category: string,
  bgHex: string,
  plateHex: string,
  accentHex: string,
  textHex: string
): string {
  const safeTitle = dishName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeCat = category.toUpperCase().replace(/&/g, '&amp;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 560" width="800" height="560">
    <rect width="800" height="560" fill="${bgHex}"/>
    <circle cx="400" cy="255" r="175" fill="${plateHex}" stroke="${accentHex}" stroke-width="2" stroke-opacity="0.45"/>
    <circle cx="400" cy="255" r="132" fill="none" stroke="${accentHex}" stroke-width="1.5" stroke-dasharray="6 6" stroke-opacity="0.4"/>
    <circle cx="365" cy="235" r="46" fill="${accentHex}" fill-opacity="0.22"/>
    <circle cx="438" cy="268" r="34" fill="${accentHex}" fill-opacity="0.34"/>
    <circle cx="395" cy="285" r="22" fill="${textHex}" fill-opacity="0.18"/>
    <rect x="30" y="28" width="220" height="34" rx="8" fill="${plateHex}" stroke="${accentHex}" stroke-width="1" stroke-opacity="0.35"/>
    <text x="46" y="50" fill="${accentHex}" font-family="monospace" font-size="13" font-weight="600" letter-spacing="2">${safeCat}</text>
    <text x="400" y="485" text-anchor="middle" fill="${textHex}" font-family="sans-serif" font-size="24" font-weight="700">${safeTitle}</text>
    <text x="400" y="516" text-anchor="middle" fill="${accentHex}" font-family="monospace" font-size="12" letter-spacing="2">DISH PHOTO PLACEHOLDER · REPLACE IN ADMIN</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const PRODUCT_THEMES: ProductThemeConfig[] = [
  {
    id: 'classy-elegant',
    indexNumber: '01',
    styleName: 'Classy Elegant',
    defaultVenueName: "L'Atelier Doré",
    venueSubtitle: 'Candlelit Bistro & Wine Bar',
    tagline: 'Chiaroscuro dining with antique brass details and sommelier pairings.',
    description:
      'Designed for fine-dining rooms, wine bars, and tasting-menu bistros. High-contrast Cormorant Garamond typography over deep obsidian walnut surfaces and brushed gold accents.',
    heroImage: '/src/assets/images/theme_classy_elegant_bistro_1794394475547.jpg',
    displayFont: '"Cormorant Garamond", Georgia, serif',
    bodyFont: '"Plus Jakarta Sans", sans-serif',
    cardRadius: '16px',
    buttonRadius: '10px',
    currencySymbol: '$',
    palette: {
      mode: 'dark',
      canvas: '#0E0B09',
      surface: '#17120F',
      elevated: '#211A15',
      text: '#F5EFE6',
      muted: '#A6998A',
      accent: '#C89D54',
      accentText: '#0E0B09',
      border: 'rgba(200, 157, 84, 0.24)',
      floorGround: '#0E0B09',
      floorTable: '#2B1F17',
    },
    categories: ['All', 'Small Plates', 'Mains', 'Cellar & Cocktails', 'Dessert'],
    menu: [
      {
        id: 'ce-1',
        name: 'Truffle & Heirloom Burrata',
        category: 'Small Plates',
        price: 18.0,
        description:
          'Pugliese creamy burrata, shaved black Périgord truffle, aged Modena balsamic, grilled sourdough.',
        imageUrl: createDishPhotoPlaceholder('Truffle & Heirloom Burrata', 'Small Plates', '#15100D', '#211914', '#C89D54', '#F5EFE6'),
        tag: "Chef's Signature",
        prepMinutes: 8,
      },
      {
        id: 'ce-2',
        name: 'Hand-Cut Wagyu Tartare',
        category: 'Small Plates',
        price: 24.0,
        description:
          'A5 Miyazaki tenderloin, confit egg yolk, caperberry, shallot, toasted brioche soldiers.',
        imageUrl: createDishPhotoPlaceholder('Hand-Cut Wagyu Tartare', 'Small Plates', '#15100D', '#211914', '#C89D54', '#F5EFE6'),
        prepMinutes: 10,
      },
      {
        id: 'ce-3',
        name: '36-Hour Crispy Duck Confit',
        category: 'Mains',
        price: 34.0,
        description:
          'Slow-rendered Gascogne duck leg, charred orange reduction, parsnip silk, wild chanterelles.',
        imageUrl: createDishPhotoPlaceholder('36-Hour Crispy Duck Confit', 'Mains', '#15100D', '#211914', '#C89D54', '#F5EFE6'),
        tag: 'Most Ordered',
        prepMinutes: 16,
      },
      {
        id: 'ce-4',
        name: 'Pan-Seared Hokkaido Scallops',
        category: 'Mains',
        price: 32.0,
        description:
          'Diver scallops, saffron champagne velouté, crispy pancetta, sea fennel.',
        imageUrl: createDishPhotoPlaceholder('Pan-Seared Hokkaido Scallops', 'Mains', '#15100D', '#211914', '#C89D54', '#F5EFE6'),
        prepMinutes: 14,
      },
      {
        id: 'ce-5',
        name: 'Smoked Rosemary Negroni',
        category: 'Cellar & Cocktails',
        price: 16.0,
        description:
          'Artisanal botanical gin, Carpano Antica vermouth, Campari, torched rosemary sprig.',
        imageUrl: createDishPhotoPlaceholder('Smoked Rosemary Negroni', 'Cellar & Cocktails', '#15100D', '#211914', '#C89D54', '#F5EFE6'),
        prepMinutes: 4,
      },
      {
        id: 'ce-6',
        name: '70% Guanaja Chocolate Soufflé',
        category: 'Dessert',
        price: 15.0,
        description:
          'Baked to order dark Valrhona chocolate soufflé with Madagascar vanilla bean crème anglaise.',
        imageUrl: createDishPhotoPlaceholder('70% Guanaja Chocolate Soufflé', 'Dessert', '#15100D', '#211914', '#C89D54', '#F5EFE6'),
        prepMinutes: 15,
      },
    ],
  },
  {
    id: 'minimalist',
    indexNumber: '02',
    styleName: 'Minimalist',
    defaultVenueName: 'Kōbō Nordic',
    venueSubtitle: 'Specialty Coffee & Sourdough Bakery',
    tagline: 'Daylight travertine stone, quiet architectural lines, and single-origin clarity.',
    description:
      'Built for specialty coffee roasteries, Scandinavian bakeries, and daylight brunch spaces. Ultra-clean Plus Jakarta Sans typography, warm alabaster paper surfaces, and pine accents.',
    heroImage: '/src/assets/images/theme_minimalist_nordic_cafe_1794394476496.jpg',
    displayFont: '"Plus Jakarta Sans", sans-serif',
    bodyFont: '"Plus Jakarta Sans", sans-serif',
    cardRadius: '14px',
    buttonRadius: '8px',
    currencySymbol: '$',
    palette: {
      mode: 'light',
      canvas: '#FAF9F5',
      surface: '#FFFFFF',
      elevated: '#F2EFE9',
      text: '#141413',
      muted: '#6E6A63',
      accent: '#1E3F2B',
      accentText: '#FAF9F5',
      border: 'rgba(20, 20, 19, 0.11)',
      floorGround: '#EFECE6',
      floorTable: '#D8D2C5',
    },
    categories: ['All', 'Filter & Espresso', 'Bakery', 'Tartines', 'Botanical'],
    menu: [
      {
        id: 'mn-1',
        name: 'Panama Geisha V60 Pour Over',
        category: 'Filter & Espresso',
        price: 6.5,
        description:
          'Washed Boquete lot. Jasmine blossom, bergamot, and white peach notes brewed at 93°C.',
        imageUrl: createDishPhotoPlaceholder('Panama Geisha V60 Pour Over', 'Filter & Espresso', '#F2EFE9', '#FFFFFF', '#1E3F2B', '#141413'),
        tag: 'Single Origin',
        prepMinutes: 5,
      },
      {
        id: 'mn-2',
        name: 'Oat Milk Flat White',
        category: 'Filter & Espresso',
        price: 4.5,
        description:
          'Double ristretto of Ethiopian heirloom espresso over micro-textured barista oat milk.',
        imageUrl: createDishPhotoPlaceholder('Oat Milk Flat White', 'Filter & Espresso', '#F2EFE9', '#FFFFFF', '#1E3F2B', '#141413'),
        prepMinutes: 3,
      },
      {
        id: 'mn-3',
        name: 'Brown Butter Cardamom Knot',
        category: 'Bakery',
        price: 5.2,
        description:
          'Laminated organic wheat dough twisted with freshly mortared green cardamom and pearl sugar.',
        imageUrl: createDishPhotoPlaceholder('Brown Butter Cardamom Knot', 'Bakery', '#F2EFE9', '#FFFFFF', '#1E3F2B', '#141413'),
        tag: 'Warm from Oven',
        prepMinutes: 2,
      },
      {
        id: 'mn-4',
        name: 'Whipped Ricotta & Fig Tartine',
        category: 'Tartines',
        price: 12.0,
        description:
          '36-hour country sourdough, lemon-thyme sheep ricotta, black mission figs, raw heather honey.',
        imageUrl: createDishPhotoPlaceholder('Whipped Ricotta & Fig Tartine', 'Tartines', '#F2EFE9', '#FFFFFF', '#1E3F2B', '#141413'),
        prepMinutes: 7,
      },
      {
        id: 'mn-5',
        name: 'Avocado & Pickled Kohlrabi Toast',
        category: 'Tartines',
        price: 13.5,
        description:
          'Seeded rye levain, smashed Hass avocado, crisp kohlrabi ribbons, toasted furikake, dill oil.',
        imageUrl: createDishPhotoPlaceholder('Avocado & Pickled Kohlrabi Toast', 'Tartines', '#F2EFE9', '#FFFFFF', '#1E3F2B', '#141413'),
        prepMinutes: 8,
      },
      {
        id: 'mn-6',
        name: 'Uji Ceremonial Matcha Tonic',
        category: 'Botanical',
        price: 6.0,
        description:
          'First-harvest Kyoto matcha whisked to order and layered over dry botanical yuzu tonic.',
        imageUrl: createDishPhotoPlaceholder('Uji Ceremonial Matcha Tonic', 'Botanical', '#F2EFE9', '#FFFFFF', '#1E3F2B', '#141413'),
        prepMinutes: 4,
      },
    ],
  },
  {
    id: 'street-style',
    indexNumber: '03',
    styleName: 'Street Style',
    defaultVenueName: 'Block 84 Smash',
    venueSubtitle: 'Late-Night Smash Burgers & Fry Joint',
    tagline: 'Condensed poster type, raw concrete contrast, and high-voltage flame orange.',
    description:
      'Engineered for high-volume smash burger joints, taco counters, food halls, and late-night street kitchens. Bold Big Shoulders Display headlines and fast one-tap combo ordering.',
    heroImage: '/src/assets/images/theme_street_style_smashburger_1794394478163.jpg',
    displayFont: '"Big Shoulders Display", sans-serif',
    bodyFont: '"Plus Jakarta Sans", sans-serif',
    cardRadius: '12px',
    buttonRadius: '8px',
    currencySymbol: '$',
    palette: {
      mode: 'dark',
      canvas: '#111111',
      surface: '#1B1B1B',
      elevated: '#252525',
      text: '#F4F2ED',
      muted: '#9E9A90',
      accent: '#FF4D00',
      accentText: '#FFFFFF',
      border: 'rgba(244, 242, 237, 0.14)',
      floorGround: '#111111',
      floorTable: '#262626',
    },
    categories: ['All', 'Smash Burgers', 'Loaded Sides', 'Hot Chicken', 'Shakes & Cans'],
    menu: [
      {
        id: 'ss-1',
        name: 'Double Oklahoma Onion Smash',
        category: 'Smash Burgers',
        price: 11.5,
        description:
          'Two lacy-edged aged chuck patties smashed with paper-thin sweet onions, double American cheese, house pickles, potato bun.',
        imageUrl: createDishPhotoPlaceholder('Double Oklahoma Onion Smash', 'Smash Burgers', '#161616', '#222222', '#FF4D00', '#F4F2ED'),
        tag: '#1 Seller',
        prepMinutes: 7,
      },
      {
        id: 'ss-2',
        name: 'Triple Jalapeño Smoke Stack',
        category: 'Smash Burgers',
        price: 14.0,
        description:
          'Three crispy smash patties, charred pickled jalapeños, Applewood bacon jam, chipotle mayo, pepper jack.',
        imageUrl: createDishPhotoPlaceholder('Triple Jalapeño Smoke Stack', 'Smash Burgers', '#161616', '#222222', '#FF4D00', '#F4F2ED'),
        tag: 'Spicy',
        prepMinutes: 8,
      },
      {
        id: 'ss-3',
        name: 'Nashville Hot Chicken Tenders (4 pc)',
        category: 'Hot Chicken',
        price: 10.5,
        description:
          'Buttermilk-brined jumbo tenders basted in cayenne chili oil, served on Texas toast with comeback sauce.',
        imageUrl: createDishPhotoPlaceholder('Nashville Hot Chicken Tenders', 'Hot Chicken', '#161616', '#222222', '#FF4D00', '#F4F2ED'),
        prepMinutes: 9,
      },
      {
        id: 'ss-4',
        name: 'Tallow Waffle Fries · Animal Style',
        category: 'Loaded Sides',
        price: 7.5,
        description:
          'Double-fried beef tallow waffle fries buried under melted cheddar, caramelized onions, and tangy burger sauce.',
        imageUrl: createDishPhotoPlaceholder('Tallow Waffle Fries', 'Loaded Sides', '#161616', '#222222', '#FF4D00', '#F4F2ED'),
        prepMinutes: 5,
      },
      {
        id: 'ss-5',
        name: 'Charred Street Corn Elote Cup',
        category: 'Loaded Sides',
        price: 6.0,
        description:
          'Fire-roasted sweet corn kernels tossed with lime crema, cotija cheese, tajín, and cilantro.',
        imageUrl: createDishPhotoPlaceholder('Charred Street Corn Elote Cup', 'Loaded Sides', '#161616', '#222222', '#FF4D00', '#F4F2ED'),
        prepMinutes: 4,
      },
      {
        id: 'ss-6',
        name: 'Salted Pretzel & Burnt Vanilla Shake',
        category: 'Shakes & Cans',
        price: 6.5,
        description:
          'Hand-spun custard milkshake with crushed salted pretzels and dark caramel swirl.',
        imageUrl: createDishPhotoPlaceholder('Salted Pretzel Vanilla Shake', 'Shakes & Cans', '#161616', '#222222', '#FF4D00', '#F4F2ED'),
        prepMinutes: 3,
      },
    ],
  },
  {
    id: 'artisanal-terracotta',
    indexNumber: '04',
    styleName: 'Artisanal Terracotta',
    defaultVenueName: 'Forno Terra',
    venueSubtitle: 'Wood-Fired Neapolitan Pizzeria & Courtyard',
    tagline: 'Warm kiln clay, 48-hour sourdough crust, and sunlit olive-wood warmth.',
    description:
      'Our curated fourth signature style: crafted for wood-fired pizzerias, Mediterranean courtyards, and farm-to-table kitchens. Expressive Fraunces serif titles on warm kiln-clay surfaces.',
    heroImage: '/src/assets/images/theme_artisanal_terracotta_pizza_1794394478827.jpg',
    displayFont: '"Fraunces", Georgia, serif',
    bodyFont: '"Plus Jakarta Sans", sans-serif',
    cardRadius: '20px',
    buttonRadius: '999px',
    currencySymbol: '$',
    palette: {
      mode: 'light',
      canvas: '#F7F1E7',
      surface: '#FFFDF9',
      elevated: '#EFE5D6',
      text: '#231811',
      muted: '#7A6352',
      accent: '#C84B24',
      accentText: '#FFFDF9',
      border: 'rgba(200, 75, 36, 0.18)',
      floorGround: '#EDE2D0',
      floorTable: '#B87A56',
    },
    categories: ['All', 'Wood-Fired Pizza', 'Antipasti', 'Dolci', 'Aperitivi'],
    menu: [
      {
        id: 'at-1',
        name: 'Margherita D.O.P. (48h Sourdough)',
        category: 'Wood-Fired Pizza',
        price: 16.0,
        description:
          'Crushed San Marzano tomatoes, fresh Fior di Latte, organic sweet basil, cold-pressed Tuscan olive oil.',
        imageUrl: createDishPhotoPlaceholder('Margherita D.O.P. Sourdough', 'Wood-Fired Pizza', '#EFE5D6', '#FFFDF9', '#C84B24', '#231811'),
        tag: '900°F Oak Oven',
        prepMinutes: 6,
      },
      {
        id: 'at-2',
        name: 'Diavola & Calabrian Hot Honey',
        category: 'Wood-Fired Pizza',
        price: 19.5,
        description:
          'Artisanal soppressata piccante, smoked provola, crushed Calabrian chili, wildflower hot honey drizzle.',
        imageUrl: createDishPhotoPlaceholder('Diavola & Calabrian Hot Honey', 'Wood-Fired Pizza', '#EFE5D6', '#FFFDF9', '#C84B24', '#231811'),
        tag: 'House Favorite',
        prepMinutes: 7,
      },
      {
        id: 'at-3',
        name: 'Stracciatella, Fig & Prosciutto',
        category: 'Wood-Fired Pizza',
        price: 21.0,
        description:
          'White Bianca base, 24-month Prosciutto di Parma, pulled Pugliese stracciatella, roasted black figs, wild arugula.',
        imageUrl: createDishPhotoPlaceholder('Stracciatella Fig & Prosciutto', 'Wood-Fired Pizza', '#EFE5D6', '#FFFDF9', '#C84B24', '#231811'),
        prepMinutes: 7,
      },
      {
        id: 'at-4',
        name: 'Wood-Roasted Nocellara Olives & Rosemary Focaccia',
        category: 'Antipasti',
        price: 9.5,
        description:
          'Warm blistered sourdough focaccia brushed with sea salt and garlic confit oil alongside Sicilian green olives.',
        imageUrl: createDishPhotoPlaceholder('Wood-Roasted Olives & Focaccia', 'Antipasti', '#EFE5D6', '#FFFDF9', '#C84B24', '#231811'),
        prepMinutes: 4,
      },
      {
        id: 'at-5',
        name: 'Bronte Pistachio Tiramisu',
        category: 'Dolci',
        price: 11.0,
        description:
          'Espresso-soaked savoiardi layered with Sicilian pistachio mascarpone cream and crushed toasted kernels.',
        imageUrl: createDishPhotoPlaceholder('Bronte Pistachio Tiramisu', 'Dolci', '#EFE5D6', '#FFFDF9', '#C84B24', '#231811'),
        prepMinutes: 4,
      },
      {
        id: 'at-6',
        name: 'Sicilian Blood Orange Spritz',
        category: 'Aperitivi',
        price: 13.0,
        description:
          'Small-batch bitter aperitivo, organic blood orange soda, Valdobbiadene Prosecco Superiore.',
        imageUrl: createDishPhotoPlaceholder('Sicilian Blood Orange Spritz', 'Aperitivi', '#EFE5D6', '#FFFDF9', '#C84B24', '#231811'),
        prepMinutes: 3,
      },
    ],
  },
];

export function getThemeById(themeId: ThemeId): ProductThemeConfig {
  return PRODUCT_THEMES.find((t) => t.id === themeId) || PRODUCT_THEMES[0];
}

export function filterThemeMenu(
  menu: ThemeMenuItem[],
  category: string,
  searchQuery: string
): ThemeMenuItem[] {
  const q = searchQuery.trim().toLowerCase();
  return menu.filter((item) => {
    const matchesCategory = category === 'All' || item.category === category;
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });
}

export function computeThemeCartSummary(
  menu: ThemeMenuItem[],
  cart: Record<string, number>
): {
  items: { item: ThemeMenuItem; qty: number; lineTotal: number }[];
  totalCount: number;
  subtotal: number;
} {
  const items: { item: ThemeMenuItem; qty: number; lineTotal: number }[] = [];
  let totalCount = 0;
  let subtotal = 0;

  for (const item of menu) {
    const qty = cart[item.id] || 0;
    if (qty > 0 && !item.soldOut) {
      const lineTotal = Number((item.price * qty).toFixed(2));
      items.push({ item, qty, lineTotal });
      totalCount += qty;
      subtotal = Number((subtotal + lineTotal).toFixed(2));
    }
  }
  return { items, totalCount, subtotal };
}

export function nextTicketStatus(
  current: LiveOrderTicket['status']
): LiveOrderTicket['status'] {
  switch (current) {
    case 'incoming':
      return 'confirmed';
    case 'confirmed':
      return 'cooking';
    case 'cooking':
      return 'ready';
    case 'ready':
      return 'served';
    case 'served':
      return 'served';
  }
}

export function updateDishInMenu(
  menu: ThemeMenuItem[],
  dishId: string,
  patch: Partial<Pick<ThemeMenuItem, 'name' | 'price' | 'description' | 'imageUrl' | 'category' | 'soldOut' | 'prepMinutes'>>
): ThemeMenuItem[] {
  return menu.map((item) => {
    if (item.id !== dishId) return item;
    return {
      ...item,
      ...patch,
      price:
        typeof patch.price === 'number' && !Number.isNaN(patch.price) && patch.price >= 0
          ? Number(patch.price.toFixed(2))
          : item.price,
    };
  });
}

export function addDishToMenu(
  menu: ThemeMenuItem[],
  newDish: Omit<ThemeMenuItem, 'id'>,
  theme: ProductThemeConfig
): ThemeMenuItem[] {
  const id = `${theme.id.slice(0, 2)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const fallbackImage =
    newDish.imageUrl && newDish.imageUrl.trim()
      ? newDish.imageUrl.trim()
      : createDishPhotoPlaceholder(
          newDish.name.trim(),
          newDish.category.trim() || 'Specials',
          theme.palette.surface,
          theme.palette.elevated,
          theme.palette.accent,
          theme.palette.text
        );

  const created: ThemeMenuItem = {
    id,
    name: newDish.name.trim(),
    category: newDish.category.trim() || 'Specials',
    price: Number(Math.max(0, newDish.price).toFixed(2)),
    description: newDish.description.trim() || 'Freshly prepared in house.',
    imageUrl: fallbackImage,
    prepMinutes: newDish.prepMinutes || 10,
    soldOut: Boolean(newDish.soldOut),
  };

  return [created, ...menu];
}
