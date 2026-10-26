import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";

import { noStringifiedErrorsRule } from "./rules/no-stringified-errors.ts";
import { siteDataContentFlagRule } from "./rules/site-data-content-flag.ts";

RuleTester.describe = describe;

RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: {
    sourceType: "module",
    parserOptions: { lang: "ts" },
  },
});

tester.run("site-data-content-flag", siteDataContentFlagRule, {
  valid: [
    {
      name: "buildSiteDataUpsert shape: content only through siteDataContentColumns",
      code: `
      const contentColumns = siteDataContentColumns(content);
      const lastPublishedAtSet = publish ? { lastPublishedAt: now } : {};
      const values = {
        id,
        userId,
        resumeId,
        ...contentColumns,
        ...previewFields,
        lastPublishedAt: publish ? now : null,
      };
      db.insert(siteData).values(values).onConflictDoUpdate({
        target: siteData.userId,
        set: {
          resumeId,
          ...contentColumns,
          ...previewFields,
          updatedAt: now,
          ...lastPublishedAtSet,
        },
      });
    `,
    },
    "db.update(users).set({ content });",
    "db.update(siteData).set({ contentIndexable: true });",
    {
      name: "a parameter shadowing a const payload is not followed",
      code: `
      const values = { content };
      export function f(values) {
        db.insert(siteData).values(values);
      }
    `,
    },
  ],
  invalid: [
    {
      code: "db.insert(siteData).values({ id, content });",
      errors: [{ messageId: "directContentWrite" }],
    },
    {
      code: "tx.update(siteData).set({ content: c, updatedAt });",
      errors: [{ messageId: "directContentWrite" }],
    },
    {
      name: "inline onConflictDoUpdate set",
      code: `
        db.insert(siteData).values(v).onConflictDoUpdate({
          target: siteData.userId,
          set: { content },
        });
      `,
      errors: [{ messageId: "directContentWrite" }],
    },
    {
      code: 'db.insert(siteData).values([{ "content": c }]);',
      errors: [{ messageId: "directContentWrite" }],
    },
    {
      name: "buildSiteDataUpsert shape with a raw content column",
      code: `
        const values = {
          id: crypto.randomUUID(),
          userId,
          resumeId,
          content,
          updatedAt: now,
        };
        db.insert(siteData).values(values);
      `,
      errors: [{ messageId: "directContentWrite" }],
    },
    {
      name: "spread of a const object",
      code: `
        const raw = { content };
        db.update(siteData).set({ ...raw, updatedAt });
      `,
      errors: [{ messageId: "directContentWrite" }],
    },
    {
      code: "db.update(siteData).set({ ...(publish ? { content } : {}) });",
      errors: [{ messageId: "directContentWrite" }],
    },
    {
      name: "shorthand set bound to a const",
      code: `
        const set = { content };
        db.insert(siteData).values(v).onConflictDoUpdate({
          target: siteData.userId,
          set,
        });
      `,
      errors: [{ messageId: "directContentWrite" }],
    },
    {
      name: "one const feeding two write sites reports once",
      code: `
        const values = { content };
        db.insert(siteData).values(values).onConflictDoUpdate({
          target: siteData.userId,
          set: values,
        });
      `,
      errors: [{ messageId: "directContentWrite" }],
    },
  ],
});

tester.run("no-stringified-errors", noStringifiedErrorsRule, {
  valid: [
    "try { f(); } catch (error) { sql`select ${error}`; }",
    'try { f(); } catch (error) { const g = (error: string) => String(error); g("x"); }',
    'try { f(); } catch (error) { log(error instanceof Error ? error.message : "x"); }',
    "export function normalize(cause: unknown) { return String(cause); }",
  ],
  invalid: [
    {
      code: "try { f(); } catch (error) { log(String(error)); }",
      errors: [{ messageId: "stringifiedError", data: { name: "error" } }],
    },
    {
      code: "try { f(); } catch (err) { log(`failed: ${err}`); }",
      errors: [{ messageId: "stringifiedError", data: { name: "err" } }],
    },
    {
      code: "p.catch((e) => log(String(e)));",
      errors: [{ messageId: "stringifiedError", data: { name: "e" } }],
    },
    {
      code: "Effect.tryPromise({ try: f, catch: (cause) => `${cause}` });",
      errors: [{ messageId: "stringifiedError", data: { name: "cause" } }],
    },
  ],
});
