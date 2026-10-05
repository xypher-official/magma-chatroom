import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Returns ICE servers for WebRTC. Uses configured TURN secrets when present.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const servers: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] },
  ];
  try {
    const meteredKey = Deno.env.get("METERED_API_KEY");
    const meteredDomain = Deno.env.get("METERED_DOMAIN"); // e.g. myapp.metered.live
    if (meteredKey && meteredDomain) {
      const r = await fetch(`https://${meteredDomain}/api/v1/turn/credentials?apiKey=${meteredKey}`);
      if (r.ok) servers.push(...(await r.json()));
    }
    const urls = Deno.env.get("TURN_URLS");
    const username = Deno.env.get("TURN_USERNAME");
    const credential = Deno.env.get("TURN_CREDENTIAL");
    if (urls && username && credential) {
      servers.push({ urls: urls.split(",").map((u) => u.trim()), username, credential });
    }
  } catch (e) {
    console.error("turn fetch failed", e);
  }
  return new Response(JSON.stringify({ iceServers: servers, hasTurn: servers.length > 1 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
