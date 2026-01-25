import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    username: v.string(),
    lastSeen: v.number(), // timestamp
  }).index('by_username', ['username']),

  locations: defineTable({
    userId: v.id('users'),
    username: v.string(),
    latitude: v.number(),
    longitude: v.number(),
    timestamp: v.number(),
  }).index('by_user', ['userId']),

  messages: defineTable({
    userId: v.id('users'),
    username: v.string(),
    text: v.string(),
    timestamp: v.number(),
  }).index('by_timestamp', ['timestamp']),
});
