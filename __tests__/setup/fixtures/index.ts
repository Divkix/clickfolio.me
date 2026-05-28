/**
 * Test fixtures re-exported from the mock factory.
 *
 * Use these helpers to create isolated, in-memory D1 database instances for unit tests:
 * - createMockDb: Returns a mock D1Database with drizzle-orm methods stubbed.
 *   Use when a test needs to query or mutate the database schema but does not need resume-specific data.
 * - createMockDbResume: Returns a pre-seeded mock database with a sample resume row.
 *   Use when a test requires a realistic resume record (e.g., parsing, rendering, or viewer page tests).
 */

export { createMockDb, createMockDbResume } from "../mocks/db.mock";
