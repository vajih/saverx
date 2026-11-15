// GET /r/<token>: private, expiring results page.
import { renderResult, renderNotice, pageHeaders } from "./result-page.js";

export async function resultRoutes(ctx, request, url) {
  const m = url.pathname.match(/^\/r\/([^/]+)$/);
  if (!m || request.method !== "GET") return null;
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(12))));
  const page = (status, html) => new Response(html, { status, headers: pageHeaders(nonce) });
  const notFound = () => page(404, renderNotice(nonce, "Link not found", "This link isn't valid. You can request savings information again from SaveRx.ai."));

  const ipHash = await ctx.hash("ip", ctx.ipOf(request));
  if (await ctx.limited("result-ip", ipHash, 120, 3600)) return page(429, renderNotice(nonce, "Too many requests", "Please try again later."));
  if (!/^[A-Za-z0-9_-]{43}$/.test(m[1])) return notFound();

  const row = await ctx.store.getResultByTokenHash(await ctx.hash("token", m[1]));
  if (!row || !row.expires_at) return notFound();
  if (row.expires_at <= ctx.iso()) {
    return page(410, renderNotice(nonce, "This link has expired", "For your privacy, results links expire after 14 days. You can request savings information again from SaveRx.ai."));
  }
  if (await ctx.store.markResultViewed(row.id, ctx.iso())) {
    const req = await ctx.store.getRequest(row.request_id);
    await ctx.store.addEvent(ctx.iso().slice(0, 10), "result_viewed", req.drug_slug);
  }
  return page(200, renderResult({ content: JSON.parse(row.content_json), expiresAt: row.expires_at, nonce, outcome: row.outcome }));
}
