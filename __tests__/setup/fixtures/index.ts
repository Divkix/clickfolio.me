/**
 * Test fixtures re-exported from the mock factory.
 *
 * Use these helpers to create isolated Drizzle Postgres mock instances for unit tests:
 * - createMockDb: Returns a mock Drizzle db (postgres-js-shaped `$client` + query
 *   builder stubs). Use when a test needs to assert on queries or mutations but does
 *   not need resume-specific data.
 * - createMockDbResume: Returns a sample resume row matching the Resume schema
 *   (jsonb fields as plain objects, ISO string timestamps).
 *   Use when a test requires a realistic resume record (e.g., parsing, rendering, or viewer page tests).
 */

export { createMockDb, createMockDbResume } from "../mocks/db.mock";
