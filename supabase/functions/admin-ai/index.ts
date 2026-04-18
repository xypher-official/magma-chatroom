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
  {
    type: "function",
    function: {
      name: "find_user",
      description: "Busca un usuario por nombre de usuario (username) o display_name (parcial, case-insensitive). Devuelve user_id y datos.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Texto a buscar" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_user",
      description: "Elimina permanentemente la cuenta de un usuario por user_id.",
      parameters: {
        type: "object",
        properties: { user_id: { type: "string" } },
        required: ["user_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_verified",
      description: "Otorga o quita la insignia de verificado (palomita azul) a un usuario.",
      parameters: {
        type: "object",
        properties: { user_id: { type: "string" }, value: { type: "boolean" } },
        required: ["user_id", "value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_banned",
      description: "Banea o desbanea a un usuario (le impide enviar mensajes).",
      parameters: {
        type: "object",
        properties: { user_id: { type: "string" }, value: { type: "boolean" } },
        required: ["user_id", "value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_admin",
      description: "Asigna o revoca el rol de administrador a un usuario.",
      parameters: {
        type: "object",
        properties: { user_id: { type: "string" }, value: { type: "boolean" } },
        required: ["user_id", "value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "broadcast",
      description: "Envía un mensaje desde ChatRoom Support a TODOS los usuarios.",
      parameters: {
        type: "object",
        properties: { content: { type: "string" } },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "dm_as_support",
      description: "Envía un mensaje privado desde ChatRoom Support a un usuario específico.",
      parameters: {
        type: "object",
        properties: { user_id: { type: "string" }, content: { type: "string" } },
        required: ["user_id", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "stats",
      description: "Devuelve estadísticas globales: usuarios, mensajes, conversaciones, broadcasts.",
      parameters: { type: "object", properties: {} },
    },
  },
];

async function getOrCreateSupport(admin: ReturnType<typeof createClient>) {
  const { data: existing } = await admin
    .from("profiles")
    .select("user_id")
    .eq("is_official", true)
    .maybeSingle();
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
  const { data: existing } = await admin
    .from("conversations").select("id").eq("user_a", user_a).eq("user_b", user_b).maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await admin
    .from("conversations").insert({ user_a, user_b }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function executeTool(name: string, args: any, admin: ReturnType<typeof createClient>, adminUserId: string) {
  if (name === "find_user") {
    const q = String(args.query ?? "").trim();
    const { data } = await admin
      .from("profiles")
      .select("user_id, username, display_name, is_verified, is_banned, is_official")
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(5);
    return { results: data ?? [] };
  }
  if (name === "delete_user") {
    await admin.auth.admin.deleteUser(args.user_id);
    return { ok: true };
  }
  if (name === "set_verified") {
    await admin.from("profiles").update({ is_verified: !!args.value }).eq("user_id", args.user_id);
    return { ok: true };
  }
  if (name === "set_banned") {
    await admin.from("profiles").update({ is_banned: !!args.value }).eq("user_id", args.user_id);
    return { ok: true };
  }
  if (name === "set_admin") {
    if (args.value) {
      await admin.from("user_roles").upsert({ user_id: args.user_id, role: "admin" }, { onConflict: "user_id,role" });
    } else {
      await admin.from("user_roles").delete().eq("user_id", args.user_id).eq("role", "admin");
    }
    return { ok: true };
  }
  if (name === "broadcast") {
    const supportId = await getOrCreateSupport(admin);
    const { data: users } = await admin.from("profiles").select("user_id").eq("is_official", false);
    let count = 0;
    for (const u of users ?? []) {
      const convId = await ensureConversation(admin, supportId, u.user_id);
      await admin.from("messages").insert({
        conversation_id: convId, sender_id: supportId, content: args.content, is_system: true,
      });
      await admin.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", convId);
      count++;
    }
    await admin.from("broadcasts").insert({ sender_id: adminUserId, content: args.content, recipients_count: count });
    return { ok: true, recipients: count };
  }
  if (name === "dm_as_support") {
    const supportId = await getOrCreateSupport(admin);
    const convId = await ensureConversation(admin, supportId, args.user_id);
    await admin.from("messages").insert({
      conversation_id: convId, sender_id: supportId, content: args.content, is_system: true,
    });
    await admin.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", convId);
    return { ok: true };
  }
  if (name === "stats") {
    const [{ count: users }, { count: msgs }, { count: convs }, { count: bcasts }] = await Promise.all([
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin.from("messages").select("id", { count: "exact", head: true }),
      admin.from("conversations").select("id", { count: "exact", head: true }),
      admin.from("broadcasts").select("id", { count: "exact", head: true }),
    ]);
    return { users, msgs, convs, bcasts };
  }
  return { error: "unknown tool" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: userData } = await userClient.auth.getUser();
    const me = userData.user;
    if (!me) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", me.id).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const messages = body.messages as Array<{ role: string; content: string }>;

    const systemPrompt = `Eres MAGMA-AI, la consola de administración del admin XypherDev en Magma Chat Room.
Ejecutas órdenes en lenguaje natural usando las herramientas (tools) disponibles.
Reglas:
- Si el admin pide actuar sobre un usuario por nombre, primero llama a find_user para obtener su user_id, luego ejecuta la acción.
- Si find_user devuelve varios resultados, pide al admin que aclare cuál.
- Confirma cada acción con un mensaje breve, claro y con un emoji apropiado (🔥 ✅ ⚠️ 🗑️ 👑 💬 📢).
- Nunca actúes sobre el usuario oficial (chatroom_support).
- Sé conciso, directo y en español.`;

    const conv: any[] = [{ role: "system", content: systemPrompt }, ...messages];
    let finalText = "";

    for (let iter = 0; iter < 6; iter++) {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: conv,
          tools,
        }),
      });

      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido, intenta más tarde." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Sin créditos en el workspace de Lovable AI." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!aiRes.ok) {
        const t = await aiRes.text();
        throw new Error(`AI gateway: ${aiRes.status} ${t}`);
      }

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
          } catch (e) {
            result = { error: (e as Error).message };
          }
          conv.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        }
        continue;
      }

      finalText = msg.content ?? "";
      break;
    }

    return new Response(JSON.stringify({ reply: finalText || "(sin respuesta)" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
