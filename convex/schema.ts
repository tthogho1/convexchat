import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

// A named point on the map. Shared by meeting-point pins and by chat
// messages that carry a place.
export const placeValidator = v.object({
  name: v.string(),
  latitude: v.number(),
  longitude: v.number(),
});

export default defineSchema({
  users: defineTable({
    username: v.string(),
    lastSeen: v.number(), // timestamp
    createdAt: v.number(), // account creation / login time used for message filtering
    group: v.optional(v.string()),
  }).index('by_username', ['username']),

  locations: defineTable({
    userId: v.id('users'),
    username: v.string(),
    latitude: v.number(),
    longitude: v.number(),
    timestamp: v.number(),
    group: v.optional(v.string()),
  })
    .index('by_user', ['userId'])
    .index('by_group', ['group']),

  messages: defineTable({
    userId: v.id('users'),
    username: v.string(),
    text: v.string(),
    timestamp: v.number(),
    receiverId: v.optional(v.id('users')),
    group: v.optional(v.string()),
    // Set when the message shares a place; tapping it flies the map there.
    place: v.optional(placeValidator),
    // Set on meeting-point announcements: when the pin expires (PIN_TTL_MS).
    expiresAt: v.optional(v.number()),
  })
    .index('by_timestamp', ['timestamp'])
    .index('by_receiver', ['receiverId', 'timestamp']),

  // Meeting points shared with everyone in the same group. Not tied to the
  // creator's lifetime (a pin should survive its creator logging out); the
  // cleanup cron expires them after PIN_TTL_MS.
  pins: defineTable({
    userId: v.id('users'),
    username: v.string(),
    name: v.string(),
    latitude: v.number(),
    longitude: v.number(),
    createdAt: v.number(),
    group: v.optional(v.string()),
  }).index('by_group', ['group']),
});
