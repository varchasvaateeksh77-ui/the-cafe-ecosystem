import React, { useEffect, useState } from 'react';
import { supabase, OrderRow } from '../../../packages/shared-supabase/src/index';

export function KitchenApkApp() {
  const [orders, setOrders] = useState<OrderRow[]>([]);

  useEffect(() => {
    const channel = supabase
      .channel('kitchen-kds-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            setOrders((prev) => [payload.new as OrderRow, ...prev]);
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updated = payload.new as OrderRow;
            setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const advanceOrder = async (order: OrderRow) => {
    const nextStatus =
      order.status === 'incoming'
        ? 'new'
        : order.status === 'new'
        ? 'cooking'
        : order.status === 'cooking'
        ? 'ready'
        : 'served';
    await supabase.from('orders').update({ status: nextStatus }).eq('id', order.id);
  };

  return (
    <div style={{ background: '#140905', color: '#FBEFE6', minHeight: '100vh', padding: 16 }}>
      <h1>Build Bros Kitchen & Reception KDS APK (com.buildbros.kitchen)</h1>
      <p>Always-Awake KDS · 4-Stage Ticket Board (New → Cooking → Ready → Served)</p>
      {orders.map((o) => (
        <div key={o.id} style={{ padding: 12, border: '1px solid #E3D9D3', marginBottom: 8 }}>
          <strong>Ticket {o.ticket_number} · Table {o.table_number} ({o.status})</strong>
          <button onClick={() => advanceOrder(o)}>Advance Stage</button>
        </div>
      ))}
    </div>
  );
}
