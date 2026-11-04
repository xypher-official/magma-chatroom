import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Sends a push notification for a message or call the caller just created.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const FCM_KEY = Deno.env.get("FIREBASE_MESSAGING_API_KEY");
    if (!LOVABLE_API_KEY || !FCM_KEY) return json({ error: "push not configured" }, 500);

    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    const me = u?.user?.id;
    if (!me) return json({ error: "unauthorized" }, 401);

    const { kind, id } = await req.json().catch(() => ({}));
    if (!["dm", "group", "call"].includes(kind) || typeof id !== "string") return json({ error: "bad input" }, 400);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let recipients: string[] = [];
    let title = "Magma Chat Room";
    let body = "";
    let path = "/";
    let isCall = false;
    const { data: meP } = await admin.from("profiles").select("display_name").eq("user_id", me).maybeSingle();
    const name = meP?.display_name ?? "Alguien";

    if (kind === "dm") {
      const { data: m } = await admin.from("messages").select("sender_id,content,conversation_id,media_type").eq("id", id).maybeSingle();
      if (!m || m.sender_id !== me) return json({ error: "forbidden" }, 403);
      const { data: c } = await admin.from("conversations").select("user_a,user_b").eq("id", m.conversation_id).maybeSingle();
      if (!c) return json({ ok: true });
      recipients = [c.user_a === me ? c.user_b : c.user_a];
      title = name;
      body = m.content?.slice(0, 140) || (m.media_type ? "📎 Archivo" : "Nuevo mensaje");
      path = `/?conv=${m.conversation_id}`;
    } else if (kind === "group") {
      const { data: m } = await admin.from("group_messages").select("sender_id,content,group_id,media_type").eq("id", id).maybeSingle();
      if (!m || m.sender_id !== me) return json({ error: "forbidden" }, 403);
      const { data: g } = await admin.from("groups").select("name").eq("id", m.group_id).maybeSingle();
      const { data: mem } = await admin.from("group_members").select("user_id").eq("group_id", m.group_id);
      recipients = (mem ?? []).map((r) => r.user_id).filter((x) => x !== me);
      title = `${g?.name ?? "Grupo"}`;
      body = `${name}: ${m.content?.slice(0, 120) || (m.media_type ? "📎 Archivo" : "")}`;
      path = `/?group=${m.group_id}`;
    } else {
      const { data: c } = await admin.from("calls").select("caller_id,callee_id,call_type,status").eq("id", id).maybeSingle();
      if (!c || c.caller_id !== me || c.status !== "ringing") return json({ error: "forbidden" }, 403);
      recipients = [c.callee_id];
      isCall = true;
      title = c.call_type === "video" ? "📹 Videollamada entrante" : "📞 Llamada entrante";
      body = `${name} te está llamando`;
      path = `/?call=${id}`;
    }
    if (!recipients.length) return json({ ok: true, sent: 0 });

    const { data: toks } = await admin.from("push_tokens").select("token").in("user_id", recipients);
    let sent = 0;
    for (const { token } of toks ?? []) {
      const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": FCM_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token,
            data: { title, body, path, kind, id, call: isCall ? "1" : "0" },
            android: { priority: "high", ttl: isCall ? "45s" : "86400s" },
            webpush: { headers: { Urgency: "high", TTL: isCall ? "45" : "86400" } },
          },
        }),
      });
      if (res.ok) sent++;
      else {
        const t = await res.text();
        console.error(`FCM [${res.status}]: ${t}`);
        if (res.status === 404 || (res.status === 400 && t.includes("INVALID_ARGUMENT"))) {
          await admin.from("push_tokens").delete().eq("token", token);
        }
      }
    }
    return json({ ok: true, sent });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
