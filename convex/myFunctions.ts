import { v } from 'convex/values';
import { query, mutation, internalMutation } from './_generated/server';
import { usernameSchema } from './validation';

// User Management
export const createUser = mutation({
  args: {
    username: v.string(),
    group: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Throws ZodError (surfaced as a ConvexError to the client) on bad input.
    usernameSchema.parse(args.username);

    // Check if user already exists
    const existing = await ctx.db
      .query('users')
      .withIndex('by_username', (q) => q.eq('username', args.username))
      .first();

    if (existing) {
      // Treat this as a login: update lastSeen and createdAt to now
      const now = Date.now();
      const patchData: Record<string, unknown> = { lastSeen: now, createdAt: now };
      if (args.group) {
        patchData.group = args.group;
      }
      await ctx.db.patch(existing._id, patchData);
      return existing._id;
    }

    // Create new user
    const now = Date.now();
    const newUser: { username: string; lastSeen: number; createdAt: number; group?: string } = {
      username: args.username,
      lastSeen: now,
      createdAt: now,
      group: args.group,
    };
    const userId = await ctx.db.insert('users', newUser);

    return userId;
  },
});

export const getUsers = query({
  args: {
    group: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db.query('users').collect();
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return users.filter((user) => {
      if (user.lastSeen <= fiveMinutesAgo) return false;
      if (args.group !== undefined && user.group !== args.group) return false;
      return true;
    });
  },
});

// Location Tracking
export const updateLocation = mutation({
  args: {
    userId: v.id('users'),
    latitude: v.number(),
    longitude: v.number(),
  },
  handler: async (ctx, args) => {
    console.log('[updateLocation] called', { userId: args.userId, latitude: args.latitude, longitude: args.longitude });

    // Get username
    const user = await ctx.db.get(args.userId);
    if (!user) {
      console.log('[updateLocation] user not found', { userId: args.userId });
      throw new Error('User not found');
    }
    console.log('[updateLocation] user found', { userId: args.userId, username: user.username });

    // Update user's lastSeen
    await ctx.db.patch(args.userId, { lastSeen: Date.now() });

    // Check if there's an existing location for this user
    const existingLocation = await ctx.db
      .query('locations')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .first();

    if (existingLocation) {
      await ctx.db.patch(existingLocation._id, {
        latitude: args.latitude,
        longitude: args.longitude,
        timestamp: Date.now(),
        group: user.group,
      });
      console.log('[updateLocation] updated location', { locationId: existingLocation._id });
    } else {
      const insertedId = await ctx.db.insert('locations', {
        userId: args.userId,
        username: user.username,
        latitude: args.latitude,
        longitude: args.longitude,
        timestamp: Date.now(),
        group: user.group,
      });
      console.log('[updateLocation] inserted location', { locationId: insertedId });
    }
  },
});

export const getLocations = query({
  args: {},
  handler: async (ctx) => {
    const locations = await ctx.db.query('locations').collect();
    // Filter out stale locations. Keep this in sync with LOCATION_STALE_MS
    // used by the cleanup cron so we don't show rows that are about to be
    // deleted, nor hide rows that are still considered fresh.
    const cutoff = Date.now() - 5 * 60 * 1000;
    const recent = locations.filter((loc) => loc.timestamp > cutoff);
    console.log('[getLocations] returning locations', { total: locations.length, recent: recent.length });
    return recent;
  },
});

// Server-side group-filtered locations: returns locations in the same group
// as `currentUserGroup`, and always includes the `currentUserId` location.
export const getLocationsForGroup = query({
  args: {
    currentUserId: v.optional(v.id('users')),
    currentUserGroup: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const locations = await ctx.db.query('locations').collect();
    // Keep in sync with cleanup cron's LOCATION_STALE_MS.
    const cutoff = Date.now() - 5 * 60 * 1000;
    const recent = locations.filter((loc) => loc.timestamp > cutoff);

    const filtered = recent.filter((loc) => {
      if (args.currentUserId && loc.userId === args.currentUserId) return true;
      return (loc.group ?? '') === (args.currentUserGroup ?? '');
    });

    console.log('[getLocationsForGroup] returning', { requestedGroup: args.currentUserGroup, total: filtered.length });
    return filtered;
  },
});

// Chat Messages
export const sendMessage = mutation({
  args: {
    userId: v.id('users'),
    text: v.string(),
    receiverId: v.optional(v.id('users')),
    group: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get username
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error('User not found');

    // Update user's lastSeen
    await ctx.db.patch(args.userId, { lastSeen: Date.now() });

    // Prefer explicit arg, fall back to user's group
    const messageGroup = args.group ?? user.group;

    // Insert message
    await ctx.db.insert('messages', {
      userId: args.userId,
      username: user.username,
      text: args.text,
      timestamp: Date.now(),
      receiverId: args.receiverId,
      group: messageGroup,
    });
  },
});

export const getMessages = query({
  args: {
    limit: v.optional(v.number()),
    userId: v.optional(v.id('users')),
    currentUserGroup: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_timestamp', (q) => q.gt('timestamp', 0))
      .order('desc')
      .take(limit * 2);

    // Determine cutoff timestamp: if userId provided, use user's `createdAt`
    // (repurposed as login time). Fall back to `lastSeen` if `createdAt` is
    // not available. If neither exists, include all messages.
    let since = 0;
    if (args.userId) {
      const user = await ctx.db.get(args.userId);
      if (user) {
        if (typeof user.createdAt === 'number') {
          since = user.createdAt;
        } else if (typeof user.lastSeen === 'number') {
          since = user.lastSeen;
        }
      }
    }

    // Filter messages by receiver/sender logic AND by timestamp >= since.
    // Also apply optional group filtering via `currentUserGroup` for broadcasts.
    const filtered = messages.filter((msg) => {
      if (msg.timestamp < since) return false;

      // Direct messages to/from the user are always included when userId is provided
      if (args.userId && (msg.receiverId === args.userId || msg.userId === args.userId)) return true;

      // Broadcast messages (no receiverId): include depending on group selection
      if (msg.receiverId === undefined) {
        // If no group requested, include all broadcasts
        if (!args.currentUserGroup || args.currentUserGroup === 'all') return true;
        // Otherwise include broadcast only if message group matches requested group
        return String(msg.group ?? '') === String(args.currentUserGroup);
      }

      // Messages that specify a receiver but also have a group: include if group matches requested
      if (args.currentUserGroup && String(msg.group ?? '') === String(args.currentUserGroup)) return true;

      return false;
    });

    return filtered.slice(0, limit).reverse();
  },
});

// Cleanup: remove old locations and their users
//
// Thresholds are intentionally generous to tolerate:
//   - Background-tab throttling of setInterval/watchPosition (can drop to
//     ~1 update per minute in Chrome/Edge).
//   - Short network blips or device sleep.
// The client sends a heartbeat every 5s, so a 5 minute cutoff still
// reclaims abandoned rows quickly without evicting active users.
const LOCATION_STALE_MS = 5 * 60 * 1000; // 5 minutes
const USER_STALE_MS = 10 * 60 * 1000; // 10 minutes
export const cleanupOldLocationsAndUsers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const locationCutoff = now - LOCATION_STALE_MS;
    const userCutoff = now - USER_STALE_MS;

    // 1) Delete stale location rows only.
    const allLocations = await ctx.db.query('locations').collect();
    for (const loc of allLocations) {
      if (loc.timestamp < locationCutoff) {
        await ctx.db.delete(loc._id);
      }
    }

    // 2) Delete users that haven't been seen for a long time, regardless of
    //    whether they currently have a location row. This avoids the previous
    //    failure mode where a still-logged-in user got their `users` row
    //    deleted just because their `locations` row briefly expired, which
    //    then caused every subsequent `updateLocation` to throw
    //    "User not found".
    const allUsers = await ctx.db.query('users').collect();
    for (const user of allUsers) {
      if ((user.lastSeen ?? 0) < userCutoff) {
        await ctx.db.delete(user._id);
      }
    }

    return null;
  },
});

// Delete a user and all of their associated data (locations + messages they
// sent or received). Called on explicit logout, and from the HTTP action that
// is pinged via `navigator.sendBeacon` when the tab/browser is closed.
export const deleteUser = mutation({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    // Delete all locations for this user (usually 0 or 1 thanks to the
    // by_user index, but loop just in case there are stragglers).
    const locs = await ctx.db
      .query('locations')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();
    for (const loc of locs) {
      await ctx.db.delete(loc._id);
    }

    // Delete messages received by this user.
    const received = await ctx.db
      .query('messages')
      .withIndex('by_receiver', (q) => q.eq('receiverId', args.userId))
      .collect();
    for (const msg of received) {
      await ctx.db.delete(msg._id);
    }

    // Delete messages sent by this user (no dedicated index; scan and filter).
    const allMessages = await ctx.db.query('messages').collect();
    for (const msg of allMessages) {
      if (msg.userId === args.userId) {
        await ctx.db.delete(msg._id);
      }
    }

    // Finally, delete the user row itself. Use `get` first so a double-delete
    // (e.g. logout button + pagehide beacon firing) is a no-op rather than an
    // error.
    const user = await ctx.db.get(args.userId);
    if (user) {
      await ctx.db.delete(args.userId);
    }

    return null;
  },
});

// Delete all received messages for a user
export const deleteReceivedMessages = mutation({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const receivedMessages = await ctx.db
      .query('messages')
      .withIndex('by_receiver', (q) => q.eq('receiverId', args.userId))
      .collect();

    for (const msg of receivedMessages) {
      await ctx.db.delete(msg._id);
    }

    return null;
  },
});
