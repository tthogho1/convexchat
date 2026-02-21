import { v } from 'convex/values';
import { query, mutation, internalMutation } from './_generated/server';

// User Management
export const createUser = mutation({
  args: {
    username: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existing = await ctx.db
      .query('users')
      .withIndex('by_username', (q) => q.eq('username', args.username))
      .first();

    if (existing) {
      // Update lastSeen
      await ctx.db.patch(existing._id, { lastSeen: Date.now() });
      return existing._id;
    }

    // Create new user
    const userId = await ctx.db.insert('users', {
      username: args.username,
      lastSeen: Date.now(),
    });

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
      await ctx.db.patch(existingLocation._id, {
        latitude: args.latitude,
        longitude: args.longitude,
        timestamp: Date.now(),
      });
      console.log('[updateLocation] updated location', { locationId: existingLocation._id });
    } else {
      // Create new location entry
      const insertedId = await ctx.db.insert('locations', {
        userId: args.userId,
        username: user.username,
        latitude: args.latitude,
        longitude: args.longitude,
        timestamp: Date.now(),
      });
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

// Chat Messages
export const sendMessage = mutation({
  args: {
    userId: v.id('users'),
    text: v.string(),
    receiverId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    // Get username
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error('User not found');

    // Update user's lastSeen
    await ctx.db.patch(args.userId, { lastSeen: Date.now() });

    // Insert message
    await ctx.db.insert('messages', {
      userId: args.userId,
      username: user.username,
      text: args.text,
      timestamp: Date.now(),
      receiverId: args.receiverId,
    });
  },
});

export const getMessages = query({
  args: {
    limit: v.optional(v.number()),
    userId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_timestamp', (q) => q.gt('timestamp', 0))
      .order('desc')
      .take(limit * 2);

    // Determine cutoff timestamp: if userId provided, only return messages
    // with timestamp >= the user's lastSeen (login) time. Otherwise include all.
    let since = 0;
    if (args.userId) {
      const user = await ctx.db.get(args.userId);
      if (user && typeof user.lastSeen === 'number') {
        since = user.lastSeen;
      }
    }

    // Filter messages by receiver/sender logic AND by timestamp >= since
    const filtered = args.userId
      ? messages.filter(
          (msg) =>
            msg.timestamp >= since &&
            (msg.receiverId === undefined || msg.receiverId === args.userId || msg.userId === args.userId),
        )
      : messages.filter((msg) => msg.timestamp >= since);

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
