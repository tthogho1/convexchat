import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

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
  }).index('by_user', ['userId']),

  messages: defineTable({
    userId: v.id('users'),
    username: v.string(),
    text: v.string(),
    timestamp: v.number(),
    receiverId: v.optional(v.id('users')),
  })
    .index('by_timestamp', ['timestamp'])
    .index('by_receiver', ['receiverId', 'timestamp']),
});
