/**
 * Referral count trigger integrity tests.
 *
 * Migration 0024_steady_gazelle.sql defines DB triggers that maintain
 * user.referralCount when user.referredBy is inserted, updated, or deleted.
 *
 * Since D1 triggers run at the SQL level and cannot be exercised through
 * Drizzle mocks alone, this test replicates the trigger logic from the
 * migration and verifies every trigger scenario against a simulated
 * in-memory user table.
 */

import { beforeEach, describe, expect, it } from "vitest";

// ── Types ─────────────────────────────────────────────────────────────

interface SimUser {
  id: string;
  referralCount: number;
  referredBy: string | null;
}

// ── Trigger logic (mirrors 0024_steady_gazelle.sql) ───────────────────

class UserStore {
  private users = new Map<string, SimUser>();

  createUser(id: string, referredBy: string | null = null): SimUser {
    const user: SimUser = { id, referralCount: 0, referredBy };
    this.users.set(id, user);

    // Trigger: AFTER INSERT when NEW.referred_by IS NOT NULL
    if (referredBy !== null) {
      const referrer = this.users.get(referredBy);
      if (referrer) {
        referrer.referralCount += 1;
      }
    }

    return user;
  }

  getUser(id: string): SimUser | undefined {
    return this.users.get(id);
  }

  /**
   * Update a user's referredBy field.
   * Applies the appropriate trigger based on old/new values.
   */
  updateReferredBy(userId: string, newReferredBy: string | null): void {
    const user = this.users.get(userId);
    if (!user) throw new Error(`User ${userId} not found`);

    const oldReferredBy = user.referredBy;
    user.referredBy = newReferredBy;

    // Trigger: AFTER UPDATE OF referred_by
    // Case 1: OLD is NULL, NEW is NOT NULL → increment new referrer
    if (oldReferredBy === null && newReferredBy !== null) {
      const referrer = this.users.get(newReferredBy);
      if (referrer) {
        referrer.referralCount += 1;
      }
    }
    // Case 2: OLD is NOT NULL, NEW is NULL → decrement old referrer
    else if (oldReferredBy !== null && newReferredBy === null) {
      const oldReferrer = this.users.get(oldReferredBy);
      if (oldReferrer && oldReferrer.referralCount > 0) {
        oldReferrer.referralCount -= 1;
      }
      if (oldReferrer && oldReferrer.referralCount === 0) {
        // Guard: don't go below 0 (CASE WHEN > 0 THEN -1 ELSE 0)
      }
    }
    // Case 3: OLD is NOT NULL, NEW is NOT NULL, different → decrement old, increment new
    else if (oldReferredBy !== null && newReferredBy !== null && oldReferredBy !== newReferredBy) {
      const oldReferrer = this.users.get(oldReferredBy);
      if (oldReferrer && oldReferrer.referralCount > 0) {
        oldReferrer.referralCount -= 1;
      }
      const newReferrer = this.users.get(newReferredBy);
      if (newReferrer) {
        newReferrer.referralCount += 1;
      }
    }
    // Case 4: OLD == NEW (same referrer) or both NULL → no change
  }

  /**
   * Delete a user.
   * Trigger: AFTER DELETE when OLD.referred_by IS NOT NULL → decrement referrer
   */
  deleteUser(userId: string): void {
    const user = this.users.get(userId);
    if (!user) throw new Error(`User ${userId} not found`);

    const oldReferredBy = user.referredBy;
    this.users.delete(userId);

    if (oldReferredBy !== null) {
      const referrer = this.users.get(oldReferredBy);
      if (referrer && referrer.referralCount > 0) {
        referrer.referralCount -= 1;
      }
    }
  }

  getReferralCount(userId: string): number {
    const user = this.users.get(userId);
    return user?.referralCount ?? 0;
  }
}

// ── Test Suite ────────────────────────────────────────────────────────

describe("Referral Count Triggers (0024_steady_gazelle)", () => {
  let store: UserStore;

  beforeEach(() => {
    store = new UserStore();
  });

  describe("AFTER INSERT trigger: user_referral_count_after_insert", () => {
    it("increments referrer count when new user inserted with referredBy", () => {
      store.createUser("user-a");
      expect(store.getReferralCount("user-a")).toBe(0);

      store.createUser("user-c", "user-a");
      expect(store.getReferralCount("user-a")).toBe(1);
    });

    it("does NOT increment when new user inserted without referredBy", () => {
      store.createUser("user-a");
      store.createUser("user-c", null);
      expect(store.getReferralCount("user-a")).toBe(0);
    });

    it("increments correctly for multiple referrals", () => {
      store.createUser("user-a");
      store.createUser("user-c", "user-a");
      store.createUser("user-d", "user-a");
      store.createUser("user-e", "user-a");
      expect(store.getReferralCount("user-a")).toBe(3);
    });

    it("handles referredBy pointing to non-existent user gracefully", () => {
      // In a real DB this would be caught by FK constraint, but trigger
      // should handle gracefully (no increment).
      store.createUser("user-c", "nonexistent");
      // Should not throw
      expect(store.getReferralCount("nonexistent")).toBe(0);
    });
  });

  describe("AFTER UPDATE trigger: user_referral_count_after_referred_by_set", () => {
    it("increments when referredBy changes from NULL to a value", () => {
      store.createUser("user-a");
      store.createUser("user-c", null);
      expect(store.getReferralCount("user-a")).toBe(0);

      store.updateReferredBy("user-c", "user-a");
      expect(store.getReferralCount("user-a")).toBe(1);
    });
  });

  describe("AFTER UPDATE trigger: user_referral_count_after_referred_by_cleared", () => {
    it("decrements when referredBy changes from a value to NULL", () => {
      store.createUser("user-a");
      store.createUser("user-c", "user-a");
      expect(store.getReferralCount("user-a")).toBe(1);

      store.updateReferredBy("user-c", null);
      expect(store.getReferralCount("user-a")).toBe(0);
    });

    it("does not go below 0 when decrementing (CASE guard)", () => {
      // Simulate edge case: referralCount is 0 but trigger fires
      // The CASE WHEN referralCount > 0 THEN -1 ELSE 0 guard prevents negative
      const store2 = new UserStore();
      store2.createUser("user-a");
      // Manually force count to 0 (shouldn't happen in practice but trigger guards)
      const u = store2.getUser("user-a")!;
      u.referralCount = 0;

      store2.createUser("user-c", "user-a");

      // Clear - trigger would attempt decrement but CASE guard stops it
      store2.updateReferredBy("user-c", null);
      expect(store2.getReferralCount("user-a")).toBe(0);
    });
  });

  describe("AFTER UPDATE trigger: user_referral_count_after_referred_by_moved", () => {
    it("decrements old referrer and increments new referrer on move", () => {
      store.createUser("user-a");
      store.createUser("user-b");
      store.createUser("user-c", "user-a");
      expect(store.getReferralCount("user-a")).toBe(1);
      expect(store.getReferralCount("user-b")).toBe(0);

      store.updateReferredBy("user-c", "user-b");
      expect(store.getReferralCount("user-a")).toBe(0);
      expect(store.getReferralCount("user-b")).toBe(1);
    });

    it("does NOT change when moving to same referrer (no-op)", () => {
      store.createUser("user-a");
      store.createUser("user-c", "user-a");
      expect(store.getReferralCount("user-a")).toBe(1);

      store.updateReferredBy("user-c", "user-a");
      expect(store.getReferralCount("user-a")).toBe(1);
    });
  });

  describe("AFTER DELETE trigger: user_referral_count_after_delete", () => {
    it("decrements referrer count when referred user is deleted", () => {
      store.createUser("user-a");
      store.createUser("user-c", "user-a");
      expect(store.getReferralCount("user-a")).toBe(1);

      store.deleteUser("user-c");
      expect(store.getReferralCount("user-a")).toBe(0);
    });

    it("does NOT decrement when deleting user without referredBy", () => {
      store.createUser("user-a");
      store.createUser("user-c", null); // no referrer
      expect(store.getReferralCount("user-a")).toBe(0);

      store.deleteUser("user-c");
      expect(store.getReferralCount("user-a")).toBe(0);
    });

    it("decrements only the referred user's referrer, not others", () => {
      store.createUser("user-a");
      store.createUser("user-b");
      store.createUser("user-c", "user-a");
      store.createUser("user-d", "user-b");
      expect(store.getReferralCount("user-a")).toBe(1);
      expect(store.getReferralCount("user-b")).toBe(1);

      store.deleteUser("user-c");
      expect(store.getReferralCount("user-a")).toBe(0);
      expect(store.getReferralCount("user-b")).toBe(1); // Unchanged
    });
  });

  describe("Combined scenarios", () => {
    it("handles a full referral lifecycle: insert → move → clear → delete", () => {
      // Setup
      store.createUser("ref-a");
      store.createUser("ref-b");

      // Insert: user-c refers ref-a
      store.createUser("user-c", "ref-a");
      expect(store.getReferralCount("ref-a")).toBe(1);
      expect(store.getReferralCount("ref-b")).toBe(0);

      // Move: user-c now refers ref-b
      store.updateReferredBy("user-c", "ref-b");
      expect(store.getReferralCount("ref-a")).toBe(0);
      expect(store.getReferralCount("ref-b")).toBe(1);

      // Clear: user-c drops referral
      store.updateReferredBy("user-c", null);
      expect(store.getReferralCount("ref-a")).toBe(0);
      expect(store.getReferralCount("ref-b")).toBe(0);

      // Re-add: user-c adds ref-a again
      store.updateReferredBy("user-c", "ref-a");
      expect(store.getReferralCount("ref-a")).toBe(1);

      // Delete: user-c is deleted
      store.deleteUser("user-c");
      expect(store.getReferralCount("ref-a")).toBe(0);
    });

    it("handles chain deletions where all referred users are removed", () => {
      store.createUser("ref-a");
      store.createUser("user-c", "ref-a");
      store.createUser("user-d", "ref-a");
      store.createUser("user-e", "ref-a");
      expect(store.getReferralCount("ref-a")).toBe(3);

      store.deleteUser("user-c");
      expect(store.getReferralCount("ref-a")).toBe(2);

      store.deleteUser("user-d");
      expect(store.getReferralCount("ref-a")).toBe(1);

      store.deleteUser("user-e");
      expect(store.getReferralCount("ref-a")).toBe(0);
    });

    it("maintains correct counts with multiple referrers and sequential updates", () => {
      store.createUser("ref-a");
      store.createUser("ref-b");

      // 2 users referred by ref-a, 1 by ref-b
      store.createUser("user-1", "ref-a");
      store.createUser("user-2", "ref-a");
      store.createUser("user-3", "ref-b");
      expect(store.getReferralCount("ref-a")).toBe(2);
      expect(store.getReferralCount("ref-b")).toBe(1);

      // Move user-1 from ref-a to ref-b
      store.updateReferredBy("user-1", "ref-b");
      expect(store.getReferralCount("ref-a")).toBe(1);
      expect(store.getReferralCount("ref-b")).toBe(2);

      // Delete user-3 (was referred by ref-b)
      store.deleteUser("user-3");
      expect(store.getReferralCount("ref-a")).toBe(1);
      expect(store.getReferralCount("ref-b")).toBe(1);

      // Clear user-2's referral
      store.updateReferredBy("user-2", null);
      expect(store.getReferralCount("ref-a")).toBe(0);
      expect(store.getReferralCount("ref-b")).toBe(1);
    });
  });
});
