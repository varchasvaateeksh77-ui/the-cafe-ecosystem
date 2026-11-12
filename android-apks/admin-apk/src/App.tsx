import React, { useState } from 'react';
import { supabase, MenuItemRow, ServiceLevel } from '../../../packages/shared-supabase/src/index';

export function AdminApkApp() {
  const [items, setItems] = useState<MenuItemRow[]>([]);
  const [level, setLevel] = useState<ServiceLevel>(3);

  const updatePrice = async (id: string, price: number) => {
    await supabase
      .from('menu_items')
      .update({ price, updated_at: new Date().toISOString() })
      .eq('id', id);
  };

  const toggleAvailability = async (id: string, is_available: boolean) => {
    await supabase
      .from('menu_items')
      .update({ is_available, updated_at: new Date().toISOString() })
      .eq('id', id);
  };

  const updateVenueLevel = async (venueId: string, service_level: ServiceLevel) => {
    setLevel(service_level);
    await supabase.from('venues').update({ service_level }).eq('id', venueId);
  };

  return (
    <div style={{ background: '#F7F2ED', color: '#1A0C06', minHeight: '100vh', padding: 16 }}>
      <h1>Build Bros Owner Admin APK (com.buildbros.admin)</h1>
      <p>Instant Menu Price Editor, Quick 86 Sold-Out Toggles, Service Level Switcher & Table QR Generator</p>
      <div>Current Service Level: Level {level}</div>
      {items.map((item) => (
        <div key={item.id}>
          <span>{item.name} — {item.price}</span>
          <button onClick={() => updatePrice(item.id, item.price + 0.5)}>+0.50</button>
          <button onClick={() => toggleAvailability(item.id, !item.is_available)}>
            {item.is_available ? '86 Sold Out' : 'Restock'}
          </button>
        </div>
      ))}
    </div>
  );
}
