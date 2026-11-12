import React, { useEffect, useState } from 'react';
import { supabase, MenuItemRow, ServiceLevel } from '../../../packages/shared-supabase/src/index';

export function GuestMenuApp() {
  const params = new URLSearchParams(window.location.search);
  const tableNumber = Number(params.get('table') || 5);
  const venueSlug = params.get('venue') || 'roast-and-co';

  const [level, setLevel] = useState<ServiceLevel>(3);
  const [items, setItems] = useState<MenuItemRow[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [statusBanner, setStatusBanner] = useState<string>('');

  useEffect(() => {
    const channel = supabase
      .channel('guest-menu-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items' },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            const updated = payload.new as MenuItemRow;
            setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addToCart = (id: string) => {
    setCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };

  const callWaiter = async () => {
    setStatusBanner(`Waiter notified · Walking to Table ${tableNumber}`);
    await supabase.from('waiter_calls').insert({
      table_number: tableNumber,
      status: 'pending',
    });
  };

  const placeOrder = async () => {
    const ticket = `#0${Math.floor(100 + Math.random() * 899)}`;
    setStatusBanner(`Order ${ticket} Sent to Kitchen`);
    await supabase.from('orders').insert({
      ticket_number: ticket,
      table_number: tableNumber,
      status: 'new',
    });
  };

  return (
    <div style={{ background: '#F7F2ED', color: '#1A0C06', minHeight: '100vh', padding: 16 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <strong>{venueSlug} · Table {tableNumber}</strong>
        <span>Level {level}</span>
      </header>
      {statusBanner && (
        <div style={{ padding: 12, background: '#FFEEE3', borderRadius: 10, marginBottom: 12 }}>
          {statusBanner}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        {level === 2 && <button onClick={callWaiter}>Call Waiter to Table {tableNumber}</button>}
        {level === 3 && <button onClick={placeOrder}>Place Order</button>}
      </div>
    </div>
  );
}
