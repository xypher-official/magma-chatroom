import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const SUPPORT_EMAIL = "support@magmachat.system";
const SUPPORT_PASSWORD = crypto.randomUUID() + "Aa1!";

async function getOrCreateSupport(admin: ReturnType<typeof createClient>) {
  const { data: existing } = await admin
    .from("profiles")
    .select("user_id")
    .eq("is_official", true)
    .maybeSingle();
  if (existing) return existing.user_id as string;

  // Create auth user
  const { data: created, error } = await admin.auth.admin.createUser({
    email: SUPPORT_EMAIL,
    password: SUPPORT_PASSWORD,
    email_confirm: true,
    user_metadata: {
      username: "chatroom_support",
      display_name: "ChatRoom Support",
    },
  });
  if (error) throw error;
  const uid = created.user!.id;

  // Trigger creates profile + user role automatically. Promote.
  await admin
    .from("profiles")
    .update({
      is_official: true,
      is_verified: true,
      display_name: "ChatRoom Support",
      avatar_initials: "CS",
      username: "chatroom_support",
    })
    .eq("user_id", uid);
  return uid;
}

async function ensureConversation(
  admin: ReturnType<typeof createClient>,
  a: string,
  b: string,
) {
  const [user_a, user_b] = a < b ? [a, b] : [b, a];
  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("user_a", user_a)
    .eq("user_b", user_b)
    .maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await admin
    .from("conversations")
    .insert({ user_a, user_b })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action = body.action as string;

    // Bootstrap action: anyone can call to ensure support exists & to seed a chat for themselves.
    if (action === "bootstrap_support_for_me") {
      const supportId = await getOrCreateSupport(admin);
      const convId = await ensureConversation(admin, supportId, me.id);
      // Send welcome message if conversation is empty
      const { count } = await admin
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", convId);
      if (!count) {
        await admin.from("messages").insert({
          conversation_id: convId,
          sender_id: supportId,
          content:
            [
              "🌋 *Welcome to Magma Chat Room!*",
              "I'm *ChatRoom Support* — your official guide. This channel is read-only and where you'll get every important update.",
              "",
              "📚 *Quick tutorial — read this first*",
              "",
              "1️⃣ *Create chats* — Tap the ➕ button on the sidebar to start a 1-on-1 chat or group.",
              "2️⃣ *Send messages* — Use the input bar. Tap 😀 for emojis, 🎙️ for voice notes, 🖼️ for AI images, 📍 for live location.",
              "3️⃣ *Calls* — Tap the 📞 icon in any chat to start an audio/video call, schedule it, or share a custom link.",
              "4️⃣ *Profile & language* — Open ⚙️ Settings to change your avatar, name, language and privacy.",
              "5️⃣ *Stay safe* — Never share passwords. Report abuse via this channel.",
              "",
              "📜 *Rules*",
              "• Be respectful — no harassment, hate speech or spam.",
              "• No illegal content of any kind.",
              "• No impersonation of staff or other users.",
              "• Admins may mute, ban or remove accounts that break these rules.",
              "",
              "🔒 *Terms & Privacy*",
              "By using Magma Chat Room you accept our Terms and Conditions (visit /terms). Your data is stored securely and only shared as described there.",
              "",
              "💬 Need help? Reply… oh wait — this channel is read-only 😅. An admin will reach out from here when needed.",
              "",
              "Enjoy the magma! 🔥",
            ].join("\n"),
          is_system: true,
        });
      }
      return new Response(
        JSON.stringify({ ok: true, support_id: supportId, conversation_id: convId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Self-promote to admin if username matches AND password verified via login
    if (action === "claim_admin") {
      const { data: profile } = await admin
        .from("profiles")
        .select("username")
        .eq("user_id", me.id)
        .single();
      if (profile?.username !== "XypherDev") {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await admin
        .from("user_roles")
        .upsert({ user_id: me.id, role: "admin" }, { onConflict: "user_id,role" });
      await admin
        .from("profiles")
        .update({ is_verified: true })
        .eq("user_id", me.id);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All actions below require admin role
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", me.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "broadcast") {
      const content = String(body.content ?? "").trim();
      if (!content) throw new Error("Empty content");
      const supportId = await getOrCreateSupport(admin);
      const { data: users } = await admin
        .from("profiles")
        .select("user_id")
        .eq("is_official", false);
      let count = 0;
      for (const u of users ?? []) {
        if (u.user_id === supportId) continue;
        const convId = await ensureConversation(admin, supportId, u.user_id);
        await admin.from("messages").insert({
          conversation_id: convId,
          sender_id: supportId,
          content,
          is_system: true,
        });
        await admin
          .from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", convId);
        count++;
      }
      await admin.from("broadcasts").insert({
        sender_id: me.id,
        content,
        recipients_count: count,
      });
      return new Response(JSON.stringify({ ok: true, count }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "dm_as_support") {
      const targetUserId = String(body.target_user_id);
      const content = String(body.content ?? "").trim();
      if (!content || !targetUserId) throw new Error("Missing fields");
      const supportId = await getOrCreateSupport(admin);
      const convId = await ensureConversation(admin, supportId, targetUserId);
      await admin.from("messages").insert({
        conversation_id: convId,
        sender_id: supportId,
        content,
        is_system: true,
      });
      await admin
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", convId);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "set_verified") {
      await admin
        .from("profiles")
        .update({ is_verified: !!body.value })
        .eq("user_id", body.target_user_id);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "set_banned") {
      await admin
        .from("profiles")
        .update({ is_banned: !!body.value })
        .eq("user_id", body.target_user_id);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_user") {
      await admin.auth.admin.deleteUser(body.target_user_id);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "stats") {
      const [{ count: users }, { count: msgs }, { count: convs }, { count: bcasts }] =
        await Promise.all([
          admin.from("profiles").select("id", { count: "exact", head: true }),
          admin.from("messages").select("id", { count: "exact", head: true }),
          admin.from("conversations").select("id", { count: "exact", head: true }),
          admin.from("broadcasts").select("id", { count: "exact", head: true }),
        ]);
      return new Response(
        JSON.stringify({ users, msgs, convs, bcasts }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
