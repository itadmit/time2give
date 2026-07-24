// Edge Function: send-notification
// מופעל ע"י Database Webhook על INSERT ל-notifications → שולח Expo Push לכל ה-tokens של המשתמש.
// פריסה: supabase functions deploy send-notification
// Webhook: Dashboard → Database → Webhooks → notifications (INSERT) → HTTP POST לפונקציה.

import { createClient } from 'jsr:@supabase/supabase-js@2';

type WebhookPayload = {
  type: 'INSERT';
  table: string;
  record: {
    id: string;
    user_id: string;
    title: string | null;
    body: string | null;
    data: Record<string, unknown> | null;
  };
};

Deno.serve(async (req) => {
  try {
    const payload = (await req.json()) as WebhookPayload;
    const n = payload.record;
    if (!n?.user_id) return new Response('no user', { status: 400 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')!,
    );

    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', n.user_id);

    if (!tokens || tokens.length === 0) return new Response('no tokens', { status: 200 });

    const messages = tokens.map((t: { token: string }) => ({
      to: t.token,
      sound: 'default',
      title: n.title ?? 'Time2Give',
      body: n.body ?? '',
      data: n.data ?? {},
    }));

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });

    return new Response(JSON.stringify({ sent: messages.length, expo: await res.json() }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
  }
});
