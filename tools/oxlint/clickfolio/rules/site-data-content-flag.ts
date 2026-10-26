import { defineRule } from "vite-plus/lint/plugins";

import type { ESTree } from "vite-plus/lint/plugins";

import { propertyName } from "../../anti-slop/effect/shared/tagged-values.ts";
import { arrayMethodTarget } from "../../anti-slop/shared/array-method.ts";
import { resolveVariable } from "../../anti-slop/shared/scope.ts";

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
 * Blind spots: payloads built in another function (parameters, call results, imports),
 * let/var bindings, mutation after construction (values.content = …), and raw SQL.
 */
export const siteDataContentFlagRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Require derived content columns for site_data content writes.",
    },
    messages: {
      directContentWrite:
        "Write site_data.content through `...siteDataContentColumns(content)` so content_indexable stays in sync.",
    },
  },
  create(context) {
    const reported = new Set<ESTree.ObjectExpression>();

    function resolveObject(
      node: ESTree.Expression | ESTree.SpreadElement | null,
    ): ESTree.ObjectExpression | null {
      const visited = new Set<ESTree.IdentifierReference>();

      while (node?.type === "Identifier") {
        if (visited.has(node)) return null;

        visited.add(node);

        const variable = resolveVariable(context.sourceCode, node);

        if (variable === null || variable.defs.length !== 1) return null;

        const [definition] = variable.defs;

        if (
          definition?.type !== "Variable" ||
          definition.node.type !== "VariableDeclarator" ||
          definition.node.id.type !== "Identifier" ||
          definition.parent?.type !== "VariableDeclaration" ||
          definition.parent.kind !== "const"
        ) {
          return null;
        }

        node = definition.node.init;
      }

      return node?.type === "ObjectExpression" ? node : null;
    }

    function reportSpreadContentWrite(
      node: ESTree.Expression,
      visited: Set<ESTree.ObjectExpression>,
    ): void {
      if (node.type === "ConditionalExpression") {
        reportSpreadContentWrite(node.consequent, visited);
        reportSpreadContentWrite(node.alternate, visited);
      } else if (node.type === "LogicalExpression") {
        reportSpreadContentWrite(node.right, visited);
      } else {
        reportDirectContentWrite(node, visited);
      }
    }

    function reportDirectContentWrite(
      node: ESTree.Expression | ESTree.SpreadElement | null,
      visited = new Set<ESTree.ObjectExpression>(),
    ): void {
      const object = resolveObject(node);

      if (object === null || visited.has(object)) return;

      visited.add(object);

      if (
        !reported.has(object) &&
        object.properties.some(
          (property) =>
            property.type === "Property" &&
            !property.computed &&
            propertyName(property) === "content",
        )
      ) {
        reported.add(object);
        context.report({ node: object, messageId: "directContentWrite" });
      }

      for (const property of object.properties) {
        if (property.type === "SpreadElement") {
          reportSpreadContentWrite(property.argument, visited);
        }
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
            const object = resolveObject(argument);

            if (object === null) continue;

            for (const property of object.properties) {
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
