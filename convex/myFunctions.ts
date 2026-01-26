import { v } from 'convex/values';
import { query, mutation } from './_generated/server';

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
    });
  },
});

export const getMessages = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_timestamp', (q) => q.gt('timestamp', 0))
      .order('desc')
      .take(limit);
    return messages.reverse();
  },
});
