import { v } from 'convex/values';
import { query, mutation, internalMutation } from './_generated/server';
import type { Id } from './_generated/dataModel';

// User Management
export const createUser = mutation({
  args: {
    username: v.string(),
    group: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query('users').collect();
    // Filter out users who haven't been seen in the last 5 minutes
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return users.filter((user) => user.lastSeen > fiveMinutesAgo);
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
      // Update existing location
      const patchData: Record<string, unknown> = {
        latitude: args.latitude,
        longitude: args.longitude,
        timestamp: Date.now(),
      };
      if (typeof (user as any).group === 'string') {
        patchData.group = (user as any).group;
      }
      await ctx.db.patch(existingLocation._id, patchData);
      console.log('[updateLocation] updated location', { locationId: existingLocation._id });
    } else {
      // Create new location entry
      const loc: {
        userId: Id<'users'>;
        username: string;
        latitude: number;
        longitude: number;
        timestamp: number;
        group?: string;
      } = {
        userId: args.userId,
        username: user.username,
        latitude: args.latitude,
        longitude: args.longitude,
        timestamp: Date.now(),
      };
      if (typeof (user as any).group === 'string') {
        loc.group = (user as any).group;
      }
      const insertedId = await ctx.db.insert('locations', loc);
      console.log('[updateLocation] inserted location', { locationId: insertedId });
    }
  },
});

export const getLocations = query({
  args: {},
  handler: async (ctx) => {
    const locations = await ctx.db.query('locations').collect();
    // Filter out stale locations (older than 2 minutes)
    const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
    const recent = locations.filter((loc) => loc.timestamp > twoMinutesAgo);
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
    const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
    const recent = locations.filter((loc) => loc.timestamp > twoMinutesAgo);

    const filtered = recent.filter((loc) => {
      if (args.currentUserId && loc.userId === args.currentUserId) return true;
      //if (!args.currentUserGroup) return false;
      return String(loc.group ?? '') === String(args.currentUserGroup);
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

    // Determine group for the message: prefer explicit arg, fall back to user's group
    const messageGroup = typeof args.group === 'string' ? args.group : (user as any).group;

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
export const cleanupOldLocationsAndUsers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const oneMinuteAgo = Date.now() - 60 * 1000;
    const allLocations = await ctx.db.query('locations').collect();

    // Find and delete old locations, collect their userIds
    const removedUserIds: Set<any> = new Set();
    for (const loc of allLocations) {
      if (loc.timestamp < oneMinuteAgo) {
        removedUserIds.add(loc.userId);
        await ctx.db.delete(loc._id);
      }
    }

    // Check which removed users still have remaining locations
    const remainingLocations = await ctx.db.query('locations').collect();
    const remainingUserIds = new Set(remainingLocations.map((loc) => loc.userId));

    // Delete users who no longer have any location
    for (const userId of removedUserIds) {
      if (!remainingUserIds.has(userId)) {
        await ctx.db.delete(userId);
      }
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
