/**
 * Re-exports from all mock modules for convenient single-import access.
 *
 * ```ts
 * import { createMockUser, createMockQueueMessage } from "@/__tests__/setup";
 * ```
 */

// AI mocks
export {
  createMinimalParsedResume,
  createMockAIError,
  createMockAIResponse,
  createMockParsedResume,
  MOCK_RAW_PDF_TEXT,
} from "../mocks/ai.mock";
// Auth mocks
export {
  createExpiredAuthSession,
  createMockAdminUser,
  createMockAuthSession,
  createMockHeadersWithoutSession,
  createMockHeadersWithSession,
  createMockPrivacySettings,
  createMockSession,
  createMockUser,
  createMockUserWithHandle,
  createNullSession,
} from "../mocks/auth.mock";
export type { MockDb } from "../mocks/db.mock";
// DB mocks
export {
  createMockDb,
  createMockDbResume,
  createMockDbSession,
  createMockDbSiteData,
  createMockDbUser,
  createMockHandleChange,
  createMockQueryChain,
  createMockReferralClick,
  createMockTransaction,
  createMockUploadRateLimit,
} from "../mocks/db.mock";
// Queue mocks
export {
  createMockDeadLetterMessage,
  createMockExecutionContext,
  createMockMessageBatch,
  createMockQueueMessage,
  createMockScheduledEvent,
} from "../mocks/queue.mock";
export type { MockR2Bucket, MockR2Store } from "../mocks/r2.mock";
// R2 mocks
export {
  createEmptyR2Bucket,
  createMockR2Bucket,
  createMockR2Object,
} from "../mocks/r2.mock";
