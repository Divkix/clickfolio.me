import { defineRule } from "vite-plus/lint/plugins";

import type { ESTree } from "vite-plus/lint/plugins";

import { propertyName } from "../../anti-slop/effect/shared/tagged-values.ts";
import { arrayMethodTarget } from "../../anti-slop/shared/array-method.ts";

function hasSiteDataWrite(node: ESTree.Node): boolean {
  while (node.type === "CallExpression" || node.type === "MemberExpression") {
    if (node.type === "MemberExpression") {
      node = node.object;
      continue;
    }

    const method = arrayMethodTarget(node.callee);
    const table = node.arguments[0];

    if (
      method !== null &&
      (method.name === "insert" || method.name === "update") &&
      table?.type === "Identifier" &&
      table.name === "siteData"
    ) {
      return true;
    }

    node = node.callee;
  }

  return false;
}

/** Protect site_data content writes from leaving content_indexable stale.
 * ponytail: objects passed by identifier and raw SQL are not inspected.
 */
export const siteDataContentFlagRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Require derived content columns for inline site_data content writes.",
    },
    messages: {
      directContentWrite:
        "Write site_data.content through `...siteDataContentColumns(content)` so content_indexable stays in sync.",
    },
  },
  create(context) {
    function reportDirectContentWrite(node: ESTree.Node | null): void {
      if (node?.type !== "ObjectExpression") return;

      if (
        node.properties.some(
          (property) =>
            property.type === "Property" &&
            !property.computed &&
            propertyName(property) === "content",
        )
      ) {
        context.report({ node, messageId: "directContentWrite" });
      }
    }

    return {
      CallExpression(node) {
        const method = arrayMethodTarget(node.callee);

        if (
          method === null ||
          (method.name !== "values" &&
            method.name !== "set" &&
            method.name !== "onConflictDoUpdate") ||
          !hasSiteDataWrite(method.object)
        ) {
          return;
        }

        for (const argument of node.arguments) {
          if (method.name === "onConflictDoUpdate") {
            if (argument.type !== "ObjectExpression") continue;

            for (const property of argument.properties) {
              if (property.type === "Property" && propertyName(property) === "set") {
                reportDirectContentWrite(property.value);
              }
            }
          } else if (method.name === "values" && argument.type === "ArrayExpression") {
            for (const element of argument.elements) {
              reportDirectContentWrite(element);
            }
          } else {
            reportDirectContentWrite(argument);
          }
        }
      },
    };
  },
});
