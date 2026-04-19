import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const tools = [
  // --- Users ---
  { type: "function", function: { name: "find_user", description: "Busca usuarios por username o display_name (parcial).", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
  { type: "function", function: { name: "delete_user", description: "Elimina permanentemente la cuenta de un usuario.", parameters: { type: "object", properties: { user_id: { type: "string" } }, required: ["user_id"] } } },
  { type: "function", function: { name: "set_verified", description: "Otorga o quita la palomita azul.", parameters: { type: "object", properties: { user_id: { type: "string" }, value: { type: "boolean" } }, required: ["user_id", "value"] } } },
  { type: "function", function: { name: "set_banned", description: "Banea o desbanea.", parameters: { type: "object", properties: { user_id: { type: "string" }, value: { type: "boolean" } }, required: ["user_id", "value"] } } },
  { type: "function", function: { name: "set_admin", description: "Asigna o revoca rol admin.", parameters: { type: "object", properties: { user_id: { type: "string" }, value: { type: "boolean" } }, required: ["user_id", "value"] } } },
  // --- Messaging ---
  { type: "function", function: { name: "broadcast", description: "Manda mensaje a TODOS desde ChatRoom Support.", parameters: { type: "object", properties: { content: { type: "string" } }, required: ["content"] } } },
  { type: "function", function: { name: "dm_as_support", description: "DM desde ChatRoom Support a un usuario.", parameters: { type: "object", properties: { user_id: { type: "string" }, content: { type: "string" } }, required: ["user_id", "content"] } } },
  // --- Stats ---
  { type: "function", function: { name: "stats", description: "Estadísticas globales.", parameters: { type: "object", properties: {} } } },
  // --- CMS / Banner ---
  { type: "function", function: { name: "set_banner", description: "Configura banner global. color: amber|red|sky|emerald|fuchsia.", parameters: { type: "object", properties: { enabled: { type: "boolean" }, message: { type: "string" }, link: { type: "string" }, color: { type: "string" } }, required: ["enabled"] } } },
  { type: "function", function: { name: "upsert_section", description: "Crea/actualiza sección legacy del sitio.", parameters: { type: "object", properties: { key: { type: "string" }, title: { type: "string" }, content: { type: "string" }, enabled: { type: "boolean" } }, required: ["key"] } } },
  { type: "function", function: { name: "list_sections", description: "Lista secciones legacy.", parameters: { type: "object", properties: {} } } },
  // --- Eventos ---
  { type: "function", function: { name: "create_event", description: "Crea evento en vivo.", parameters: { type: "object", properties: { title: { type: "string" }, description: { type: "string" } }, required: ["title"] } } },
  { type: "function", function: { name: "post_event_update", description: "Publica update en evento.", parameters: { type: "object", properties: { content: { type: "string" }, event_id: { type: "string" } }, required: ["content"] } } },
  { type: "function", function: { name: "end_event", description: "Termina evento.", parameters: { type: "object", properties: { event_id: { type: "string" } } } } },
  // --- Grupos ---
  { type: "function", function: { name: "create_group", description: "Crea grupo oficial.", parameters: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, member_usernames: { type: "array", items: { type: "string" } } }, required: ["name"] } } },
  { type: "function", function: { name: "delete_group", description: "Elimina grupo.", parameters: { type: "object", properties: { group_id: { type: "string" } }, required: ["group_id"] } } },
  // --- UI Settings (NEW) ---
  { type: "function", function: { name: "set_ui_setting", description: "Cambia un texto UI, placeholder, label o cualquier token. Claves comunes: app.name, tab.chats, tab.groups, placeholder.message, placeholder.search.", parameters: { type: "object", properties: { key: { type: "string" }, value: { type: "string" } }, required: ["key", "value"] } } },
  { type: "function", function: { name: "list_ui_settings", description: "Lista todos los tokens UI actuales.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "delete_ui_setting", description: "Elimina un token UI.", parameters: { type: "object", properties: { key: { type: "string" } }, required: ["key"] } } },
  { type: "function", function: { name: "set_theme", description: "Cambia colores del tema. Usa formato HSL: 'H S% L%' (ej. '24 100% 50%' para naranja magma).", parameters: { type: "object", properties: { primary: { type: "string" }, accent: { type: "string" } } } } },
  // --- Site Pages (NEW) ---
  { type: "function", function: { name: "create_page", description: "Crea una página/sección visible en el menú ☰. Soporta markdown + HTML básico (h1-h3, p, ul, a, img, strong, em). icon es un nombre de ícono lucide-react (ej. 'Flame', 'Crown', 'Users', 'Sparkles').", parameters: { type: "object", properties: { slug: { type: "string" }, title: { type: "string" }, content: { type: "string" }, emoji: { type: "string" }, icon: { type: "string" }, enabled: { type: "boolean" } }, required: ["slug", "title"] } } },
  { type: "function", function: { name: "update_page", description: "Actualiza una página por slug.", parameters: { type: "object", properties: { slug: { type: "string" }, title: { type: "string" }, content: { type: "string" }, emoji: { type: "string" }, icon: { type: "string" }, enabled: { type: "boolean" } }, required: ["slug"] } } },
  { type: "function", function: { name: "delete_page", description: "Elimina página por slug.", parameters: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"] } } },
  { type: "function", function: { name: "list_pages", description: "Lista todas las páginas del menú.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "suggest_emoji_icon", description: "Sugiere un emoji y un ícono lucide para un concepto. Devuelve {emoji, icon}.", parameters: { type: "object", properties: { concept: { type: "string" } }, required: ["concept"] } } },
];

async function getOrCreateSupport(admin: ReturnType<typeof createClient>) {
  const { data: existing } = await admin.from("profiles").select("user_id").eq("is_official", true).maybeSingle();
  if (existing) return existing.user_id as string;
  const { data: created, error } = await admin.auth.admin.createUser({
    email: "support@magmachat.system",
    password: crypto.randomUUID() + "Aa1!",
    email_confirm: true,
    user_metadata: { username: "chatroom_support", display_name: "ChatRoom Support" },
  });
  if (error) throw error;
  const uid = created.user!.id;
  await admin.from("profiles").update({
    is_official: true, is_verified: true,
    display_name: "ChatRoom Support", avatar_initials: "CS", username: "chatroom_support",
  }).eq("user_id", uid);
  return uid;
}

async function ensureConversation(admin: ReturnType<typeof createClient>, a: string, b: string) {
  const [user_a, user_b] = a < b ? [a, b] : [b, a];
  const { data: existing } = await admin.from("conversations").select("id").eq("user_a", user_a).eq("user_b", user_b).maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await admin.from("conversations").insert({ user_a, user_b }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function executeTool(name: string, args: any, admin: ReturnType<typeof createClient>, adminUserId: string) {
  if (name === "find_user") {
    const q = String(args.query ?? "").trim();
    const { data } = await admin.from("profiles").select("user_id, username, display_name, is_verified, is_banned, is_official")
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`).limit(5);
    return { results: data ?? [] };
  }
  if (name === "delete_user") { await admin.auth.admin.deleteUser(args.user_id); return { ok: true }; }
  if (name === "set_verified") { await admin.from("profiles").update({ is_verified: !!args.value }).eq("user_id", args.user_id); return { ok: true }; }
  if (name === "set_banned") { await admin.from("profiles").update({ is_banned: !!args.value }).eq("user_id", args.user_id); return { ok: true }; }
  if (name === "set_admin") {
    if (args.value) await admin.from("user_roles").upsert({ user_id: args.user_id, role: "admin" }, { onConflict: "user_id,role" });
    else await admin.from("user_roles").delete().eq("user_id", args.user_id).eq("role", "admin");
    return { ok: true };
  }
  if (name === "broadcast") {
    const supportId = await getOrCreateSupport(admin);
    const { data: users } = await admin.from("profiles").select("user_id").eq("is_official", false);
    let count = 0;
    for (const u of users ?? []) {
      const convId = await ensureConversation(admin, supportId, u.user_id);
      await admin.from("messages").insert({ conversation_id: convId, sender_id: supportId, content: args.content, is_system: true });
      await admin.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", convId);
      count++;
    }
    await admin.from("broadcasts").insert({ sender_id: adminUserId, content: args.content, recipients_count: count });
    return { ok: true, recipients: count };
  }
  if (name === "dm_as_support") {
    const supportId = await getOrCreateSupport(admin);
    const convId = await ensureConversation(admin, supportId, args.user_id);
    await admin.from("messages").insert({ conversation_id: convId, sender_id: supportId, content: args.content, is_system: true });
    await admin.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", convId);
    return { ok: true };
  }
  if (name === "stats") {
    const [u, m, c, b, g, e] = await Promise.all([
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin.from("messages").select("id", { count: "exact", head: true }),
      admin.from("conversations").select("id", { count: "exact", head: true }),
      admin.from("broadcasts").select("id", { count: "exact", head: true }),
      admin.from("groups").select("id", { count: "exact", head: true }),
      admin.from("live_events").select("id", { count: "exact", head: true }).eq("is_active", true),
    ]);
    return { users: u.count, msgs: m.count, convs: c.count, bcasts: b.count, groups: g.count, active_events: e.count };
  }
  if (name === "set_banner") {
    const upd: any = { enabled: !!args.enabled, updated_at: new Date().toISOString() };
    if (args.message !== undefined) upd.message = String(args.message);
    if (args.link !== undefined) upd.link = args.link;
    if (args.color !== undefined) upd.color = String(args.color);
    await admin.from("site_banner").update(upd).eq("id", 1);
    return { ok: true };
  }
  if (name === "upsert_section") {
    const payload: any = { key: args.key };
    if (args.title !== undefined) payload.title = args.title;
    if (args.content !== undefined) payload.content = args.content;
    if (args.enabled !== undefined) payload.enabled = !!args.enabled;
    payload.updated_at = new Date().toISOString();
    await admin.from("site_sections").upsert(payload, { onConflict: "key" });
    return { ok: true };
  }
  if (name === "list_sections") {
    const { data } = await admin.from("site_sections").select("*").order("key");
    return { sections: data ?? [] };
  }
  if (name === "create_event") {
    const { data } = await admin.from("live_events").insert({ title: args.title, description: args.description ?? "", created_by: adminUserId, is_active: true }).select("id").single();
    return { ok: true, event_id: data?.id };
  }
  if (name === "post_event_update") {
    let eid = args.event_id;
    if (!eid) {
      const { data } = await admin.from("live_events").select("id").eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
      eid = data?.id;
    }
    if (!eid) return { error: "no hay evento activo" };
    await admin.from("live_updates").insert({ event_id: eid, content: args.content });
    return { ok: true };
  }
  if (name === "end_event") {
    let eid = args.event_id;
    if (!eid) {
      const { data } = await admin.from("live_events").select("id").eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
      eid = data?.id;
    }
    if (!eid) return { error: "no hay evento activo" };
    await admin.from("live_events").update({ is_active: false, ended_at: new Date().toISOString() }).eq("id", eid);
    return { ok: true };
  }
  if (name === "create_group") {
    const { data: g, error } = await admin.from("groups").insert({
      name: args.name, description: args.description ?? "",
      avatar_initials: (args.name ?? "GR").substring(0, 2).toUpperCase(),
      owner_id: adminUserId,
    }).select("id").single();
    if (error) return { error: error.message };
    await admin.from("group_members").insert({ group_id: g.id, user_id: adminUserId });
    let added = 1;
    for (const uname of args.member_usernames ?? []) {
      const { data: p } = await admin.from("profiles").select("user_id").eq("username", uname).maybeSingle();
      if (p) await admin.from("group_members").insert({ group_id: g.id, user_id: p.user_id }).then(() => { added++; }, () => {});
    }
    return { ok: true, group_id: g.id, members: added };
  }
  if (name === "delete_group") { await admin.from("groups").delete().eq("id", args.group_id); return { ok: true }; }

  // --- UI settings ---
  if (name === "set_ui_setting") {
    await admin.from("ui_settings").upsert({ key: args.key, value: String(args.value ?? ""), updated_at: new Date().toISOString() }, { onConflict: "key" });
    return { ok: true };
  }
  if (name === "list_ui_settings") {
    const { data } = await admin.from("ui_settings").select("key,value").order("key");
    return { settings: data ?? [] };
  }
  if (name === "delete_ui_setting") {
    await admin.from("ui_settings").delete().eq("key", args.key);
    return { ok: true };
  }
  if (name === "set_theme") {
    const ops: Promise<any>[] = [];
    if (args.primary) ops.push(admin.from("ui_settings").upsert({ key: "theme.primary", value: String(args.primary) }, { onConflict: "key" }));
    if (args.accent) ops.push(admin.from("ui_settings").upsert({ key: "theme.accent", value: String(args.accent) }, { onConflict: "key" }));
    await Promise.all(ops);
    return { ok: true };
  }

  // --- Pages ---
  if (name === "create_page") {
    const payload: any = {
      slug: args.slug, title: args.title ?? args.slug, content: args.content ?? "",
      emoji: args.emoji ?? "📄", icon: args.icon ?? "FileText",
      enabled: args.enabled ?? true, created_by: adminUserId,
    };
    const { error } = await admin.from("site_pages").upsert(payload, { onConflict: "slug" });
    if (error) return { error: error.message };
    return { ok: true };
  }
  if (name === "update_page") {
    const payload: any = { updated_at: new Date().toISOString() };
    for (const k of ["title", "content", "emoji", "icon", "enabled"]) if (args[k] !== undefined) payload[k] = args[k];
    const { error } = await admin.from("site_pages").update(payload).eq("slug", args.slug);
    if (error) return { error: error.message };
    return { ok: true };
  }
  if (name === "delete_page") { await admin.from("site_pages").delete().eq("slug", args.slug); return { ok: true }; }
  if (name === "list_pages") {
    const { data } = await admin.from("site_pages").select("slug,title,emoji,icon,enabled,position").order("position");
    return { pages: data ?? [] };
  }
  if (name === "suggest_emoji_icon") {
    // simple heuristic; LLM ya elige usualmente. Devuelve placeholder seguro.
    return { emoji: "✨", icon: "Sparkles", note: "Usa este resultado como base; puedes elegir otro emoji/ícono." };
  }
  return { error: "unknown tool" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: userData } = await userClient.auth.getUser();
    const me = userData.user;
    if (!me) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", me.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: "admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const messages = body.messages as Array<{ role: string; content: string }>;

    const systemPrompt = `Eres MAGMA-AI, la consola de administración del owner XypherDev en Magma Chat Room.
Tienes poder TOTAL: usuarios, mensajes, banner global, secciones legacy, eventos en vivo, grupos, tokens UI (textos/placeholders), tema (colores HSL) y páginas del sitio (menú ☰, con markdown + HTML básico).
Reglas:
- Si actúas sobre un usuario por nombre, primero find_user; si hay varios resultados, pide aclaración.
- Para cambiar textos UI usa set_ui_setting (ej: cambiar "Grupos" → "Chats grupales" usa key="tab.groups").
- Para cambiar colores usa set_theme con HSL ("H S% L%").
- Para crear secciones del menú lateral usa create_page con un slug único, emoji apropiado y nombre de ícono lucide-react válido (PascalCase: Flame, Crown, Users, Sparkles, MessageCircle, Shield, Bell, Star, Heart, Zap, BookOpen, FileText, Info, HelpCircle).
- El contenido de páginas soporta markdown estándar y HTML básico (h1-h3, p, ul, ol, li, a, img, strong, em, blockquote, code). Aprovéchalo para crear secciones ricas.
- Confirma cada acción con un mensaje breve y un emoji (🔥 ✅ ⚠️ 🗑️ 👑 💬 📢 🎬 📰 👥 🎨 📄).
- Nunca actúes sobre el usuario oficial (chatroom_support).
- Sé conciso, directo, en español.`;

    const conv: any[] = [{ role: "system", content: systemPrompt }, ...messages];
    let finalText = "";

    for (let iter = 0; iter < 10; iter++) {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: conv, tools }),
      });
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit excedido, intenta más tarde." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Sin créditos en el workspace de Lovable AI." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (!aiRes.ok) { const t = await aiRes.text(); throw new Error(`AI gateway: ${aiRes.status} ${t}`); }

      const data = await aiRes.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) break;
      conv.push(msg);

      const toolCalls = msg.tool_calls;
      if (toolCalls && toolCalls.length) {
        for (const tc of toolCalls) {
          let result: any;
          try {
            const args = JSON.parse(tc.function.arguments || "{}");
            result = await executeTool(tc.function.name, args, admin, me.id);
          } catch (e) { result = { error: (e as Error).message }; }
          conv.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
        }
        continue;
      }
      finalText = msg.content ?? "";
      break;
    }
    return new Response(JSON.stringify({ reply: finalText || "(sin respuesta)" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
