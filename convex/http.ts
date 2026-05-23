import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';

const http = httpRouter();

// CORS preflight for the deleteUser beacon endpoint.
// `navigator.sendBeacon` itself doesn't trigger preflight when the body type
// is text/plain (which is what we use), but we still want a permissive
// response if any browser does send OPTIONS.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

http.route({
  path: '/deleteUser',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

// POST /deleteUser  body: { "userId": "<id>" }
//
// Designed to be called from `navigator.sendBeacon(url, blob)` during
// `pagehide`. Beacon sends are best-effort fire-and-forget; the browser
// guarantees the request is queued even after the page is unloaded.
http.route({
  path: '/deleteUser',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    let userId: string | undefined;
    try {
      const raw = await request.text();
      if (raw) {
        const parsed = JSON.parse(raw) as { userId?: string };
        userId = parsed.userId;
      }
    } catch {
      // fall through; userId will be undefined
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    try {
      await ctx.runMutation(api.myFunctions.deleteUser, {
        userId: userId as Id<'users'>,
      });
    } catch (err) {
      console.error('[http /deleteUser] failed', err);
      return new Response(JSON.stringify({ error: 'delete failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }),
});

export default http;
