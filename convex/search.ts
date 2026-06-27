import { v } from 'convex/values';
import { action } from './_generated/server';

// Server-side proxy to the external Wikivoyage search API.
//
// Running this as a Convex action (rather than fetching directly from the
// browser) keeps the upstream URL/key on the server, avoids CORS, and lets the
// client call it via `useAction(api.search.wikivoyage)`.
//
// Configure the upstream URL with:
//   npx convex env set SEARCH_API_URL https://.../api/search
export const wikivoyage = action({
  args: {
    query: v.string(),
    numResults: v.number(),
  },
  returns: v.object({
    results: v.array(
      v.object({
        title: v.string(),
        content: v.string(),
      }),
    ),
    summary: v.string(),
  }),
  handler: async (_ctx, { query, numResults }) => {
    const url = process.env.SEARCH_API_URL;
    if (!url) {
      throw new Error('SEARCH_API_URL is not configured');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    // The upstream is a protected Vercel deployment. Send the "Protection
    // Bypass for Automation" secret so we aren't redirected to the Vercel SSO
    // login page. Configure with:
    //   npx convex env set SEARCH_API_BYPASS <secret>
    const bypass = process.env.SEARCH_API_BYPASS;
    if (bypass) {
      headers['x-vercel-protection-bypass'] = bypass;
    }

    const res = await fetch(url, {
      method: 'POST',
      redirect: 'manual',
      headers,
      body: JSON.stringify({ query, numResults }),
    });

    if (res.status >= 300 && res.status < 400) {
      throw new Error(
        'Upstream redirected (likely Vercel Deployment Protection). ' +
          'Check SEARCH_API_BYPASS or disable protection on the Vercel project.',
      );
    }

    if (!res.ok) {
      throw new Error(`Search request failed with status ${res.status}`);
    }

    const data = (await res.json()) as {
      results?: { title: string; content: string }[];
      summary?: string;
    };

    return {
      results: data.results ?? [],
      summary: data.summary ?? '',
    };
  },
});
