import { defineSchema, defineTable, s } from "convex/schema";

export default defineSchema({
  space: defineTable({
    key: s.string(),
    version: s.number(),
  }).index('by_key', ['key']),
  message: defineTable({
    id: s.string(),
    space_id: s.string(),
    sender: s.string(),
    content: s.string(),
    ord: s.number(),
    deleted: s.boolean(),
    version: s.number(),
  }).index('by_version', ['version']),
  replicache_client: defineTable({
    id: s.string(),
    last_mutation_id: s.number(),
  }).index('by_client_id', ['id']),
});
