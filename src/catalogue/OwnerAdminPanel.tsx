import React, { useState } from 'react';
import {
  ProductThemeConfig,
  ThemeMenuItem,
  addDishToMenu,
  updateDishInMenu,
} from './themeCatalogData';

interface OwnerAdminPanelProps {
  theme: ProductThemeConfig;
  menu: ThemeMenuItem[];
  isUnlocked: boolean;
  onUnlock: () => void;
  onUpdateMenu: (nextMenu: ThemeMenuItem[]) => void;
  onClose: () => void;
}

export const OwnerAdminPanel: React.FC<OwnerAdminPanelProps> = ({
  theme,
  menu,
  isUnlocked,
  onUnlock,
  onUpdateMenu,
  onClose,
}) => {
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);

  // New Dish Form State
  const [newName, setNewName] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>(
    theme.categories.find((c) => c !== 'All') || 'Specials'
  );
  const [newPrice, setNewPrice] = useState<string>('16.00');
  const [newPrep, setNewPrep] = useState<string>('10');
  const [newDescription, setNewDescription] = useState<string>('');
  const [newImageUrl, setNewImageUrl] = useState<string>('');
  const [adminToast, setAdminToast] = useState<string | null>(null);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === '1234') {
      setPinError(null);
      onUnlock();
    } else {
      setPinError('Incorrect PIN. Default owner demo PIN is 1234.');
    }
  };

  const handleFileUploadToDataUrl = (
    file: File | undefined,
    onResult: (dataUrl: string) => void
  ) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onResult(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddNewDish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const parsedPrice = parseFloat(newPrice);
    const parsedPrep = parseInt(newPrep, 10);

    const updated = addDishToMenu(
      menu,
      {
        name: newName.trim(),
        category: newCategory.trim() || 'Specials',
        price: Number.isNaN(parsedPrice) ? 15.0 : parsedPrice,
        prepMinutes: Number.isNaN(parsedPrep) ? 10 : parsedPrep,
        description:
          newDescription.trim() || 'Prepared fresh to order in our kitchen.',
        imageUrl: newImageUrl.trim(),
      },
      theme
    );

    onUpdateMenu(updated);
    setAdminToast(`Added "${newName.trim()}" to ${theme.defaultVenueName} menu.`);
    setNewName('');
    setNewDescription('');
    setNewImageUrl('');
  };

  const handlePriceChange = (dishId: string, rawPrice: string) => {
    const val = parseFloat(rawPrice);
    if (Number.isNaN(val) || val < 0) return;
    onUpdateMenu(updateDishInMenu(menu, dishId, { price: val }));
    setAdminToast('Updated dish price live.');
  };

  const handleDishPhotoChange = (dishId: string, dataUrl: string) => {
    onUpdateMenu(updateDishInMenu(menu, dishId, { imageUrl: dataUrl }));
    setAdminToast('Updated dish photo live.');
  };

  const handleToggleSoldOut = (dishId: string, currentSoldOut?: boolean) => {
    onUpdateMenu(updateDishInMenu(menu, dishId, { soldOut: !currentSoldOut }));
    setAdminToast('Updated dish stock status.');
  };

  const handleDeleteDish = (dishId: string, dishName: string) => {
    onUpdateMenu(menu.filter((d) => d.id !== dishId));
    setAdminToast(`Removed "${dishName}" from menu.`);
  };

  if (!isUnlocked) {
    return (
      <section
        aria-label="Owner Admin PIN Unlock"
        style={{
          backgroundColor: theme.palette.surface,
          borderColor: theme.palette.border,
          borderRadius: theme.cardRadius,
        }}
        className="max-w-[480px] mx-auto p-8 border space-y-6"
      >
        <div className="flex items-center justify-between">
          <span
            className="font-mono-code text-[11px] uppercase tracking-[0.16em]"
            style={{ color: theme.palette.accent }}
          >
            HIDDEN OWNER ADMIN · PIN REQUIRED
          </span>
          <button
            type="button"
            onClick={onClose}
            className="font-mono-code text-[12px] underline cursor-pointer"
          >
            Close
          </button>
        </div>

        <div>
          <h1
            style={{ fontFamily: theme.displayFont }}
            className="text-[30px] font-bold leading-tight"
          >
            Unlock Menu &amp; Price Manager
          </h1>
          <p className="text-[14px] mt-1" style={{ color: theme.palette.muted }}>
            Hidden from table guests. Enter owner PIN <strong className="font-mono-code">1234</strong> (or tap quick unlock below) to edit prices, upload dish photos, and add new dishes.
          </p>
        </div>

        <form onSubmit={handlePinSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="owner-pin-input"
              className="block font-mono-code text-[11px] uppercase tracking-[0.12em] mb-1.5"
              style={{ color: theme.palette.muted }}
            >
              Owner PIN
            </label>
            <input
              id="owner-pin-input"
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter 1234..."
              style={{
                backgroundColor: theme.palette.canvas,
                borderColor: theme.palette.border,
                color: theme.palette.text,
                borderRadius: theme.buttonRadius,
              }}
              className="w-full px-4 py-2.5 border font-mono-code text-[16px]"
            />
            {pinError && (
              <p className="text-[12px] text-[#E8500C] mt-1">{pinError}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              style={{
                backgroundColor: theme.palette.accent,
                color: theme.palette.accentText,
                borderRadius: theme.buttonRadius,
              }}
              className="px-6 py-3 font-mono-code text-[12px] font-bold uppercase tracking-[0.1em] cursor-pointer"
            >
              Unlock Admin →
            </button>

            <button
              type="button"
              onClick={onUnlock}
              style={{
                borderColor: theme.palette.border,
                color: theme.palette.text,
                borderRadius: theme.buttonRadius,
              }}
              className="px-4 py-3 border font-mono-code text-[11px] uppercase tracking-[0.08em] cursor-pointer"
            >
              One-Tap Demo Unlock (PIN 1234)
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section
      aria-label="Owner Admin Panel"
      className="max-w-[960px] mx-auto space-y-10"
    >
      {/* Header */}
      <div
        style={{ borderColor: theme.palette.border }}
        className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b"
      >
        <div>
          <span
            className="font-mono-code text-[11px] uppercase tracking-[0.16em] block mb-1"
            style={{ color: theme.palette.accent }}
          >
            OWNER ADMIN PANEL · LIVE BACKEND SYNC (/API/MENU)
          </span>
          <h1
            style={{ fontFamily: theme.displayFont }}
            className="text-[34px] md:text-[42px] font-bold leading-tight"
          >
            {theme.defaultVenueName} · Menu &amp; Photo Studio
          </h1>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            backgroundColor: theme.palette.accent,
            color: theme.palette.accentText,
            borderRadius: theme.buttonRadius,
          }}
          className="px-5 py-2.5 font-mono-code text-[12px] font-semibold uppercase tracking-[0.08em] cursor-pointer"
        >
          ← Back to Guest Swipe Deck
        </button>
      </div>

      {adminToast && (
        <div
          role="status"
          style={{
            backgroundColor: theme.palette.surface,
            borderColor: theme.palette.accent,
            borderRadius: theme.buttonRadius,
          }}
          className="px-5 py-3.5 border flex items-center justify-between"
        >
          <span className="font-mono-code text-[13px]">{adminToast}</span>
          <button
            type="button"
            onClick={() => setAdminToast(null)}
            className="font-mono-code text-[11px] uppercase underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 1. Add New Dish Card */}
      <form
        onSubmit={handleAddNewDish}
        style={{
          backgroundColor: theme.palette.surface,
          borderColor: theme.palette.border,
          borderRadius: theme.cardRadius,
        }}
        className="p-6 md:p-8 border space-y-6"
      >
        <div className="flex items-center justify-between">
          <h2
            style={{ fontFamily: theme.displayFont }}
            className="text-[24px] font-bold"
          >
            + Add New Dish to Swipe Deck
          </h2>
          <span
            className="font-mono-code text-[11px] uppercase tracking-[0.12em]"
            style={{ color: theme.palette.muted }}
          >
            Pushes to Guest Phones Immediately
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-5">
            <label
              htmlFor="admin-new-dish-name"
              className="block font-mono-code text-[11px] uppercase tracking-[0.1em] mb-1"
              style={{ color: theme.palette.muted }}
            >
              Dish Name *
            </label>
            <input
              id="admin-new-dish-name"
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Wood-Fired Burrata Flatbread"
              style={{
                backgroundColor: theme.palette.canvas,
                borderColor: theme.palette.border,
                color: theme.palette.text,
                borderRadius: theme.buttonRadius,
              }}
              className="w-full px-3.5 py-2.5 border text-[14px]"
            />
          </div>

          <div className="md:col-span-3">
            <label
              htmlFor="admin-new-dish-category"
              className="block font-mono-code text-[11px] uppercase tracking-[0.1em] mb-1"
              style={{ color: theme.palette.muted }}
            >
              Category
            </label>
            <select
              id="admin-new-dish-category"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              style={{
                backgroundColor: theme.palette.canvas,
                borderColor: theme.palette.border,
                color: theme.palette.text,
                borderRadius: theme.buttonRadius,
              }}
              className="w-full px-3 py-2.5 border text-[14px]"
            >
              {theme.categories
                .filter((c) => c !== 'All')
                .map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="admin-new-dish-price"
              className="block font-mono-code text-[11px] uppercase tracking-[0.1em] mb-1"
              style={{ color: theme.palette.muted }}
            >
              Price ({theme.currencySymbol})
            </label>
            <input
              id="admin-new-dish-price"
              type="number"
              step="0.5"
              min="0"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              style={{
                backgroundColor: theme.palette.canvas,
                borderColor: theme.palette.border,
                color: theme.palette.text,
                borderRadius: theme.buttonRadius,
              }}
              className="w-full px-3 py-2.5 border font-mono-code text-[14px] tabular-nums"
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="admin-new-dish-prep"
              className="block font-mono-code text-[11px] uppercase tracking-[0.1em] mb-1"
              style={{ color: theme.palette.muted }}
            >
              Prep (Min)
            </label>
            <input
              id="admin-new-dish-prep"
              type="number"
              min="1"
              value={newPrep}
              onChange={(e) => setNewPrep(e.target.value)}
              style={{
                backgroundColor: theme.palette.canvas,
                borderColor: theme.palette.border,
                color: theme.palette.text,
                borderRadius: theme.buttonRadius,
              }}
              className="w-full px-3 py-2.5 border font-mono-code text-[14px] tabular-nums"
            />
          </div>

          <div className="md:col-span-6">
            <label
              htmlFor="admin-new-dish-desc"
              className="block font-mono-code text-[11px] uppercase tracking-[0.1em] mb-1"
              style={{ color: theme.palette.muted }}
            >
              Short Description
            </label>
            <input
              id="admin-new-dish-desc"
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Ingredients, tasting notes, or dietary info..."
              style={{
                backgroundColor: theme.palette.canvas,
                borderColor: theme.palette.border,
                color: theme.palette.text,
                borderRadius: theme.buttonRadius,
              }}
              className="w-full px-3.5 py-2.5 border text-[14px]"
            />
          </div>

          <div className="md:col-span-6">
            <label
              htmlFor="admin-new-dish-photo-url"
              className="block font-mono-code text-[11px] uppercase tracking-[0.1em] mb-1"
              style={{ color: theme.palette.muted }}
            >
              Dish Photo (Upload File or Paste Image URL)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="admin-new-dish-photo-url"
                type="text"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="Paste URL or leave blank for auto plate placeholder..."
                style={{
                  backgroundColor: theme.palette.canvas,
                  borderColor: theme.palette.border,
                  color: theme.palette.text,
                  borderRadius: theme.buttonRadius,
                }}
                className="flex-1 px-3.5 py-2.5 border text-[13px]"
              />
              <label
                style={{
                  borderColor: theme.palette.border,
                  color: theme.palette.text,
                  borderRadius: theme.buttonRadius,
                }}
                className="px-3.5 py-2.5 border font-mono-code text-[11px] uppercase tracking-[0.08em] cursor-pointer shrink-0"
              >
                Upload Photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) =>
                    handleFileUploadToDataUrl(e.target.files?.[0], (url) =>
                      setNewImageUrl(url)
                    )
                  }
                />
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            style={{
              backgroundColor: theme.palette.accent,
              color: theme.palette.accentText,
              borderRadius: theme.buttonRadius,
            }}
            className="px-7 py-3 font-mono-code text-[12px] font-bold uppercase tracking-[0.1em] cursor-pointer"
          >
            + Add Dish to Menu
          </button>
        </div>
      </form>

      {/* 2. Existing Dishes Editor (Update Prices, Photos, Stock) */}
      <div className="space-y-4">
        <h2
          className="font-mono-code text-[12px] uppercase tracking-[0.14em]"
          style={{ color: theme.palette.muted }}
        >
          Existing Dishes ({menu.length}) · Edit Price or Upload Photo
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {menu.map((dish) => (
            <div
              key={dish.id}
              style={{
                backgroundColor: theme.palette.surface,
                borderColor: theme.palette.border,
                borderRadius: theme.cardRadius,
              }}
              className="p-5 border flex flex-col justify-between gap-4"
            >
              <div className="flex items-start gap-4">
                <img
                  src={dish.imageUrl}
                  alt={dish.name}
                  className="w-24 h-20 rounded-[10px] object-cover border shrink-0"
                  style={{ borderColor: theme.palette.border }}
                />

                <div className="flex-1 min-w-0">
                  <span
                    className="font-mono-code text-[10px] uppercase tracking-[0.12em] block"
                    style={{ color: theme.palette.muted }}
                  >
                    {dish.category}
                  </span>
                  <h3
                    style={{ fontFamily: theme.displayFont }}
                    className="text-[20px] font-bold leading-snug truncate"
                  >
                    {dish.name}
                  </h3>

                  {/* Inline Price Editor */}
                  <div className="mt-2 flex items-center gap-2">
                    <label
                      htmlFor={`price-${dish.id}`}
                      className="font-mono-code text-[11px]"
                      style={{ color: theme.palette.muted }}
                    >
                      Price ({theme.currencySymbol}):
                    </label>
                    <input
                      id={`price-${dish.id}`}
                      type="number"
                      step="0.5"
                      min="0"
                      value={dish.price}
                      onChange={(e) => handlePriceChange(dish.id, e.target.value)}
                      style={{
                        backgroundColor: theme.palette.canvas,
                        borderColor: theme.palette.border,
                        color: theme.palette.accent,
                        borderRadius: '6px',
                      }}
                      className="w-24 px-2.5 py-1 border font-mono-code text-[14px] font-bold tabular-nums"
                    />
                  </div>
                </div>
              </div>

              {/* Photo Upload + Stock + Delete Controls */}
              <div
                style={{ borderColor: theme.palette.border }}
                className="pt-3 border-t flex flex-wrap items-center justify-between gap-2"
              >
                <label
                  style={{
                    borderColor: theme.palette.border,
                    color: theme.palette.text,
                    borderRadius: theme.buttonRadius,
                  }}
                  className="px-3 py-1.5 border font-mono-code text-[11px] uppercase tracking-[0.08em] cursor-pointer"
                >
                  Change Photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      handleFileUploadToDataUrl(e.target.files?.[0], (url) =>
                        handleDishPhotoChange(dish.id, url)
                      )
                    }
                  />
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleSoldOut(dish.id, dish.soldOut)}
                    style={{
                      borderColor: theme.palette.border,
                      color: dish.soldOut
                        ? '#E8500C'
                        : theme.palette.accent,
                      borderRadius: theme.buttonRadius,
                    }}
                    className="px-3 py-1.5 border font-mono-code text-[11px] uppercase tracking-[0.08em] cursor-pointer"
                  >
                    {dish.soldOut ? 'Sold Out' : 'In Stock'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteDish(dish.id, dish.name)}
                    style={{
                      borderColor: theme.palette.border,
                      color: theme.palette.muted,
                      borderRadius: theme.buttonRadius,
                    }}
                    className="px-2.5 py-1.5 border font-mono-code text-[11px] uppercase cursor-pointer hover:text-[#E8500C]"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
