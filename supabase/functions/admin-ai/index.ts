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

// OpenAI-compatible chat/completions base URL per provider.
const PROVIDER_BASES: Record<string, string> = {
  openrouter: "https://openrouter.ai/api/v1",
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  google: "https://generativelanguage.googleapis.com/v1beta/openai",
  groq: "https://api.groq.com/openai/v1",
  mistral: "https://api.mistral.ai/v1",
  deepseek: "https://api.deepseek.com/v1",
  together: "https://api.together.xyz/v1",
  xai: "https://api.x.ai/v1",
  cerebras: "https://api.cerebras.ai/v1",
};

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
  { type: "function", function: { name: "set_banner", description: "Configura banner global. color: amber|red|sky|emerald|fuchsia. cta_label: texto del botón. icon: nombre lucide.", parameters: { type: "object", properties: { enabled: { type: "boolean" }, message: { type: "string" }, link: { type: "string" }, color: { type: "string" }, cta_label: { type: "string" }, icon: { type: "string" } }, required: ["enabled"] } } },
  { type: "function", function: { name: "upsert_section", description: "Crea/actualiza sección legacy del sitio.", parameters: { type: "object", properties: { key: { type: "string" }, title: { type: "string" }, content: { type: "string" }, enabled: { type: "boolean" } }, required: ["key"] } } },
  { type: "function", function: { name: "list_sections", description: "Lista secciones legacy.", parameters: { type: "object", properties: {} } } },
  // --- Eventos ---
  { type: "function", function: { name: "create_event", description: "Crea evento en vivo.", parameters: { type: "object", properties: { title: { type: "string" }, description: { type: "string" } }, required: ["title"] } } },
  { type: "function", function: { name: "post_event_update", description: "Publica update en evento.", parameters: { type: "object", properties: { content: { type: "string" }, event_id: { type: "string" } }, required: ["content"] } } },
  { type: "function", function: { name: "end_event", description: "Termina evento.", parameters: { type: "object", properties: { event_id: { type: "string" } } } } },
  // --- Grupos ---
  { type: "function", function: { name: "create_group", description: "Crea grupo oficial.", parameters: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, member_usernames: { type: "array", items: { type: "string" } } }, required: ["name"] } } },
  { type: "function", function: { name: "delete_group", description: "Elimina grupo.", parameters: { type: "object", properties: { group_id: { type: "string" } }, required: ["group_id"] } } },
  // --- Group management ---
  { type: "function", function: { name: "update_group", description: "Actualiza nombre, descripción o write_mode (everyone|mods_only) de un grupo.", parameters: { type: "object", properties: { group_id: { type: "string" }, name: { type: "string" }, description: { type: "string" }, write_mode: { type: "string" } }, required: ["group_id"] } } },
  { type: "function", function: { name: "set_group_role", description: "Asigna rol (owner|moderator|member) a un usuario en un grupo.", parameters: { type: "object", properties: { group_id: { type: "string" }, user_id: { type: "string" }, role: { type: "string" } }, required: ["group_id", "user_id", "role"] } } },
  { type: "function", function: { name: "kick_from_group", description: "Quita a un usuario de un grupo.", parameters: { type: "object", properties: { group_id: { type: "string" }, user_id: { type: "string" } }, required: ["group_id", "user_id"] } } },
  // --- Moderation ---
  { type: "function", function: { name: "mute_user", description: "Silencia a un usuario por X minutos.", parameters: { type: "object", properties: { user_id: { type: "string" }, minutes: { type: "number" }, reason: { type: "string" } }, required: ["user_id", "minutes"] } } },
  { type: "function", function: { name: "unmute_user", description: "Quita el mute de un usuario.", parameters: { type: "object", properties: { user_id: { type: "string" } }, required: ["user_id"] } } },
  { type: "function", function: { name: "delete_message", description: "Elimina un mensaje (DM) por id.", parameters: { type: "object", properties: { message_id: { type: "string" } }, required: ["message_id"] } } },
  { type: "function", function: { name: "delete_group_message", description: "Elimina un mensaje de grupo por id.", parameters: { type: "object", properties: { message_id: { type: "string" } }, required: ["message_id"] } } },
  // --- AI image gen ---
  { type: "function", function: { name: "generate_image", description: "Genera una imagen con IA. purpose: avatar (de un user), group (de un grupo), chat (genérica). Retorna URL pública.", parameters: { type: "object", properties: { prompt: { type: "string" }, purpose: { type: "string" }, target_id: { type: "string" } }, required: ["prompt"] } } },
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
  // --- Advanced user mgmt ---
  { type: "function", function: { name: "reset_password", description: "Genera y aplica una nueva contraseña temporal segura para un usuario; devuélvela una sola vez.", parameters: { type: "object", properties: { user_id: { type: "string" } }, required: ["user_id"] } } },
  { type: "function", function: { name: "user_stats", description: "Estadísticas detalladas de un usuario: mensajes enviados, conversaciones, grupos, posts, último visto.", parameters: { type: "object", properties: { user_id: { type: "string" } }, required: ["user_id"] } } },
  { type: "function", function: { name: "mark_important", description: "Marca a un usuario como importante (aparece primero en buscadores). priority menor = más arriba (1=tú, 100=normal).", parameters: { type: "object", properties: { user_id: { type: "string" }, priority: { type: "number" }, note: { type: "string" } }, required: ["user_id"] } } },
  { type: "function", function: { name: "unmark_important", description: "Quita la marca de importante.", parameters: { type: "object", properties: { user_id: { type: "string" } }, required: ["user_id"] } } },
  { type: "function", function: { name: "list_important", description: "Lista usuarios marcados como importantes ordenados por prioridad.", parameters: { type: "object", properties: {} } } },
  // --- Site Effects (NEW) ---
  { type: "function", function: { name: "set_effect", description: "Activa/desactiva un efecto visual GLOBAL del sitio para todos los usuarios. keys: snow, hats, confetti, rain, fireworks. duration_minutes opcional para auto-desactivar.", parameters: { type: "object", properties: { key: { type: "string" }, enabled: { type: "boolean" }, duration_minutes: { type: "number" } }, required: ["key", "enabled"] } } },
  { type: "function", function: { name: "list_effects", description: "Lista efectos del sitio y su estado.", parameters: { type: "object", properties: {} } } },
  // --- Event scheduling ---
  { type: "function", function: { name: "schedule_event", description: "Programa un evento con cuenta regresiva. publish_at es ISO datetime en el futuro. Si no se da, publica ahora.", parameters: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, publish_at: { type: "string" }, countdown_label: { type: "string" }, primary_color: { type: "string" }, accent_color: { type: "string" } }, required: ["title"] } } },
  // --- Global announcements ---
  { type: "function", function: { name: "launch_announcement", description: "Lanza un anuncio global ÉPICO en tiempo real a todos los usuarios conectados (estilo Strongest Battlegrounds: barra ancha con animación, brillo y zoom). color: amber|red|sky|emerald|fuchsia. icon: nombre lucide (Megaphone, Flame, Crown, Sparkles, Zap, Trophy, AlertTriangle). duration_seconds: 3-20.", parameters: { type: "object", properties: { title: { type: "string" }, message: { type: "string" }, color: { type: "string" }, icon: { type: "string" }, duration_seconds: { type: "number" } }, required: ["message"] } } },
  // --- Pages menu position ---
  { type: "function", function: { name: "set_pages_menu_position", description: "Cambia la posición del botón ☰ que abre las secciones. Valores: top-left, top-right, bottom-left, bottom-right.", parameters: { type: "object", properties: { position: { type: "string" } }, required: ["position"] } } },
  { type: "function", function: { name: "reorder_page", description: "Cambia la posición de una página en el menú ☰. position menor = más arriba.", parameters: { type: "object", properties: { slug: { type: "string" }, position: { type: "number" } }, required: ["slug", "position"] } } },
  // --- Texto global del sitio ("código") ---
  { type: "function", function: { name: "set_text_override", description: "Reemplaza CUALQUIER texto visible del sitio por otro, en toda la app (botones, labels, títulos, menús). match_mode: exact (texto completo igual) o contains (subcadena). Úsalo cuando el texto no corresponde a un token UI conocido.", parameters: { type: "object", properties: { from_text: { type: "string" }, to_text: { type: "string" }, match_mode: { type: "string" }, enabled: { type: "boolean" } }, required: ["from_text", "to_text"] } } },
  { type: "function", function: { name: "list_text_overrides", description: "Lista los reemplazos de texto global activos.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "delete_text_override", description: "Elimina un reemplazo de texto global.", parameters: { type: "object", properties: { from_text: { type: "string" } }, required: ["from_text"] } } },
  { type: "function", function: { name: "set_custom_css", description: "Inyecta CSS global personalizado en todo el sitio (se aplica en vivo a todos). Envía '' para quitarlo.", parameters: { type: "object", properties: { css: { type: "string" } }, required: ["css"] } } },
  { type: "function", function: { name: "get_custom_css", description: "Devuelve el CSS global personalizado actual.", parameters: { type: "object", properties: {} } } },
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
    if (args.cta_label !== undefined) upd.cta_label = String(args.cta_label);
    if (args.icon !== undefined) upd.icon = String(args.icon);
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
  if (name === "update_group") {
    const upd: any = {};
    if (args.name !== undefined) { upd.name = String(args.name); upd.avatar_initials = String(args.name).substring(0,2).toUpperCase(); }
    if (args.description !== undefined) upd.description = String(args.description);
    if (args.write_mode !== undefined) upd.write_mode = String(args.write_mode);
    await admin.from("groups").update(upd).eq("id", args.group_id);
    return { ok: true };
  }
  if (name === "set_group_role") {
    await admin.from("group_member_roles").upsert({ group_id: args.group_id, user_id: args.user_id, role: args.role }, { onConflict: "group_id,user_id" });
    await admin.from("group_members").upsert({ group_id: args.group_id, user_id: args.user_id }, { onConflict: "group_id,user_id" }).then(() => {}, () => {});
    return { ok: true };
  }
  if (name === "kick_from_group") {
    await admin.from("group_members").delete().eq("group_id", args.group_id).eq("user_id", args.user_id);
    await admin.from("group_member_roles").delete().eq("group_id", args.group_id).eq("user_id", args.user_id);
    return { ok: true };
  }
  if (name === "mute_user") {
    const minutes = Number(args.minutes ?? 60);
    const until = new Date(Date.now() + minutes * 60_000).toISOString();
    await admin.from("user_mutes").insert({ user_id: args.user_id, muted_by: adminUserId, muted_until: until, reason: args.reason ?? null });
    return { ok: true, muted_until: until };
  }
  if (name === "unmute_user") {
    await admin.from("user_mutes").delete().eq("user_id", args.user_id);
    return { ok: true };
  }
  if (name === "delete_message") {
    await admin.from("messages").delete().eq("id", args.message_id);
    return { ok: true };
  }
  if (name === "delete_group_message") {
    await admin.from("group_messages").delete().eq("id", args.message_id);
    return { ok: true };
  }
  if (name === "generate_image") {
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: String(args.prompt) }],
        modalities: ["image", "text"],
      }),
    });
    if (!aiRes.ok) return { error: `AI gateway error ${aiRes.status}` };
    const j = await aiRes.json();
    const imgUrl: string | undefined = j?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imgUrl?.startsWith("data:image/")) return { error: "No image returned" };
    const commaIdx = imgUrl.indexOf(",");
    const meta = imgUrl.slice(5, commaIdx);
    const mime = meta.split(";")[0];
    const ext = mime.includes("jpeg") ? "jpg" : "png";
    const bin = Uint8Array.from(atob(imgUrl.slice(commaIdx + 1)), (c) => c.charCodeAt(0));
    const purpose = String(args.purpose ?? "chat");
    const ts = Date.now();
    const filename =
      purpose === "avatar" && args.target_id ? `${args.target_id}/avatar-${ts}.${ext}` :
      purpose === "group" && args.target_id ? `${adminUserId}/group-${args.target_id}-${ts}.${ext}` :
      `${adminUserId}/admin-${ts}.${ext}`;
    const { error: upErr } = await admin.storage.from("avatars").upload(filename, bin, { contentType: mime, upsert: true });
    if (upErr) return { error: upErr.message };
    const { data: pub } = admin.storage.from("avatars").getPublicUrl(filename);
    const url = pub.publicUrl;
    if (purpose === "avatar" && args.target_id) {
      await admin.from("profiles").update({ avatar_url: url }).eq("user_id", args.target_id);
    } else if (purpose === "group" && args.target_id) {
      await admin.from("groups").update({ avatar_url: url }).eq("id", args.target_id);
    }
    return { ok: true, url };
  }

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
  if (name === "reset_password") {
    const newPass = "Magma" + crypto.randomUUID().slice(0, 10) + "!7";
    const { error } = await admin.auth.admin.updateUserById(String(args.user_id), { password: newPass });
    if (error) return { error: error.message };
    return { ok: true, temp_password: newPass, note: "Muestra esta contraseña UNA SOLA VEZ; pídele al usuario que la cambie tras iniciar sesión." };
  }
  if (name === "user_stats") {
    const uid = String(args.user_id);
    const [{ data: prof }, msgs, posts, comments, gms, conv1, conv2] = await Promise.all([
      admin.from("profiles").select("display_name,username,last_seen,created_at,is_verified,is_banned").eq("user_id", uid).maybeSingle(),
      admin.from("messages").select("id", { count: "exact", head: true }).eq("sender_id", uid),
      admin.from("social_posts").select("id", { count: "exact", head: true }).eq("author_id", uid),
      admin.from("social_comments").select("id", { count: "exact", head: true }).eq("author_id", uid),
      admin.from("group_messages").select("id", { count: "exact", head: true }).eq("sender_id", uid),
      admin.from("conversations").select("id", { count: "exact", head: true }).eq("user_a", uid),
      admin.from("conversations").select("id", { count: "exact", head: true }).eq("user_b", uid),
    ]);
    return {
      profile: prof,
      messages: msgs.count ?? 0,
      group_messages: gms.count ?? 0,
      conversations: (conv1.count ?? 0) + (conv2.count ?? 0),
      posts: posts.count ?? 0,
      comments: comments.count ?? 0,
    };
  }
  if (name === "mark_important") {
    const payload: any = { user_id: args.user_id, marked_by: adminUserId, priority: args.priority ?? 100, note: args.note ?? "" };
    await admin.from("important_users").upsert(payload, { onConflict: "user_id" });
    return { ok: true };
  }
  if (name === "unmark_important") {
    await admin.from("important_users").delete().eq("user_id", args.user_id);
    return { ok: true };
  }
  if (name === "list_important") {
    const { data } = await admin.from("important_users").select("user_id, priority, note").order("priority", { ascending: true });
    return { important: data ?? [] };
  }
  if (name === "set_effect") {
    const expires = args.duration_minutes
      ? new Date(Date.now() + Number(args.duration_minutes) * 60_000).toISOString()
      : null;
    await admin.from("site_effects").upsert({
      key: args.key, enabled: !!args.enabled, expires_at: expires, updated_at: new Date().toISOString(),
    }, { onConflict: "key" });
    return { ok: true, key: args.key, enabled: !!args.enabled, expires_at: expires };
  }
  if (name === "list_effects") {
    const { data } = await admin.from("site_effects").select("*").order("key");
    return { effects: data ?? [] };
  }
  if (name === "schedule_event") {
    const future = args.publish_at && new Date(args.publish_at).getTime() > Date.now();
    const { data, error } = await admin.from("live_events").insert({
      title: args.title, description: args.description ?? "",
      created_by: adminUserId,
      is_active: true, is_draft: false,
      publish_at: future ? args.publish_at : null,
      countdown_label: args.countdown_label ?? "Comenzamos en",
      theme: { primary: args.primary_color ?? "#f97316", accent: args.accent_color ?? "#d946ef" },
    }).select("id").single();
    if (error) return { error: error.message };
    return { ok: true, event_id: data!.id, scheduled: future ? args.publish_at : "now" };
  }
  if (name === "launch_announcement") {
    const duration_ms = Math.max(2000, Math.min(60000, Number(args.duration_seconds ?? 8) * 1000));
    const { error } = await admin.from("global_announcements").insert({
      sender_id: adminUserId,
      title: String(args.title ?? "ANUNCIO GLOBAL").toUpperCase().slice(0, 40),
      message: String(args.message ?? "").slice(0, 200),
      color: String(args.color ?? "amber"),
      icon: String(args.icon ?? "Megaphone"),
      duration_ms,
    });
    if (error) return { error: error.message };
    return { ok: true, broadcasted: true };
  }
  if (name === "set_pages_menu_position") {
    const pos = String(args.position ?? "top-left").toLowerCase();
    await admin.from("ui_settings").upsert({ key: "pages.menu.position", value: pos, updated_at: new Date().toISOString() }, { onConflict: "key" });
    return { ok: true, position: pos };
  }
  if (name === "reorder_page") {
    await admin.from("site_pages").update({ position: Number(args.position) }).eq("slug", args.slug);
    return { ok: true };
  }
  if (name === "set_text_override") {
    const mode = args.match_mode === "contains" ? "contains" : "exact";
    const { error } = await admin.from("text_overrides").upsert({
      from_text: String(args.from_text),
      to_text: String(args.to_text),
      match_mode: mode,
      enabled: args.enabled === undefined ? true : !!args.enabled,
      created_by: adminUserId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "from_text" });
    if (error) return { error: error.message };
    return { ok: true, from_text: args.from_text, to_text: args.to_text, match_mode: mode };
  }
  if (name === "list_text_overrides") {
    const { data } = await admin.from("text_overrides").select("from_text, to_text, match_mode, enabled").order("from_text");
    return { overrides: data ?? [] };
  }
  if (name === "delete_text_override") {
    await admin.from("text_overrides").delete().eq("from_text", String(args.from_text));
    return { ok: true };
  }
  if (name === "set_custom_css") {
    await admin.from("ui_settings").upsert({ key: "site.custom_css", value: String(args.css ?? ""), updated_at: new Date().toISOString() }, { onConflict: "key" });
    return { ok: true };
  }
  if (name === "get_custom_css") {
    const { data } = await admin.from("ui_settings").select("value").eq("key", "site.custom_css").maybeSingle();
    return { css: data?.value ?? "" };
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

    // Resolve which AI backend to use: the owner's own provider key if one is
    // active, otherwise the built-in Lovable AI gateway.
    const { data: activeProvider } = await admin
      .from("ai_providers")
      .select("provider, api_key, base_url, model")
      .eq("is_active", true).eq("enabled", true)
      .maybeSingle();

    let endpoint = "https://ai.gateway.lovable.dev/v1/chat/completions";
    let apiKey = LOVABLE_API_KEY;
    let model = "google/gemini-2.5-flash";
    let usedProvider = "lovable";
    const extraHeaders: Record<string, string> = {};

    const HF_TOKEN = Deno.env.get("HUGGINGFACE_API_KEY");
    if (HF_TOKEN) {
      endpoint = "https://router.huggingface.co/v1/chat/completions";
      apiKey = HF_TOKEN;
      model = "Qwen/Qwen3-VL-235B-A22B-Instruct";
      usedProvider = "huggingface";
    } else if (activeProvider?.api_key && activeProvider.model) {
      const base = (activeProvider.base_url || PROVIDER_BASES[activeProvider.provider] || "").replace(/\/+$/, "");
      if (base) {
        endpoint = `${base}/chat/completions`;
        apiKey = activeProvider.api_key;
        model = activeProvider.model;
        usedProvider = activeProvider.provider;
        if (activeProvider.provider === "openrouter") {
          extraHeaders["HTTP-Referer"] = "https://magma-chatroom.lovable.app";
          extraHeaders["X-Title"] = "Magma Chat Room MAGAI";
        }
        if (activeProvider.provider === "anthropic") {
          extraHeaders["anthropic-version"] = "2023-06-01";
          extraHeaders["x-api-key"] = activeProvider.api_key;
        }
      }
    }

    const systemPrompt = `Eres MAGMA-AI, la consola de administración del owner XypherDev en Magma Chat Room.
Tienes poder TOTAL: usuarios, mensajes, banner global, secciones legacy, eventos en vivo (con cuenta regresiva via schedule_event), efectos visuales globales (set_effect: snow, hats, confetti, rain, fireworks), grupos, tokens UI, tema (colores HSL), páginas del sitio (menú ☰, HTML completo), anuncios globales en vivo (launch_announcement, estilo Strongest Battlegrounds) y posición del botón del menú ☰.
Reglas:
- Si actúas sobre un usuario por nombre, primero find_user; si hay varios resultados, pide aclaración.
- Para cambiar textos UI usa set_ui_setting (ej: cambiar "Grupos" → "Chats grupales" usa key="tab.groups").
- Para cambiar colores usa set_theme con HSL ("H S% L%").
- Para crear secciones del menú lateral usa create_page con un slug único, emoji apropiado y nombre de ícono lucide-react válido (PascalCase: Flame, Crown, Users, Sparkles, MessageCircle, Shield, Bell, Star, Heart, Zap, BookOpen, FileText, Info, HelpCircle).
- IMPORTANTE: El contenido de páginas (create_page / update_page) DEBE entregarse como HTML completo y rico, NO como markdown plano. Usa <section>, <header>, <h1>-<h3>, <p>, <ul>, <a>, <img>, <strong>, <em>, <blockquote>, <div class="...">, <button>, estilos inline (style="..."), grids y tarjetas. Aprovecha clases Tailwind como "rounded-2xl", "p-6", "bg-gradient-to-br", "text-amber-400", "grid grid-cols-2 gap-4", etc. para que las secciones se vean increíbles. Nunca uses <script>.
- Para anuncios urgentes/importantes a todo el sitio en vivo usa launch_announcement (no broadcast, que es solo mensajes en chats). Elige color e ícono apropiados al tono.
- Para mover el botón del menú ☰ usa set_pages_menu_position. Para reordenar páginas en el menú usa reorder_page.
- PODER TOTAL SOBRE LOS TEXTOS DEL SITIO: cualquier texto visible se puede cambiar. Si el texto es un token conocido usa set_ui_setting; si no lo es (cualquier palabra, frase o botón del sitio) usa set_text_override con from_text = el texto exacto actual y to_text = el nuevo. match_mode="contains" para subcadenas.
- Para cambios de estilo/CSS globales (fuentes, tamaños, colores, animaciones, ocultar elementos) usa set_custom_css con CSS válido; primero get_custom_css para no borrar lo existente. Nunca uses JavaScript.
- Confirma cada acción con un mensaje breve y un emoji (🔥 ✅ ⚠️ 🗑️ 👑 💬 📢 🎬 📰 👥 🎨 📄).
- Nunca actúes sobre el usuario oficial (chatroom_support).
- Sé conciso, directo, en español.`;

    const conv: any[] = [{ role: "system", content: systemPrompt }, ...messages];
    let finalText = "";

    for (let iter = 0; iter < 10; iter++) {
      const aiRes = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...extraHeaders },
        body: JSON.stringify({ model, messages: conv, tools }),
      });
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: `Rate limit excedido en ${usedProvider}, intenta más tarde o cambia de modelo.` }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: `Sin créditos en ${usedProvider}.` }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 401 || aiRes.status === 403) return new Response(JSON.stringify({ error: `API key de ${usedProvider} inválida o sin permisos.` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (!aiRes.ok) { const t = await aiRes.text(); throw new Error(`${usedProvider} (${model}): ${aiRes.status} ${t.slice(0, 400)}`); }

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
    return new Response(JSON.stringify({ reply: finalText || "(sin respuesta)", provider: usedProvider, model }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
