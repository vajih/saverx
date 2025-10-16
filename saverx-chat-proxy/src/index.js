// src/index.js — SaveRx Chat proxy (Cloudflare Worker, Responses API)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --- Health check (load in a browser to confirm Worker is live) ---
    if (url.pathname === "/" && request.method === "GET") {
      return new Response("saverx-chat-proxy: OK", {
        status: 200,
        headers: corsHeaders(request),
      });
    }

    // --- CORS preflight for browser fetch() ---
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(request) });
    }

    // --- Only allow POST /chat for AI proxy ---
    if (url.pathname !== "/chat" || request.method !== "POST") {
      return new Response("Not found", { status: 404, headers: corsHeaders(request) });
    }

    // --- Parse client payload (accepts either {messages:[...]} or {input:[...]}) ---
    let payload;
    try {
      payload = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders(request), "Content-Type": "application/json" },
      });
    }

    // Normalize to an array of role/content items for Responses API `input`
    const incoming =
      Array.isArray(payload?.input) && payload.input.length
        ? payload.input
        : Array.isArray(payload?.messages)
        ? payload.messages
        : [];

    // Keep prompt small/safe; append our system instructions first. This is where you can set the bot's behavior - th ebot 'Character' traits.
    // Note: Responses API has a hard limit of 4096 tokens for input+output combined.
    // We keep last N messages to preserve some context, but you may want to do more aggressive pruning.
    const system = {
      role: "system",
      content: [
        "You are Ask SaveRx, a helpful empathetic assistant focused on manufacturer savings (copay cards, patient assistance) and insurance basics.",
        "Formatting rules:",
        "- Always answer in concise **Markdown**.",
        "- Avoid '!' exclamation points or patronizing language.",
        "- Start with polite one short sentence summary.",
        "- Use short **bullet points** (•) for options and steps.",
        "- Put official program names in **bold** and include clear links in parentheses.",
        "- Add a tiny 'Eligibility' bullet if relevant (e.g., Commercial only / Not for Medicare).",
        "- If user asks for medical advice, respond with respond **bold** 'I'm not a doctor' and suggest contacting a clinician and .",
        "- Never give dosing or medical advice; for clinical questions suggest contacting a clinician."
      ].join(" ")
    };

    const safeInput = [system, ...incoming].slice(-12); // last N messages incl. system

    // Build Responses API request
    const body = JSON.stringify({
      model: "gpt-4.1-mini",
      input: safeInput,
      stream: true
      // temperature: 0.7,
      // text: { verbosity: "medium" },
    });

    // --- Call OpenAI Responses API and stream back to client ---
    let upstream;
    try {
      upstream = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body,
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Upstream request failed", detail: String(err) }),
        { status: 502, headers: { ...corsHeaders(request), "Content-Type": "application/json" } }
      );
    }

    // If OpenAI returns an error (e.g., insufficient_quota), forward it as JSON
    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text();
      return new Response(text || JSON.stringify({ error: "Upstream error" }), {
        status: upstream.status || 500,
        headers: { ...corsHeaders(request), "Content-Type": "application/json" },
      });
    }

    // Success: pipe SSE stream straight through
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...corsHeaders(request), "Content-Type": "text/event-stream" },
    });
  },
};

// CORS: allow saverx.ai in prod + localhost for dev
function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = new Set([
    "https://saverx.ai",
    "http://localhost:5500",
    "http://127.0.0.1:5500"
  ]);
  const allow = allowed.has(origin) ? origin : "https://saverx.ai";
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}
