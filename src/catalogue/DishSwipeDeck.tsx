import React, { useState, useRef, useEffect } from 'react';
import {
  ProductThemeConfig,
  ServiceLevel,
  ThemeMenuItem,
} from './themeCatalogData';

interface DishSwipeDeckProps {
  theme: ProductThemeConfig;
  dishes: ThemeMenuItem[];
  cart: Record<string, number>;
  serviceLevel: ServiceLevel;
  totalCartCount: number;
  totalCartSubtotal: number;
  onAddDish: (dishId: string) => void;
  onOpenCart: () => void;
  onSwitchToListView: () => void;
}

export const DishSwipeDeck: React.FC<DishSwipeDeckProps> = ({
  theme,
  dishes,
  cart,
  serviceLevel,
  totalCartCount,
  totalCartSubtotal,
  onAddDish,
  onOpenCart,
  onSwitchToListView,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [dragX, setDragX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [flyDirection, setFlyDirection] = useState<'left' | 'right' | null>(null);
  const [lastActionText, setLastActionText] = useState<string | null>(null);

  const startXRef = useRef<number | null>(null);

  // Reset deck index when category filter changes
  useEffect(() => {
    setCurrentIndex(0);
    setDragX(0);
    setFlyDirection(null);
  }, [dishes.length, theme.id]);

  const currentDish = dishes[currentIndex];
  const nextDish = dishes[currentIndex + 1];

  const triggerSwipe = (direction: 'left' | 'right') => {
    if (!currentDish || flyDirection) return;

    if (direction === 'right' && !currentDish.soldOut && serviceLevel >= 2) {
      onAddDish(currentDish.id);
      setLastActionText(`Added "${currentDish.name}" to your cart`);
    } else if (direction === 'left') {
      setLastActionText(`Skipped "${currentDish.name}"`);
    }

    setFlyDirection(direction);
    setDragX(direction === 'right' ? 420 : -420);

    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      setFlyDirection(null);
      setDragX(0);
    }, 210);
  };

  const handleUndo = () => {
    if (currentIndex <= 0 || flyDirection) return;
    setCurrentIndex((prev) => Math.max(0, prev - 1));
    setLastActionText('Rewound to previous dish');
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (flyDirection) return;
    // Ignore pointer down if clicking a button inside the card
    if ((e.target as HTMLElement).closest('button')) return;
    startXRef.current = e.clientX;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || startXRef.current === null) return;
    const deltaX = e.clientX - startXRef.current;
    setDragX(deltaX);
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    startXRef.current = null;

    const SWIPE_THRESHOLD = 85;
    if (dragX >= SWIPE_THRESHOLD) {
      triggerSwipe('right');
    } else if (dragX <= -SWIPE_THRESHOLD) {
      triggerSwipe('left');
    } else {
      setDragX(0);
    }
  };

  if (dishes.length === 0) {
    return (
      <div
        style={{
          backgroundColor: theme.palette.surface,
          borderColor: theme.palette.border,
          borderRadius: theme.cardRadius,
        }}
        className="p-10 border text-center"
      >
        <p className="text-[16px]">No dishes in this category.</p>
      </div>
    );
  }

  // Completed all cards in the current deck
  if (!currentDish) {
    return (
      <div
        style={{
          backgroundColor: theme.palette.surface,
          borderColor: theme.palette.border,
          borderRadius: theme.cardRadius,
        }}
        className="max-w-[520px] mx-auto p-8 md:p-10 border text-center space-y-6"
      >
        <span
          className="font-mono-code text-[11px] uppercase tracking-[0.16em] block"
          style={{ color: theme.palette.accent }}
        >
          DECK COMPLETE · {dishes.length} DISHES VIEWED
        </span>

        <h2
          style={{ fontFamily: theme.displayFont }}
          className="text-[30px] md:text-[36px] font-bold leading-tight"
        >
          {totalCartCount > 0
            ? `You have ${totalCartCount} ${totalCartCount === 1 ? 'dish' : 'dishes'} in your cart.`
            : "You've browsed the full deck."}
        </h2>

        <p className="text-[15px]" style={{ color: theme.palette.muted }}>
          {totalCartCount > 0
            ? `Ready to review your Table selection (${theme.currencySymbol}${totalCartSubtotal.toFixed(2)}) or swipe through the dishes again?`
            : 'Swipe through the deck again or view the full menu list.'}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {serviceLevel >= 2 && totalCartCount > 0 && (
            <button
              type="button"
              onClick={onOpenCart}
              style={{
                backgroundColor: theme.palette.accent,
                color: theme.palette.accentText,
                borderRadius: theme.buttonRadius,
              }}
              className="w-full sm:w-auto px-7 py-3.5 font-mono-code text-[12px] font-bold uppercase tracking-[0.1em] cursor-pointer"
            >
              View Cart &amp; Place Order ({totalCartCount}) →
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setCurrentIndex(0);
              setLastActionText(null);
            }}
            style={{
              borderColor: theme.palette.border,
              color: theme.palette.text,
              borderRadius: theme.buttonRadius,
            }}
            className="w-full sm:w-auto px-5 py-3.5 border font-mono-code text-[12px] uppercase tracking-[0.08em] cursor-pointer"
          >
            Swipe Deck Again ↻
          </button>

          <button
            type="button"
            onClick={onSwitchToListView}
            style={{
              borderColor: theme.palette.border,
              color: theme.palette.muted,
              borderRadius: theme.buttonRadius,
            }}
            className="w-full sm:w-auto px-5 py-3.5 border font-mono-code text-[12px] uppercase tracking-[0.08em] cursor-pointer"
          >
            Full List View
          </button>
        </div>
      </div>
    );
  }

  const inCartQty = cart[currentDish.id] || 0;
  const rotation = dragX * 0.038;
  const rightStampOpacity = Math.min(1, Math.max(0, (dragX - 25) / 70));
  const leftStampOpacity = Math.min(1, Math.max(0, (-dragX - 25) / 70));

  return (
    <div className="max-w-[540px] mx-auto space-y-6 select-none">
      {/* Top Deck Progress & Instructions Strip */}
      <div className="flex items-center justify-between gap-2 px-1">
        <span
          className="font-mono-code text-[11px] uppercase tracking-[0.14em] tabular-nums"
          style={{ color: theme.palette.muted }}
        >
          Dish {currentIndex + 1} of {dishes.length} · {currentDish.category}
        </span>

        <span
          className="font-mono-code text-[11px] uppercase tracking-[0.12em]"
          style={{ color: theme.palette.accent }}
        >
          ← Swipe Left to Skip · Swipe Right for Cart →
        </span>
      </div>

      {/* Card Stack Container */}
      <div className="relative min-h-[470px] flex items-stretch justify-center">
        {/* Background Next Card Preview for Depth */}
        {nextDish && (
          <div
            aria-hidden="true"
            style={{
              backgroundColor: theme.palette.surface,
              borderColor: theme.palette.border,
              borderRadius: theme.cardRadius,
              transform: 'scale(0.95) translateY(14px)',
              opacity: 0.55,
            }}
            className="absolute inset-0 border overflow-hidden pointer-events-none transition-transform"
          >
            <div className="h-60 w-full overflow-hidden">
              <img
                src={nextDish.imageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}

        {/* Active Foreground Swipeable Dish Card */}
        <article
          data-testid="active-swipe-card"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            backgroundColor: theme.palette.surface,
            borderColor:
              dragX > 45
                ? theme.palette.accent
                : dragX < -45
                ? theme.palette.muted
                : theme.palette.border,
            borderRadius: theme.cardRadius,
            transform: `translate3d(${dragX}px, 0, 0) rotate(${rotation}deg)`,
            transition: isDragging
              ? 'none'
              : 'transform 210ms cubic-bezier(0.22, 1, 0.36, 1), border-color 150ms ease',
            touchAction: 'pan-y',
          }}
          className="relative z-10 w-full border-2 overflow-hidden flex flex-col justify-between cursor-grab active:cursor-grabbing"
        >
          {/* Dish Photo Frame with Live Swipe Stamps */}
          <div
            className="relative h-64 md:h-72 w-full overflow-hidden border-b"
            style={{
              backgroundColor: theme.palette.elevated,
              borderColor: theme.palette.border,
            }}
          >
            <img
              src={currentDish.imageUrl}
              alt={currentDish.name}
              draggable={false}
              className="w-full h-full object-cover pointer-events-none"
            />

            {/* Top Overlay Metadata */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2 pointer-events-none">
              <span className="px-3 py-1 rounded-full bg-black/70 text-[#FBEFE6] font-mono-code text-[11px] uppercase tracking-[0.12em]">
                {currentDish.category} · {currentDish.prepMinutes}m
              </span>

              <span
                style={{
                  backgroundColor: theme.palette.accent,
                  color: theme.palette.accentText,
                }}
                className="px-3.5 py-1 rounded-full font-mono-code text-[15px] font-bold tabular-nums"
              >
                {theme.currencySymbol}
                {currentDish.price.toFixed(2)}
              </span>
            </div>

            {/* In-Cart Indicator Badge */}
            {inCartQty > 0 && (
              <div className="absolute bottom-3 right-4 px-3 py-1 rounded-full bg-black/80 text-[#9BE564] font-mono-code text-[11px] font-semibold uppercase tracking-[0.1em]">
                In Cart: {inCartQty}×
              </div>
            )}

            {/* SWIPE RIGHT STAMP (ADD TO CART) */}
            <div
              style={{
                opacity: rightStampOpacity,
                borderColor: '#9BE564',
                color: '#9BE564',
              }}
              className="absolute top-16 left-6 px-4 py-1.5 rounded-[8px] border-2 bg-black/80 font-mono-code text-[15px] font-bold uppercase tracking-[0.14em] -rotate-12 pointer-events-none"
            >
              ADD TO CART +
            </div>

            {/* SWIPE LEFT STAMP (SKIP) */}
            <div
              style={{
                opacity: leftStampOpacity,
                borderColor: '#FBEFE6',
                color: '#FBEFE6',
              }}
              className="absolute top-16 right-6 px-4 py-1.5 rounded-[8px] border-2 bg-black/80 font-mono-code text-[15px] font-bold uppercase tracking-[0.14em] rotate-12 pointer-events-none"
            >
              SKIP ←
            </div>
          </div>

          {/* Dish Copy & Details */}
          <div className="p-6 md:p-7 space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <h2
                style={{ fontFamily: theme.displayFont }}
                className="text-[26px] md:text-[32px] font-bold leading-tight"
              >
                {currentDish.name}
              </h2>
            </div>

            <p
              className="text-[15px] leading-relaxed"
              style={{ color: theme.palette.muted }}
            >
              {currentDish.description}
            </p>
          </div>
        </article>
      </div>

      {/* Tactile Swipe Controls Bar (Left = Skip, Center = Undo, Right = Add to Cart) */}
      <div className="grid grid-cols-12 gap-3 items-center pt-1">
        <button
          type="button"
          onClick={() => triggerSwipe('left')}
          style={{
            backgroundColor: theme.palette.surface,
            borderColor: theme.palette.border,
            color: theme.palette.text,
            borderRadius: theme.buttonRadius,
          }}
          className="col-span-5 py-3.5 px-4 border font-mono-code text-[12px] font-semibold uppercase tracking-[0.08em] cursor-pointer hover:opacity-90"
        >
          ← Swipe Left · Skip
        </button>

        <button
          type="button"
          disabled={currentIndex === 0}
          onClick={handleUndo}
          style={{
            backgroundColor: theme.palette.surface,
            borderColor: theme.palette.border,
            color: theme.palette.muted,
            borderRadius: theme.buttonRadius,
          }}
          className="col-span-2 py-3.5 border font-mono-code text-[11px] uppercase tracking-[0.08em] cursor-pointer disabled:opacity-35"
          title="Previous dish"
        >
          Undo
        </button>

        <button
          type="button"
          disabled={currentDish.soldOut}
          onClick={() => triggerSwipe('right')}
          style={{
            backgroundColor: theme.palette.accent,
            color: theme.palette.accentText,
            borderRadius: theme.buttonRadius,
          }}
          className="col-span-5 py-3.5 px-4 font-mono-code text-[12px] font-bold uppercase tracking-[0.08em] cursor-pointer hover:opacity-95 disabled:opacity-40"
        >
          {currentDish.soldOut
            ? 'Sold Out'
            : serviceLevel === 1
            ? 'Next Dish →'
            : 'Swipe Right · + Cart →'}
        </button>
      </div>

      {/* Subtle Feedback Line */}
      {lastActionText && (
        <p
          role="status"
          aria-live="polite"
          className="text-center font-mono-code text-[12px]"
          style={{ color: theme.palette.muted }}
        >
          {lastActionText}
        </p>
      )}
    </div>
  );
};
