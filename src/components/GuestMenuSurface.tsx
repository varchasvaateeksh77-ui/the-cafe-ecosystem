import React, { useRef, useState } from 'react';
import {
  CafeEcosystemState,
  DishItem,
  KitchenOrder,
  WaiterCall,
  calculateCartTotal,
} from '../lib/ecosystemStore';
import { DishImage } from './DishImage';

export interface GuestMenuSurfaceProps {
  state: CafeEcosystemState;
  isStandaloneApk: boolean;
  onAddToCart: (dish: DishItem) => void;
  onRemoveFromCart: (dishId: string) => void;
  onCallWaiter: () => void;
  onPlaceOrder: (notes: string) => void;
}

export const GuestMenuSurface: React.FC<GuestMenuSurfaceProps> = ({
  state,
  isStandaloneApk,
  onAddToCart,
  onRemoveFromCart,
  onCallWaiter,
  onPlaceOrder,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [guestStep, setGuestStep] = useState<'deck' | 'cart'>('deck');
  const [displayMode, setDisplayMode] = useState<'swipe' | 'list'>('swipe');
  const [orderNotes, setOrderNotes] = useState<string>('');

  // Swipe Deck state
  const [deckIndex, setDeckIndex] = useState<number>(0);
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const [swipeHistory, setSwipeHistory] = useState<
    Array<{ index: number; action: 'skip' | 'add'; dishId: string }>
  >([]);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);
  const [lastSwipeFeedback, setLastSwipeFeedback] = useState<{
    type: 'skip' | 'add';
    dishName: string;
  } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const categories = [
    'All',
    ...Array.from(new Set(state.dishes.filter((d) => d.isAvailable).map((d) => d.category))),
  ];
  const filteredDishes = state.dishes.filter(
    (d) => d.isAvailable && (selectedCategory === 'All' || d.category === selectedCategory)
  );
  const safeDeckIndex = Math.min(deckIndex, Math.max(0, filteredDishes.length));
  const currentDeckDish = filteredDishes[safeDeckIndex];
  const nextDeckDish = filteredDishes[safeDeckIndex + 1];

  const cartTotal = calculateCartTotal(state.cart);
  const cartCount = state.cart.reduce((sum, c) => sum + c.qty, 0);
  const activeTableCall: WaiterCall | undefined = state.waiterCalls.find(
    (c) => c.tableNumber === state.activeTable && c.status !== 'completed'
  );
  const activeTableOrder: KitchenOrder | undefined = state.orders.find(
    (o) => o.tableNumber === state.activeTable && o.status !== 'served'
  );

  const handleSelectSubSection = (cat: string) => {
    setSelectedCategory(cat);
    setDeckIndex(0);
    setDragOffset({ x: 0, y: 0 });
    setExitDirection(null);
  };

  const triggerSwipeAction = (direction: 'left' | 'right') => {
    if (!currentDeckDish || exitDirection) return;
    setExitDirection(direction);
    setDragOffset({ x: 0, y: 0 });

    if (direction === 'right') {
      if (state.serviceLevel >= 2) {
        onAddToCart(currentDeckDish);
      }
      setLastSwipeFeedback({ type: 'add', dishName: currentDeckDish.name });
    } else {
      setSkippedIds((prev) =>
        prev.includes(currentDeckDish.id) ? prev : [...prev, currentDeckDish.id]
      );
      setLastSwipeFeedback({ type: 'skip', dishName: currentDeckDish.name });
    }

    setSwipeHistory((prev) => [
      ...prev,
      {
        index: safeDeckIndex,
        action: direction === 'right' ? 'add' : 'skip',
        dishId: currentDeckDish.id,
      },
    ]);

    window.setTimeout(() => {
      setDeckIndex((idx) => idx + 1);
      setExitDirection(null);
    }, 170);
  };

  const handleUndoSwipe = () => {
    if (swipeHistory.length === 0) return;
    const last = swipeHistory[swipeHistory.length - 1];
    setSwipeHistory((prev) => prev.slice(0, -1));
    setDeckIndex(last.index);
    if (last.action === 'add' && state.serviceLevel >= 2) {
      onRemoveFromCart(last.dishId);
    } else {
      setSkippedIds((prev) => prev.filter((id) => id !== last.dishId));
    }
    setLastSwipeFeedback(null);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (exitDirection) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = (e.clientY - dragStartRef.current.y) * 0.2;
    setDragOffset({ x: dx, y: dy });
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    dragStartRef.current = null;
    if (dragOffset.x > 70) {
      triggerSwipeAction('right');
    } else if (dragOffset.x < -70) {
      triggerSwipeAction('left');
    } else {
      setDragOffset({ x: 0, y: 0 });
    }
  };

  const effectiveX =
    exitDirection === 'right' ? 300 : exitDirection === 'left' ? -300 : dragOffset.x;
  const effectiveRotate = effectiveX * 0.04;
  const showAddStamp = effectiveX > 35;
  const showSkipStamp = effectiveX < -35;

  return (
    <section
      aria-label="Guest Web Menu"
      data-testid="surface-guest-web"
      className={`bg-[#FFFFFF] text-[#181615] flex flex-col overflow-hidden ${
        isStandaloneApk
          ? 'min-h-screen'
          : 'rounded-[16px] border border-[#E4E0D8]'
      }`}
    >
      {/* Clean Linen Header */}
      <div className="px-5 py-4 border-b border-[#E4E0D8] flex items-center justify-between gap-3 bg-[#FFFFFF]">
        <div className="min-w-0">
          <div className="text-[12px] text-[#5C5852] flex items-center gap-1.5">
            <span className="font-mono-code font-medium text-[#181615]">
              Table {state.activeTable}
            </span>
            <span aria-hidden="true">·</span>
            <span>Level {state.serviceLevel}</span>
            <span aria-hidden="true">·</span>
            <span>Demo</span>
          </div>
          <h3 className="font-display text-[20px] font-semibold text-[#181615] m-0 mt-0.5 truncate">
            {state.venueName}
          </h3>
        </div>

        {state.serviceLevel >= 2 && (
          <button
            type="button"
            data-testid="header-cart-btn"
            onClick={() => setGuestStep((prev) => (prev === 'cart' ? 'deck' : 'cart'))}
            className="min-h-[40px] px-4 rounded-[10px] bg-[#181615] hover:bg-[#D9480F] text-[#FAF8F5] text-[13px] font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 tabular-nums"
          >
            {guestStep === 'cart'
              ? 'Back to Menu'
              : `Tray (${cartCount}) · ${state.currencySymbol}${cartTotal}`}
          </button>
        )}
      </div>

      {guestStep === 'cart' && state.serviceLevel >= 2 ? (
        /* Cart & Order Review Sheet */
        <div className="p-5 flex-1 flex flex-col gap-4 bg-[#FAF8F5]" data-testid="guest-cart-view">
          <div className="flex items-center justify-between border-b border-[#E4E0D8] pb-3">
            <div>
              <div className="text-[12px] font-medium text-[#D9480F]">
                Table {state.activeTable} Selection
              </div>
              <h4 className="font-display text-[19px] font-semibold text-[#181615] m-0">
                Your Table Tray ({cartCount})
              </h4>
            </div>
            <button
              type="button"
              data-testid="guest-back-to-deck-btn"
              onClick={() => setGuestStep('deck')}
              className="min-h-[36px] px-3 rounded-[8px] bg-[#FFFFFF] border border-[#E4E0D8] text-[#181615] text-[12px] font-medium cursor-pointer whitespace-nowrap"
            >
              Add More
            </button>
          </div>

          {activeTableCall && (
            <div
              role="status"
              aria-live="polite"
              data-testid="guest-cart-waiter-status"
              className={`p-3.5 rounded-[12px] border flex flex-col gap-1 ${
                activeTableCall.status === 'acknowledged'
                  ? 'bg-[#ECFDF3] border-[#15803D]/30 text-[#14532D]'
                  : 'bg-[#FFF1EB] border-[#D9480F]/30 text-[#7C2D12]'
              }`}
            >
              <div className="flex items-center justify-between text-[12px] font-semibold">
                <span>
                  {activeTableCall.status === 'acknowledged'
                    ? `Waiter is walking to Table ${state.activeTable}`
                    : `Waiter notified for Table ${state.activeTable}`}
                </span>
                <span className="font-mono-code text-[11px]">{activeTableCall.createdAt}</span>
              </div>
              <p className="text-[12px] opacity-85 m-0">
                {activeTableCall.status === 'acknowledged'
                  ? 'Staff #04 claimed your request on their handheld.'
                  : 'Your selected dishes are visible on the floor handheld.'}
              </p>
            </div>
          )}

          {state.serviceLevel === 3 && activeTableOrder && (
            <div
              role="status"
              aria-live="polite"
              data-testid="guest-cart-order-status"
              className="p-3.5 rounded-[12px] bg-[#FFFFFF] border border-[#E4E0D8] flex flex-col gap-2.5"
            >
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-mono-code font-semibold text-[#181615]">
                  Ticket {activeTableOrder.ticketNumber} · Table {state.activeTable}
                </span>
                <span className="text-[12px] font-semibold capitalize text-[#D9480F]">
                  {activeTableOrder.status === 'incoming'
                    ? 'Confirming'
                    : activeTableOrder.status}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(['new', 'cooking', 'ready', 'served'] as const).map((st) => {
                  const isCurrent = activeTableOrder.status === st;
                  return (
                    <div
                      key={st}
                      className={`text-center py-1.5 rounded-[6px] text-[11px] font-medium capitalize ${
                        isCurrent
                          ? st === 'ready'
                            ? 'bg-[#15803D] text-[#FFFFFF]'
                            : 'bg-[#181615] text-[#FAF8F5]'
                          : 'bg-[#F7F6F2] text-[#5C5852]'
                      }`}
                    >
                      {st}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {state.cart.length === 0 ? (
            <div className="py-10 text-center flex flex-col items-center gap-3 bg-[#FFFFFF] rounded-[12px] border border-[#E4E0D8] p-5">
              <p className="text-[14px] text-[#5C5852] m-0">
                Your table tray is empty. Swipe right on dishes to add them here.
              </p>
              <button
                type="button"
                onClick={() => setGuestStep('deck')}
                className="min-h-[44px] px-5 rounded-[10px] bg-[#D9480F] text-[#FFFFFF] text-[13px] font-semibold cursor-pointer"
              >
                Browse Dishes
              </button>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-[#E4E0D8] bg-[#FFFFFF] rounded-[12px] border border-[#E4E0D8] overflow-hidden">
              {state.cart.map(({ dish, qty }) => (
                <div
                  key={dish.id}
                  className="p-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-[8px] overflow-hidden bg-[#EFECE6] shrink-0">
                      <DishImage dish={dish} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-[14px] text-[#181615] truncate">
                        {dish.name}
                      </div>
                      <div className="font-mono-code text-[12px] text-[#5C5852] mt-0.5">
                        {state.currencySymbol}
                        {dish.price} × {qty} ={' '}
                        <span className="text-[#181615] font-semibold">
                          {state.currencySymbol}
                          {dish.price * qty}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onRemoveFromCart(dish.id)}
                      aria-label={`Remove one ${dish.name}`}
                      className="w-9 h-9 rounded-[8px] bg-[#F7F6F2] border border-[#E4E0D8] text-[#181615] font-semibold text-[15px] cursor-pointer"
                    >
                      −
                    </button>
                    <span className="font-mono-code text-[13px] font-semibold w-5 text-center">
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => onAddToCart(dish)}
                      aria-label={`Add one ${dish.name}`}
                      className="w-9 h-9 rounded-[8px] bg-[#181615] text-[#FAF8F5] font-semibold text-[15px] cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {state.cart.length > 0 && (
            <input
              type="text"
              aria-label="Special kitchen note"
              placeholder="Kitchen note (e.g. extra hot, oat milk, no onions)..."
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              className="w-full min-h-[42px] px-3.5 rounded-[10px] bg-[#FFFFFF] border border-[#E4E0D8] text-[13px] text-[#181615]"
            />
          )}

          <div className="mt-auto pt-3 border-t border-[#E4E0D8] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#5C5852]">
                Table {state.activeTable} Subtotal ({cartCount} items)
              </span>
              <span className="font-mono-code text-[20px] font-bold text-[#181615]">
                {state.currencySymbol}
                {cartTotal}
              </span>
            </div>

            {state.serviceLevel === 2 && (
              <button
                type="button"
                data-testid="guest-call-waiter-btn"
                onClick={onCallWaiter}
                disabled={cartCount === 0}
                className="w-full min-h-[48px] rounded-[10px] bg-[#D9480F] hover:bg-[#B83B0A] disabled:bg-[#E4E0D8] text-[#FFFFFF] text-[14px] font-semibold cursor-pointer transition-colors"
              >
                {activeTableCall?.status === 'acknowledged'
                  ? `Waiter En Route to Table ${state.activeTable}`
                  : activeTableCall?.status === 'pending'
                  ? `Ring Waiter Again (Table ${state.activeTable})`
                  : `Call the Waiter · ${state.currencySymbol}${cartTotal}`}
              </button>
            )}

            {state.serviceLevel === 3 && (
              <button
                type="button"
                data-testid="guest-send-order-btn"
                onClick={() => {
                  onPlaceOrder(orderNotes);
                  setOrderNotes('');
                }}
                disabled={cartCount === 0}
                className="w-full min-h-[48px] rounded-[10px] bg-[#D9480F] hover:bg-[#B83B0A] disabled:bg-[#E4E0D8] text-[#FFFFFF] text-[14px] font-semibold cursor-pointer transition-colors"
              >
                Send Order to Kitchen · {state.currencySymbol}
                {cartTotal}
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Swipe Deck + Sub-Sections View */
        <div className="flex-1 flex flex-col">
          {/* Sub-Sections Bar */}
          <div className="px-5 py-3 bg-[#FAF8F5] border-b border-[#E4E0D8] flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-[#5C5852]">
                {filteredDishes.length} available dishes
              </span>
              <div
                className="flex items-center gap-1 bg-[#EFECE6] p-0.5 rounded-[8px]"
                role="group"
                aria-label="Menu view mode"
              >
                <button
                  type="button"
                  onClick={() => setDisplayMode('swipe')}
                  className={`px-3 py-1 rounded-[6px] text-[12px] font-medium cursor-pointer whitespace-nowrap transition-colors ${
                    displayMode === 'swipe'
                      ? 'bg-[#FFFFFF] text-[#181615]'
                      : 'text-[#5C5852]'
                  }`}
                >
                  Swipe Deck
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayMode('list')}
                  className={`px-3 py-1 rounded-[6px] text-[12px] font-medium cursor-pointer whitespace-nowrap transition-colors ${
                    displayMode === 'list'
                      ? 'bg-[#FFFFFF] text-[#181615]'
                      : 'text-[#5C5852]'
                  }`}
                >
                  List View
                </button>
              </div>
            </div>

            <div
              className="flex items-center gap-1.5 overflow-x-auto pb-0.5"
              role="tablist"
              aria-label="Menu sub-sections"
            >
              {categories.map((cat) => {
                const count =
                  cat === 'All'
                    ? state.dishes.filter((d) => d.isAvailable).length
                    : state.dishes.filter((d) => d.category === cat && d.isAvailable).length;
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    data-testid={`subsection-tab-${cat.toLowerCase().replace(/\s+/g, '-')}`}
                    onClick={() => handleSelectSubSection(cat)}
                    className={`min-h-[34px] px-3 rounded-[8px] text-[12px] font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      active
                        ? 'bg-[#181615] text-[#FAF8F5]'
                        : 'bg-[#FFFFFF] border border-[#E4E0D8] text-[#5C5852] hover:text-[#181615]'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {displayMode === 'swipe' ? (
            <div className="p-5 flex-1 flex flex-col gap-3.5">
              <div className="flex items-center justify-between text-[12px] text-[#5C5852]">
                <span>
                  {currentDeckDish
                    ? `Card ${safeDeckIndex + 1} of ${filteredDishes.length}`
                    : `${selectedCategory} complete`}
                </span>
                <span>
                  {lastSwipeFeedback
                    ? `${lastSwipeFeedback.type === 'add' ? 'Added' : 'Skipped'}: ${lastSwipeFeedback.dishName}`
                    : 'Drag card or tap below'}
                </span>
              </div>

              {currentDeckDish ? (
                <>
                  <div className="relative h-[330px] w-full select-none">
                    {nextDeckDish && (
                      <div
                        aria-hidden="true"
                        className="absolute inset-x-3 top-2 bottom-0 rounded-[16px] bg-[#EFECE6] border border-[#E4E0D8] scale-[0.97] translate-y-2 pointer-events-none"
                      />
                    )}

                    <div
                      data-testid="active-swipe-dish-card"
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                      style={{
                        transform: `translate3d(${effectiveX}px, ${dragOffset.y}px, 0) rotate(${effectiveRotate}deg)`,
                        transition: isDragging
                          ? 'none'
                          : 'transform 170ms cubic-bezier(0.16, 1, 0.3, 1)',
                        touchAction: 'pan-y',
                      }}
                      className="relative h-full w-full rounded-[16px] bg-[#FFFFFF] border border-[#E4E0D8] overflow-hidden flex flex-col cursor-grab active:cursor-grabbing"
                    >
                      {showAddStamp && (
                        <div className="absolute top-3 left-3 z-20 px-3 py-1 rounded-[8px] bg-[#15803D] text-[#FFFFFF] text-[12px] font-semibold">
                          Add to Tray +
                        </div>
                      )}
                      {showSkipStamp && (
                        <div className="absolute top-3 right-3 z-20 px-3 py-1 rounded-[8px] bg-[#D9480F] text-[#FFFFFF] text-[12px] font-semibold">
                          Skip
                        </div>
                      )}

                      <div className="relative h-[200px] bg-[#EFECE6] overflow-hidden shrink-0">
                        <DishImage
                          dish={currentDeckDish}
                          className="w-full h-full object-cover pointer-events-none"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent pointer-events-none" />
                        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2 text-[#FFFFFF]">
                          <div className="min-w-0">
                            <div className="text-[12px] text-[#FFFFFF]/85">
                              {currentDeckDish.category} · {currentDeckDish.dietary}
                              {currentDeckDish.prepTime ? ` · ${currentDeckDish.prepTime}` : ''}
                            </div>
                            <h4 className="font-display text-[20px] font-semibold leading-tight m-0 mt-0.5 truncate">
                              {currentDeckDish.name}
                            </h4>
                          </div>
                          <span className="font-mono-code text-[18px] font-bold shrink-0">
                            {state.currencySymbol}
                            {currentDeckDish.price}
                          </span>
                        </div>
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between bg-[#FFFFFF]">
                        <p className="text-[13px] text-[#5C5852] leading-relaxed m-0 line-clamp-2">
                          {currentDeckDish.description}
                        </p>

                        <div className="flex items-center justify-between pt-2.5 border-t border-[#E4E0D8] text-[12px]">
                          <span className="text-[#5C5852]">Swipe right to add</span>
                          {state.cart.find((c) => c.dish.id === currentDeckDish.id) ? (
                            <span className="font-mono-code font-semibold text-[#15803D]">
                              In tray: {state.cart.find((c) => c.dish.id === currentDeckDish.id)?.qty}
                            </span>
                          ) : (
                            <span className="text-[#9C968E]">
                              Skipped: {skippedIds.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tactile Swipe Controls (44px+ hitboxes) */}
                  <div className="grid grid-cols-7 gap-2 pt-1">
                    <button
                      type="button"
                      data-testid="swipe-left-skip-btn"
                      onClick={() => triggerSwipeAction('left')}
                      className="col-span-3 min-h-[44px] rounded-[10px] bg-[#FAF8F5] hover:bg-[#EFECE6] border border-[#E4E0D8] text-[#181615] text-[13px] font-semibold cursor-pointer transition-colors whitespace-nowrap"
                    >
                      Skip
                    </button>

                    <button
                      type="button"
                      data-testid="swipe-undo-btn"
                      onClick={handleUndoSwipe}
                      disabled={swipeHistory.length === 0}
                      aria-label="Undo last swipe"
                      className="col-span-1 min-h-[44px] rounded-[10px] bg-[#FFFFFF] border border-[#E4E0D8] disabled:opacity-40 text-[#181615] text-[14px] font-semibold cursor-pointer"
                    >
                      ↺
                    </button>

                    <button
                      type="button"
                      data-testid="swipe-right-add-btn"
                      onClick={() => triggerSwipeAction('right')}
                      className="col-span-3 min-h-[44px] rounded-[10px] bg-[#181615] hover:bg-[#D9480F] text-[#FAF8F5] text-[13px] font-semibold cursor-pointer transition-colors whitespace-nowrap"
                    >
                      {state.serviceLevel >= 2 ? 'Add to Tray +' : 'Next Dish'}
                    </button>
                  </div>
                </>
              ) : (
                <div
                  data-testid="swipe-deck-complete"
                  className="p-6 rounded-[14px] bg-[#FAF8F5] border border-[#E4E0D8] text-center flex flex-col items-center gap-3 my-auto"
                >
                  <div className="text-[12px] font-semibold text-[#D9480F]">
                    Done Picking · {selectedCategory}
                  </div>
                  <h4 className="font-display text-[19px] font-semibold text-[#181615] m-0">
                    All {selectedCategory} dishes reviewed
                  </h4>
                  <p className="text-[13px] text-[#5C5852] m-0">
                    {cartCount} items in tray ({state.currencySymbol}
                    {cartTotal}) · {skippedIds.length} skipped
                  </p>
                  <div className="w-full flex flex-col gap-2 pt-2">
                    {state.serviceLevel >= 2 && (
                      <button
                        type="button"
                        data-testid="deck-done-open-cart-btn"
                        onClick={() => setGuestStep('cart')}
                        className="w-full min-h-[44px] rounded-[10px] bg-[#D9480F] hover:bg-[#B83B0A] text-[#FFFFFF] text-[13px] font-semibold cursor-pointer"
                      >
                        Review Tray ({cartCount} · {state.currencySymbol}
                        {cartTotal})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setDeckIndex(0);
                        setSwipeHistory([]);
                      }}
                      className="w-full min-h-[40px] rounded-[10px] bg-[#FFFFFF] border border-[#E4E0D8] text-[#181615] text-[13px] font-medium cursor-pointer"
                    >
                      Browse {selectedCategory} Again
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 flex flex-col divide-y divide-[#E4E0D8] max-h-[410px] overflow-y-auto">
              {filteredDishes.map((dish) => {
                const inCart = state.cart.find((c) => c.dish.id === dish.id);
                return (
                  <div
                    key={dish.id}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-[8px] overflow-hidden bg-[#EFECE6] shrink-0">
                        <DishImage dish={dish} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-[14px] text-[#181615] truncate">
                          {dish.name}
                        </div>
                        <div className="text-[12px] text-[#5C5852] truncate">
                          {dish.category} · {dish.dietary}
                        </div>
                        <div className="font-mono-code text-[12px] font-semibold text-[#181615] mt-0.5">
                          {state.currencySymbol}
                          {dish.price}
                        </div>
                      </div>
                    </div>

                    {state.serviceLevel >= 2 && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {inCart && inCart.qty > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => onRemoveFromCart(dish.id)}
                              aria-label={`Remove one ${dish.name}`}
                              className="w-8 h-8 rounded-[8px] bg-[#F7F6F2] border border-[#E4E0D8] text-[#181615] font-semibold cursor-pointer"
                            >
                              −
                            </button>
                            <span className="font-mono-code text-[12px] font-semibold w-5 text-center">
                              {inCart.qty}
                            </span>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => onAddToCart(dish)}
                          aria-label={`Add ${dish.name}`}
                          className="w-8 h-8 rounded-[8px] bg-[#181615] hover:bg-[#D9480F] text-[#FAF8F5] font-semibold cursor-pointer transition-colors"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Bottom Sticky Thumb Bar */}
          <div className="mt-auto px-5 py-3.5 bg-[#FAF8F5] border-t border-[#E4E0D8]">
            {state.serviceLevel === 1 ? (
              <div className="flex items-center justify-between text-[12px] text-[#5C5852]">
                <span>Level 1 · Digital Browse Only</span>
                <span>Switch to Level 2 or 3 for Tray</span>
              </div>
            ) : (
              <button
                type="button"
                data-testid="guest-open-cart-btn"
                onClick={() => setGuestStep('cart')}
                className="w-full min-h-[46px] px-4 rounded-[10px] bg-[#181615] hover:bg-[#D9480F] text-[#FAF8F5] text-[13px] font-semibold cursor-pointer transition-colors flex items-center justify-between"
              >
                <span>Done Picking · Click Cart ({cartCount})</span>
                <span className="font-mono-code">
                  {state.currencySymbol}
                  {cartTotal} →
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
