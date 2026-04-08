// src/index.js — SaveRx Chat proxy (Cloudflare Worker, Responses API)

// GLP-1 intent detection — when a user asks about accessing/affording GLP-1 medications,
// append a pointer to the provider comparison page in the system prompt.
const GLP1_INTENT_KEYWORDS = [
  "get prescription", "get ozempic", "get wegovy", "get mounjaro", "get zepbound",
  "can i get", "how do i get", "where can i get", "qualify for", "do i qualify",
  "online prescription", "telehealth", "without insurance", "no insurance",
  "cheaper alternative", "affordable", "compounded semaglutide", "compounded tirzepatide",
  "glp-1 online", "glp1 online", "buy ozempic", "buy wegovy", "buy mounjaro"
];

function detectGLP1Intent(message) {
  if (typeof message !== "string") return false;
  const lower = message.toLowerCase();
  return GLP1_INTENT_KEYWORDS.some((kw) => lower.includes(kw));
}

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

    // Extract the last user message for intent detection
    const lastUserMsg = incoming
      .filter((m) => m.role === "user")
      .map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
      .pop() || "";

    // Base system instructions
    const systemParts = [
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
    ];

    // Conditionally append GLP-1 online access guidance
    if (detectGLP1Intent(lastUserMsg)) {
      systemParts.push(
        "When discussing GLP-1 access, cost, or how to get a prescription: after your informational answer, append a brief note:",
        "\"**Get a GLP-1 prescription online:** Compare providers who offer online prescriptions without insurance at SaveRx's [GLP-1 Provider Comparison](/drugs/glp1-online.html) — with current pricing from Hims & Hers, Ro Body, Calibrate, and others.\""
      );
    }

    // Keep prompt small/safe; append our system instructions first. This is where you can set the bot's behavior - th ebot 'Character' traits.
    // Note: Responses API has a hard limit of 4096 tokens for input+output combined.
    // We keep last N messages to preserve some context, but you may want to do more aggressive pruning.
    const system = {
      role: "system",
      content: systemParts.join(" ")
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
