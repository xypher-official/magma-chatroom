import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

/**
 * generate-image
 * Body: { prompt: string, purpose: "avatar" | "group" | "chat", target_id?: string }
 * For "avatar": uploads under <userId>/avatar-<ts>.png and updates profile avatar_url.
 * For "group": uploads under <userId>/group-<groupId>-<ts>.png; client must call group update with returned URL.
 * For "chat": uploads under <userId>/chat-<ts>.png and returns URL — caller inserts the message with media_url.
 * Returns { url: string }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: userData } = await userClient.auth.getUser();
    const me = userData.user;
    if (!me) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const prompt = String(body.prompt ?? "").trim();
    const purpose = String(body.purpose ?? "chat") as "avatar" | "group" | "chat";
    const targetId = body.target_id ? String(body.target_id) : null;
    if (!prompt) return new Response(JSON.stringify({ error: "Missing prompt" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Call Lovable AI image gen
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Out of AI credits. Add funds in Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: `AI gateway error: ${txt}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const aiJson = await aiRes.json();
    const imageUrl = aiJson?.choices?.[0]?.message?.images?.[0]?.image_url?.url as string | undefined;
    if (!imageUrl?.startsWith("data:image/")) {
      return new Response(JSON.stringify({ error: "No image returned" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Decode base64
    const commaIdx = imageUrl.indexOf(",");
    const meta = imageUrl.slice(5, commaIdx); // image/png;base64
    const mime = meta.split(";")[0];
    const ext = mime.includes("jpeg") ? "jpg" : "png";
    const b64 = imageUrl.slice(commaIdx + 1);
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

    // Upload to avatars bucket. Path must start with auth uid for RLS.
    const ts = Date.now();
    const filename =
      purpose === "avatar" ? `${me.id}/avatar-${ts}.${ext}` :
      purpose === "group" ? `${me.id}/group-${targetId ?? "x"}-${ts}.${ext}` :
      `${me.id}/chat-${ts}.${ext}`;

    const { error: upErr } = await admin.storage.from("avatars").upload(filename, bin, {
      contentType: mime, upsert: true,
    });
    if (upErr) return new Response(JSON.stringify({ error: upErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: pub } = admin.storage.from("avatars").getPublicUrl(filename);
    const publicUrl = pub.publicUrl;

    // For avatar, update profile
    if (purpose === "avatar") {
      await admin.from("profiles").update({ avatar_url: publicUrl }).eq("user_id", me.id);
    }
    // For group, update only if user is owner/mod
    if (purpose === "group" && targetId) {
      const { data: roleRow } = await admin.from("group_member_roles").select("role").eq("group_id", targetId).eq("user_id", me.id).maybeSingle();
      if (roleRow?.role === "owner" || roleRow?.role === "moderator") {
        await admin.from("groups").update({ avatar_url: publicUrl }).eq("id", targetId);
      }
    }

    return new Response(JSON.stringify({ url: publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});