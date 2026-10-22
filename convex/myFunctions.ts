import { v } from 'convex/values';
import { query, mutation, internalMutation } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { usernameSchema } from './validation';
import { placeValidator } from './schema';

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
    // Return only what the UI uses: leaving out `lastSeen` keeps the result
    // identical across heartbeats, so subscribed clients don't re-render.
    return users
      .filter((user) => {
        if (user.lastSeen <= fiveMinutesAgo) return false;
        if (args.group !== undefined && user.group !== args.group) return false;
        return true;
      })
      .map((user) => ({ _id: user._id, username: user.username }));
  },
});

// Location Tracking
//
// Heartbeats arrive every few seconds, but every write re-runs the queries that
// read the row and pushes a new result to every subscribed client. Unchanged
// rows are only refreshed once this old — far inside the 5 min / 10 min
// staleness windows (LOCATION_STALE_MS / USER_STALE_MS).
const HEARTBEAT_WRITE_MS = 60 * 1000; // 1 minute
export const updateLocation = mutation({
  args: {
    userId: v.id('users'),
    latitude: v.number(),
    longitude: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get username
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Update user's lastSeen (throttled, see HEARTBEAT_WRITE_MS)
    if (now - user.lastSeen >= HEARTBEAT_WRITE_MS) {
      await ctx.db.patch(args.userId, { lastSeen: now });
    }

    // Check if there's an existing location for this user
    const existingLocation = await ctx.db
      .query('locations')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .first();

    if (existingLocation) {
      // Movement or a group change is written immediately; a stationary
      // heartbeat only refreshes the timestamp once it's HEARTBEAT_WRITE_MS old.
      const unchanged =
        existingLocation.latitude === args.latitude &&
        existingLocation.longitude === args.longitude &&
        existingLocation.group === user.group;
      if (unchanged && now - existingLocation.timestamp < HEARTBEAT_WRITE_MS) return;
      await ctx.db.patch(existingLocation._id, {
        latitude: args.latitude,
        longitude: args.longitude,
        timestamp: now,
        group: user.group,
      });
    } else {
      await ctx.db.insert('locations', {
        userId: args.userId,
        username: user.username,
        latitude: args.latitude,
        longitude: args.longitude,
        timestamp: now,
        group: user.group,
      });
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
    // Indexed on `group` so clients sharing a group reuse one query result
    // instead of each client forcing its own full-table scan.
    const sameGroup = await ctx.db
      .query('locations')
      .withIndex('by_group', (q) => q.eq('group', args.currentUserGroup))
      .collect();

    // Keep in sync with cleanup cron's LOCATION_STALE_MS.
    const cutoff = Date.now() - 5 * 60 * 1000;
    const recent = sameGroup.filter((loc) => loc.timestamp > cutoff);

    // The current user's own location might be in a different group (e.g.
    // they just switched groups) or missing from `recent` if stale; always
    // include it so the map still shows "you".
    if (args.currentUserId && !recent.some((loc) => loc.userId === args.currentUserId)) {
      const own = await ctx.db
        .query('locations')
        .withIndex('by_user', (q) => q.eq('userId', args.currentUserId!))
        .first();
      if (own) recent.push(own);
    }

    return recent;
  },
});

// Chat Messages
export const sendMessage = mutation({
  args: {
    userId: v.id('users'),
    text: v.string(),
    receiverId: v.optional(v.id('users')),
    group: v.optional(v.string()),
    place: v.optional(placeValidator),
  },
  handler: async (ctx, args) => {
    const place = args.place ? normalizePlace(args.place) : undefined;

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
      place,
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
    // The group to filter broadcasts by. A known user's stored group is the
    // source of truth (so the client can't forget to pass it); the arg is only
    // a fallback for calls without a userId.
    let group = args.currentUserGroup;
    if (args.userId) {
      const user = await ctx.db.get(args.userId);
      if (user) {
        if (typeof user.createdAt === 'number') {
          since = user.createdAt;
        } else if (typeof user.lastSeen === 'number') {
          since = user.lastSeen;
        }
        group = user.group;
      }
    }

    // Filter messages by receiver/sender logic AND by timestamp >= since.
    const filtered = messages.filter((msg) => {
      if (msg.timestamp < since) return false;

      // Direct messages to/from the user are always included when userId is provided
      if (args.userId && (msg.receiverId === args.userId || msg.userId === args.userId)) return true;

      // Broadcast messages (no receiverId): only from the user's own group.
      // "No group" is its own bucket, matching getLocationsForGroup.
      if (msg.receiverId === undefined) {
        return (msg.group ?? '') === (group ?? '');
      }

      // Someone else's DM — never visible, even within the same group.
      return false;
    });

    return filtered.slice(0, limit).reverse();
  },
});

// Meeting points
//
// Pins are scoped to a group exactly like locations: a missing group is
// treated as its own "no group" bucket.

const PIN_NAME_MAX_LENGTH = 100;
const MAX_PINS_PER_GROUP = 20;

// Trim/validate a client-supplied place so bad input fails loudly here
// instead of rendering a broken marker for the whole group.
function normalizePlace(place: { name: string; latitude: number; longitude: number }) {
  const name = place.name.trim().slice(0, PIN_NAME_MAX_LENGTH);
  if (!name) throw new Error('Place name is required');
  if (!Number.isFinite(place.latitude) || Math.abs(place.latitude) > 90) {
    throw new Error('Invalid latitude');
  }
  if (!Number.isFinite(place.longitude) || Math.abs(place.longitude) > 180) {
    throw new Error('Invalid longitude');
  }
  return { name, latitude: place.latitude, longitude: place.longitude };
}

function sameGroup(a: string | undefined, b: string | undefined) {
  return (a ?? '') === (b ?? '');
}

const pinValidator = v.object({
  _id: v.id('pins'),
  _creationTime: v.number(),
  userId: v.id('users'),
  username: v.string(),
  name: v.string(),
  latitude: v.number(),
  longitude: v.number(),
  createdAt: v.number(),
  group: v.optional(v.string()),
});

export const getPinsForGroup = query({
  args: {
    currentUserGroup: v.optional(v.string()),
  },
  returns: v.array(pinValidator),
  handler: async (ctx, args) => {
    const pins = await ctx.db
      .query('pins')
      .withIndex('by_group', (q) => q.eq('group', args.currentUserGroup))
      .collect();
    return pins.sort((a, b) => a.createdAt - b.createdAt);
  },
});

// Create a meeting point for the user's group and announce it in chat so
// members who aren't looking at the map still notice.
export const addPin = mutation({
  args: {
    userId: v.id('users'),
    place: placeValidator,
  },
  returns: v.id('pins'),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error('User not found');
    const place = normalizePlace(args.place);

    const existing = await ctx.db
      .query('pins')
      .withIndex('by_group', (q) => q.eq('group', user.group))
      .collect();
    if (existing.length >= MAX_PINS_PER_GROUP) {
      throw new Error(`A group can have at most ${MAX_PINS_PER_GROUP} meeting points`);
    }

    const now = Date.now();
    await ctx.db.patch(args.userId, { lastSeen: now });

    const pinId = await ctx.db.insert('pins', {
      userId: args.userId,
      username: user.username,
      ...place,
      createdAt: now,
      group: user.group,
    });

    await ctx.db.insert('messages', {
      userId: args.userId,
      username: user.username,
      text: `📌 Meeting point: ${place.name}`,
      timestamp: now,
      group: user.group,
      place,
      expiresAt: now + PIN_TTL_MS,
    });

    return pinId;
  },
});

// Any member of the pin's group may remove it.
export const removePin = mutation({
  args: {
    userId: v.id('users'),
    pinId: v.id('pins'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error('User not found');
    const pin: Doc<'pins'> | null = await ctx.db.get(args.pinId);
    if (!pin) return null; // already removed by someone else
    if (!sameGroup(pin.group, user.group)) {
      throw new Error('You can only remove meeting points in your own group');
    }
    await ctx.db.delete(args.pinId);

    const now = Date.now();
    await ctx.db.patch(args.userId, { lastSeen: now });

    // No `place` attached: a "Show on map" link to a removed pin would mislead.
    await ctx.db.insert('messages', {
      userId: args.userId,
      username: user.username,
      text: `🗑️ Meeting point removed: ${pin.name}`,
      timestamp: now,
      group: pin.group,
    });
    return null;
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
const PIN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
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

    // 3) Expire old meeting points. They intentionally outlive their
    //    creator's session, so they need their own TTL.
    const pinCutoff = now - PIN_TTL_MS;
    const allPins = await ctx.db.query('pins').collect();
    for (const pin of allPins) {
      if (pin.createdAt < pinCutoff) {
        await ctx.db.delete(pin._id);
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
