import React, { useState } from 'react';
import { DishItem } from '../lib/ecosystemStore';

export const DishImage: React.FC<{
  dish: DishItem;
  className?: string;
}> = ({ dish, className = 'w-full h-full object-cover' }) => {
  const [imgFailed, setImgFailed] = useState(false);

  if (!dish.imageUrl || imgFailed) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-4 text-center ${className}`}
        style={{ backgroundColor: dish.plateColor || '#5C4033' }}
      >
        <span className="text-[11px] font-medium text-[#FAF8F5]/80">
          {dish.category}
        </span>
        <span className="font-display font-semibold text-[16px] text-[#FFFFFF] mt-1 leading-snug">
          {dish.name}
        </span>
      </div>
    );
  }

  return (
    <img
      src={dish.imageUrl}
      alt={dish.name}
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => setImgFailed(true)}
      className={className}
    />
  );
};
