// Edge Function: send-sms-whatsapp
// משמש כ-"Send SMS Hook" של Supabase Auth: במקום Twilio, שולח את קוד ה-OTP
// ב-WhatsApp דרך iBot Chat API. הזרימה באפליקציה לא משתנה — Supabase עדיין
// מייצר ומאמת את הקוד; רק ערוץ המסירה מוחלף.
//
// פריסה:  supabase functions deploy send-sms-whatsapp --no-verify-jwt
// הפעלה:  Dashboard → Authentication → Hooks → Send SMS → HTTPS → URL של הפונקציה
//         (Supabase שולח את הקוד; אנחנו מגדירים token+instance_id בטבלת integration_config דרך האדמין)

import { createClient } from 'jsr:@supabase/supabase-js@2';

type Payload = {
  user?: { phone?: string };
  sms?: { otp?: string };
};

const IBOT_BASE = 'https://ibot-chat.com/api/v1';

Deno.serve(async (req) => {
  try {
    const payload = (await req.json()) as Payload;
    const phone = payload?.user?.phone?.replace(/\D/g, '');
    const otp = payload?.sms?.otp;
    if (!phone || !otp) {
      return json({ error: { message: 'missing phone or otp' } }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')!,
    );

    // קריאת פרטי iBot מטבלת ה-config שהאדמין מזין
    const { data: cfg } = await supabase
      .from('integration_config')
      .select('key,value')
      .in('key', ['whatsapp_token', 'whatsapp_instance_id']);

    const map = Object.fromEntries((cfg ?? []).map((r: { key: string; value: string | null }) => [r.key, r.value]));
    const token = map['whatsapp_token'];
    const instanceId = map['whatsapp_instance_id'];
    if (!token || !instanceId) {
      return json({ error: { message: 'WhatsApp not configured (set whatsapp_token + whatsapp_instance_id in admin)' } }, 500);
    }

    const jid = `${phone}@s.whatsapp.net`;
    const msg = `קוד האימות שלך ל-Time2Give: ${otp}\n\nהקוד תקף ל-5 דקות. אם לא ביקשת קוד, התעלם מההודעה.`;
    const url =
      `${IBOT_BASE}/send-text?token=${encodeURIComponent(token)}` +
      `&instance_id=${encodeURIComponent(instanceId)}` +
      `&jid=${encodeURIComponent(jid)}` +
      `&msg=${encodeURIComponent(msg)}`;

    const res = await fetch(url);
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.success === false) {
      return json({ error: { message: body?.message ?? `ibot send failed (${res.status})` } }, 500);
    }

    return json({}, 200);
  } catch (e) {
    return json({ error: { message: (e as Error).message } }, 500);
  }
});

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
