// Supabase Edge Function: push-alert
// Triggered by Supabase Database Webhook on INSERT/UPDATE to `waiter_calls` and `orders`
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'https://vidryxsmxjvtcgbvrfix.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async (req: Request) => {
  try {
    const payload = await req.json();
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { table, type, record } = payload;

    if (table === 'waiter_calls' && type === 'INSERT') {
      const { data: tokens } = await supabaseAdmin
        .from('device_push_tokens')
        .select('fcm_token, device_role')
        .eq('venue_id', record.venue_id)
        .in('device_role', ['waiter', 'admin']);

      return new Response(
        JSON.stringify({
          dispatched: true,
          channel: 'waiter_calls_urgent',
          title: `Table ${record.table_number} Needs a Waiter`,
          body: `Cart ready (${record.cart_total}) — Tap to acknowledge`,
          recipients: tokens?.length ?? 0,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (table === 'orders') {
      const targetRoles =
        record.status === 'ready' ? ['waiter', 'admin'] : ['kitchen', 'reception', 'admin'];
      const { data: tokens } = await supabaseAdmin
        .from('device_push_tokens')
        .select('fcm_token, device_role')
        .eq('venue_id', record.venue_id)
        .in('device_role', targetRoles);

      return new Response(
        JSON.stringify({
          dispatched: true,
          channel: record.status === 'ready' ? 'waiter_calls_urgent' : 'kitchen_pass_bell',
          title:
            record.status === 'ready'
              ? `Order #${record.ticket_number} Ready for Table ${record.table_number}`
              : `New Order #${record.ticket_number} · Table ${record.table_number}`,
          recipients: tokens?.length ?? 0,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
