import React, { useState } from 'react';
import {
  CartEntry,
  DishItem,
  OrderStatus,
  ServiceLevel,
  calculateCartTotal,
  formatPrice,
} from './demoStore';

interface PhoneWindowProps {
  level: ServiceLevel;
  dishes: DishItem[];
  cart: CartEntry[];
  onAddDish?: (dish: DishItem) => void;
  onRemoveDish?: (dishId: string) => void;
  onCallWaiter?: () => void;
  onPlaceOrder?: () => void;
  waiterCalled?: boolean;
  waiterAcknowledged?: boolean;
  orderStatus?: OrderStatus;
  ticketNumber?: string;
  compact?: boolean;
}

export const PhoneWindow: React.FC<PhoneWindowProps> = ({
  level,
  dishes,
  cart,
  onAddDish,
  onRemoveDish,
  onCallWaiter,
  onPlaceOrder,
  waiterCalled = false,
  waiterAcknowledged = false,
  orderStatus = 'Idle',
  ticketNumber = '#0412',
  compact = false,
}) => {
  const categories = ['All', ...Array.from(new Set(dishes.map((d) => d.category)))];
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const visibleDishes =
    selectedCategory === 'All'
      ? dishes
      : dishes.filter((d) => d.category === selectedCategory);

  const total = calculateCartTotal(cart);
  const itemCount = cart.reduce((sum, c) => sum + c.qty, 0);

  return (
    <div
      className={`bg-[#FFFFFF] text-[#1A0C06] rounded-[24px] border-2 border-[#E3D9D3] overflow-hidden flex flex-col ${
        compact ? 'w-full max-w-[300px] text-[13px]' : 'w-full max-w-[340px]'
      }`}
      data-testid="phone-window"
    >
      {/* Top browser bar */}
      <div className="bg-[#F7F2ED] px-4 py-2.5 border-b border-[#E3D9D3] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-[13px] text-[#1A0C06] truncate">
            Menu · Table 5
          </span>
        </div>
        <span className="px-2 py-0.5 rounded-[6px] bg-[#F3ECE5] text-[#C03E0A] font-mono-code text-[11px] font-semibold uppercase tracking-wide shrink-0">
          Demo
        </span>
      </div>

      {/* Category filter row */}
      <div className="px-3.5 pt-2.5 pb-1.5 flex items-center gap-1.5 overflow-x-auto border-b border-[#E3D9D3]/60">
        {categories.map((cat) => {
          const active = cat === selectedCategory;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-[8px] text-[12px] font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                active
                  ? 'bg-[#1A0C06] text-[#FBEFE6]'
                  : 'bg-[#F3ECE5] text-[#6C625C] hover:text-[#1A0C06]'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Dish rows */}
      <div className={`px-3.5 py-2 flex flex-col gap-2 ${compact ? 'max-h-[175px]' : 'max-h-[235px]'} overflow-y-auto`}>
        {visibleDishes.map((dish) => {
          const inCart = cart.find((c) => c.dish.id === dish.id);
          return (
            <div
              key={dish.id}
              className={`flex items-center justify-between gap-2.5 p-2 rounded-[12px] border border-[#E3D9D3] bg-[#F7F2ED]/50 ${
                dish.soldOut ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Flat drawn plate SVG */}
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 32 32"
                  fill="none"
                  aria-hidden="true"
                  className="shrink-0"
                >
                  <circle cx="16" cy="16" r="14" fill="#F3ECE5" stroke="#E3D9D3" strokeWidth="1.5" />
                  <circle cx="16" cy="16" r="8.5" fill={dish.plateColor} />
                </svg>
                <div className="min-w-0">
                  <div className="font-semibold text-[13px] text-[#1A0C06] truncate">
                    {dish.name}
                  </div>
                  <div className="text-[12px] text-[#6C625C] font-mono-code tabular-nums">
                    {dish.soldOut ? 'Sold out' : formatPrice(dish.price)}
                  </div>
                </div>
              </div>

              {level >= 2 && !dish.soldOut && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {inCart && inCart.qty > 0 && onRemoveDish && (
                    <button
                      type="button"
                      onClick={() => onRemoveDish(dish.id)}
                      aria-label={`Remove one ${dish.name}`}
                      className="w-6 h-6 rounded-[6px] bg-[#F3ECE5] text-[#1A0C06] font-bold text-[13px] flex items-center justify-center hover:bg-[#E3D9D3] cursor-pointer"
                    >
                      -
                    </button>
                  )}
                  {inCart && inCart.qty > 0 && (
                    <span className="text-[12px] font-mono-code font-semibold w-4 text-center tabular-nums">
                      {inCart.qty}
                    </span>
                  )}
                  {onAddDish && (
                    <button
                      type="button"
                      onClick={() => onAddDish(dish)}
                      aria-label={`Add ${dish.name} to cart`}
                      className="px-2.5 h-6 rounded-[6px] bg-[#1A0C06] text-[#FBEFE6] font-semibold text-[12px] hover:bg-[#E8500C] transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer / Cart & Action */}
      <div className="px-4 py-3 bg-[#F7F2ED] border-t border-[#E3D9D3] flex flex-col gap-2">
        {level === 1 && (
          <div className="flex items-center justify-between text-[12px] text-[#6C625C]">
            <span>Level 1 · Digital menu</span>
            <span className="font-mono-code">No app needed</span>
          </div>
        )}

        {level >= 2 && (
          <>
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-semibold text-[#1A0C06]">
                Your cart ({itemCount})
              </span>
              <span
                className="font-mono-code font-bold text-[#1A0C06] tabular-nums"
                data-testid="phone-cart-total"
              >
                {formatPrice(total)}
              </span>
            </div>

            {level === 2 && (
              <button
                type="button"
                onClick={onCallWaiter}
                disabled={itemCount === 0}
                className={`w-full h-10 rounded-[10px] font-semibold text-[14px] transition-colors cursor-pointer ${
                  waiterAcknowledged
                    ? 'bg-[#1A0C06] text-[#FBEFE6]'
                    : waiterCalled
                    ? 'bg-[#C03E0A] text-[#FBEFE6]'
                    : itemCount === 0
                    ? 'bg-[#E3D9D3] text-[#6C625C] cursor-not-allowed'
                    : 'bg-[#E8500C] text-[#FBEFE6] hover:bg-[#C03E0A]'
                }`}
              >
                {waiterAcknowledged
                  ? 'Order taken by waiter'
                  : waiterCalled
                  ? 'Waiter called · Table 5'
                  : 'Call waiter'}
              </button>
            )}

            {level === 3 && (
              <div className="flex flex-col gap-2">
                {orderStatus !== 'Idle' && (
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-[8px] bg-[#FFEEE3] border border-[#E8500C]/30 text-[12px]">
                    <span className="font-mono-code font-semibold text-[#1A0C06]">
                      Ticket {ticketNumber}
                    </span>
                    <span
                      className="font-semibold text-[#C03E0A]"
                      data-testid="phone-order-status"
                    >
                      {orderStatus}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={onPlaceOrder}
                  disabled={itemCount === 0}
                  className={`w-full h-10 rounded-[10px] font-semibold text-[14px] transition-colors cursor-pointer ${
                    itemCount === 0
                      ? 'bg-[#E3D9D3] text-[#6C625C] cursor-not-allowed'
                      : 'bg-[#E8500C] text-[#FBEFE6] hover:bg-[#C03E0A]'
                  }`}
                >
                  {orderStatus === 'Idle' ? 'Place order' : 'Send another order'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
