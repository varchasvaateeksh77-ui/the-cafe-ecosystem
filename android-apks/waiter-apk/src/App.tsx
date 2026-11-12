import React, { useEffect, useState } from 'react';
import { supabase, WaiterCallRow, OrderRow } from '../../../packages/shared-supabase/src/index';

export function WaiterApkApp() {
  const [calls, setCalls] = useState<WaiterCallRow[]>([]);
  const [readyOrders, setReadyOrders] = useState<OrderRow[]>([]);

  useEffect(() => {
    const channel = supabase
      .channel('waiter-apk-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waiter_calls' },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            setCalls((prev) => [payload.new as WaiterCallRow, ...prev]);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          const updated = payload.new as OrderRow;
          if (updated.status === 'ready') {
            setReadyOrders((prev) => [updated, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const acknowledgeCall = async (id: string) => {
    await supabase.from('waiter_calls').update({ status: 'acknowledged' }).eq('id', id);
    setCalls((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'acknowledged' } : c)));
  };

  return (
    <div style={{ background: '#140905', color: '#FBEFE6', minHeight: '100vh', padding: 16 }}>
      <h1>Build Bros Waiter APK (com.buildbros.waiter)</h1>
      <p>Urgent Channel: waiter_calls_urgent · Wake Lock Active</p>
      {calls.map((c) => (
        <div key={c.id} style={{ padding: 12, border: '1px solid #E8500C', marginBottom: 8 }}>
          <strong>Table {c.table_number} Needs You</strong>
          <button onClick={() => acknowledgeCall(c.id)}>On My Way</button>
        </div>
      ))}
    </div>
  );
}
