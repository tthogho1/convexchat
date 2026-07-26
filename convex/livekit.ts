'use node';

import { v } from 'convex/values';
import { action } from './_generated/server';
import { AccessToken } from 'livekit-server-sdk';

// Mint a short-lived LiveKit access token for a participant to join a room.
//
// Runs in Convex's Node runtime ("use node") because livekit-server-sdk signs
// the JWT with Node crypto. The API key/secret stay server-side; only the
// public wss:// URL and the signed token reach the browser.
//
// Configure with:
//   npx convex env set LIVEKIT_URL wss://<your>.livekit.cloud
//   npx convex env set LIVEKIT_API_KEY <key>
//   npx convex env set LIVEKIT_API_SECRET <secret>
export const token = action({
  args: {
    room: v.string(),
    identity: v.string(),
    name: v.optional(v.string()),
  },
  returns: v.object({
    token: v.string(),
    url: v.string(),
    room: v.string(),
    identity: v.string(),
  }),
  handler: async (_ctx, { room, identity, name }) => {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const url = process.env.LIVEKIT_URL;
    if (!apiKey || !apiSecret || !url) {
      throw new Error('Missing LiveKit server credentials');
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: name ?? identity,
    });
    at.addGrant({
      roomJoin: true,
      room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return {
      token: await at.toJwt(),
      url,
      room,
      identity,
    };
  },
});
