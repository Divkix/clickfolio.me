/**
 * Explore page filter logic unit tests
 *
 * Tests the WHERE conditions used by the explore page query:
 *   eq(user.showInDirectory, true)
 *   eq(user.onboardingCompleted, true)
 *   isNotNull(user.handle)
 *
 * Since the actual query runs inside a server component, we test the
 * filtering logic in isolation using test data.
 */

import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Types replicated from app/explore/page.tsx
// ---------------------------------------------------------------------------

interface TestUser {
  handle: string | null;
  showInDirectory: boolean;
  onboardingCompleted: boolean;
  role: string | null;
}

/**
 * Replicates the WHERE conditions from the explore page query:
 *
 *   isNotNull(user.handle)
 *   eq(user.showInDirectory, true)
 *   eq(user.onboardingCompleted, true)
 */
function meetsExploreCriteria(user: TestUser): boolean {
  return user.handle !== null && user.showInDirectory === true && user.onboardingCompleted === true;
}

/** Also check that handle is not empty string (belt-and-suspenders from .filter) */
function hasValidHandle(user: TestUser): boolean {
  return user.handle !== null && user.handle !== "";
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

/**
 * Seeds a set of test users covering all positive/negative filter combinations.
 */
const seedUsers: TestUser[] = [
  {
    handle: "alice",
    showInDirectory: true,
    onboardingCompleted: true,
    role: "senior",
  },
  {
    handle: "bob",
    showInDirectory: false, // opted out
    onboardingCompleted: true,
    role: "mid_level",
  },
  {
    handle: "carol",
    showInDirectory: true,
    onboardingCompleted: false, // hasn't completed onboarding
    role: "entry_level",
  },
  {
    handle: null, // no handle set
    showInDirectory: true,
    onboardingCompleted: true,
    role: "student",
  },
  {
    handle: "dave",
    showInDirectory: false,
    onboardingCompleted: false,
    role: "executive",
  },
  {
    handle: "eve",
    showInDirectory: true,
    onboardingCompleted: true,
    role: null, // role can be null
  },
  {
    handle: "", // empty string handle
    showInDirectory: true,
    onboardingCompleted: true,
    role: "mid_level",
  },
  {
    handle: "frank",
    showInDirectory: true,
    onboardingCompleted: true,
    role: "senior",
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("explore page WHERE conditions", () => {
  describe("meetsExploreCriteria", () => {
    it("includes users with handle, showInDirectory=true, onboardingCompleted=true", () => {
      const included = seedUsers.filter(meetsExploreCriteria);
      const handles = included.map((u) => u.handle);

      expect(handles).toContain("alice");
      expect(handles).toContain("eve");
      expect(handles).toContain("frank");
    });

    it("excludes users who opted out of directory (showInDirectory=false)", () => {
      const bob = seedUsers.find((u) => u.handle === "bob");
      expect(bob).toBeDefined();
      expect(meetsExploreCriteria(bob!)).toBe(false);
      expect(meetsExploreCriteria({ ...bob!, showInDirectory: true })).toBe(true);
    });

    it("excludes users who haven't completed onboarding", () => {
      const carol = seedUsers.find((u) => u.handle === "carol");
      expect(carol).toBeDefined();
      expect(meetsExploreCriteria(carol!)).toBe(false);
    });

    it("excludes users with null handle", () => {
      const nullHandle = seedUsers.find((u) => u.handle === null);
      expect(nullHandle).toBeDefined();
      expect(meetsExploreCriteria(nullHandle!)).toBe(false);
    });

    it("includes empty string handles in the DB filter (handled by downstream filter)", () => {
      // Note: the Drizzle WHERE condition uses isNotNull(handle), so ""
      // would pass the DB filter. The downstream .filter(u => u.handle !== null)
      // handles empty strings separately.
      const emptyHandle = seedUsers.find((u) => u.handle === "");
      expect(emptyHandle).toBeDefined();
      expect(meetsExploreCriteria(emptyHandle!)).toBe(true);
    });

    it("excludes users where both showInDirectory and onboardingCompleted are false", () => {
      const dave = seedUsers.find((u) => u.handle === "dave");
      expect(dave).toBeDefined();
      expect(meetsExploreCriteria(dave!)).toBe(false);
    });

    it("requires all three conditions to be true simultaneously", () => {
      // One condition at a time
      expect(
        meetsExploreCriteria({
          handle: "test",
          showInDirectory: true,
          onboardingCompleted: true,
          role: null,
        }),
      ).toBe(true);

      // Missing handle
      expect(
        meetsExploreCriteria({
          handle: null,
          showInDirectory: true,
          onboardingCompleted: true,
          role: null,
        }),
      ).toBe(false);

      // Missing directory
      expect(
        meetsExploreCriteria({
          handle: "test",
          showInDirectory: false,
          onboardingCompleted: true,
          role: null,
        }),
      ).toBe(false);

      // Missing onboarding
      expect(
        meetsExploreCriteria({
          handle: "test",
          showInDirectory: true,
          onboardingCompleted: false,
          role: null,
        }),
      ).toBe(false);
    });
  });

  describe("hasValidHandle (downstream filter)", () => {
    it("includes non-null, non-empty handles", () => {
      expect(hasValidHandle({ handle: "alice" } as TestUser)).toBe(true);
      expect(hasValidHandle({ handle: "b" } as TestUser)).toBe(true);
    });

    it("excludes null handles", () => {
      expect(hasValidHandle({ handle: null } as TestUser)).toBe(false);
    });

    it("excludes empty string handles", () => {
      expect(hasValidHandle({ handle: "" } as TestUser)).toBe(false);
    });
  });

  describe("combined filter pipeline", () => {
    it("returns the expected subset of seed users", () => {
      const results = seedUsers.filter(meetsExploreCriteria).filter(hasValidHandle);
      const handles = results.map((u) => u.handle);

      expect(handles).toHaveLength(3);
      expect(handles).toContain("alice");
      expect(handles).toContain("eve");
      expect(handles).toContain("frank");
    });

    it("excludes bob (showInDirectory=false), carol (onboarding=false), null handle, empty handle, dave (both false)", () => {
      const results = seedUsers.filter(meetsExploreCriteria).filter(hasValidHandle);
      const handles = results.map((u) => u.handle);

      expect(handles).not.toContain("bob");
      expect(handles).not.toContain("carol");
      expect(handles).not.toContain(null);
      expect(handles).not.toContain("");
      expect(handles).not.toContain("dave");
    });
  });

  describe("role filter", () => {
    it("correctly adds role filter when specified", () => {
      // Replicates: eq(user.role, roleFilter)
      const roleFilter = "senior";
      const results = seedUsers
        .filter(meetsExploreCriteria)
        .filter(hasValidHandle)
        .filter((u) => u.role === roleFilter);

      // Both alice and frank are valid and have role="senior"
      expect(results).toHaveLength(2);
      const handles = results.map((u) => u.handle);
      expect(handles).toContain("alice");
      expect(handles).toContain("frank");
    });

    it("includes users with null role when no role filter is applied", () => {
      const results = seedUsers.filter(meetsExploreCriteria).filter(hasValidHandle);

      const eve = results.find((u) => u.handle === "eve");
      expect(eve).toBeDefined();
      expect(eve?.role).toBeNull();
    });

    it("excludes users with null role when role filter is applied", () => {
      const roleFilter = "senior";
      const results = seedUsers
        .filter(meetsExploreCriteria)
        .filter(hasValidHandle)
        .filter((u) => u.role === roleFilter);

      const eve = results.find((u) => u.handle === "eve");
      expect(eve).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("empty user list returns empty results", () => {
      const results: TestUser[] = [].filter(meetsExploreCriteria).filter(hasValidHandle);
      expect(results).toHaveLength(0);
    });

    it("single valid user passes all filters", () => {
      const single: TestUser = {
        handle: "only",
        showInDirectory: true,
        onboardingCompleted: true,
        role: "executive",
      };
      const results = [single].filter(meetsExploreCriteria).filter(hasValidHandle);
      expect(results).toHaveLength(1);
    });

    it("boolean values are exactly true (not truthy)", () => {
      // showInDirectory should be === true, not truthy
      const truthyButNotBool = {
        handle: "test",
        showInDirectory: 1 as unknown as boolean, // would be truthy but !== true
        onboardingCompleted: true,
        role: null,
      };
      expect(meetsExploreCriteria(truthyButNotBool)).toBe(false);
    });

    it("role filter is not applied when roleFilter is empty string (falsy)", () => {
      // In the explore page: if (roleFilter) { whereConditions.push(...) }
      // roleFilter of "" is falsy so no filter is applied
      const results = seedUsers.filter(meetsExploreCriteria).filter(hasValidHandle);

      // Without role filter, all 3 valid users should be included
      expect(results).toHaveLength(3);
    });
  });
});
