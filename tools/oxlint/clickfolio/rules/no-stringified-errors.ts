import { defineRule } from "vite-plus/lint/plugins";

import { resolveVariable } from "../../anti-slop/shared/scope.ts";

import type { ESTree, SourceCode } from "vite-plus/lint/plugins";

function isCatchName(node: ESTree.Node, computed: boolean): boolean {
  return (
    (!computed && node.type === "Identifier" && node.name === "catch") ||
    (node.type === "Literal" && node.value === "catch")
  );
}

function isCatchCallback(node: ESTree.Function | ESTree.ArrowFunctionExpression): boolean {
  const parent = node.parent;

  if (parent.type === "Property") {
    return (
      parent.parent.type === "ObjectExpression" &&
      parent.value === node &&
      isCatchName(parent.key, parent.computed)
    );
  }

  if (
    parent.type !== "CallExpression" ||
    parent.arguments[0] !== node ||
    parent.callee.type !== "MemberExpression"
  ) {
    return false;
  }

  const member = parent.callee;

  return isCatchName(member.property, member.computed);
}

function isCaughtReference(
  sourceCode: SourceCode,
  identifier: ESTree.IdentifierReference,
): boolean {
  const variable = resolveVariable(sourceCode, identifier);

  if (variable === null) return false;

  for (const definition of variable.defs) {
    const node = definition.node;

    if (definition.type === "CatchClause" && node.type === "CatchClause") {
      if (node.param?.type === "Identifier") return true;

      continue;
    }

    if (
      definition.type !== "Parameter" ||
      (node.type !== "ArrowFunctionExpression" && node.type !== "FunctionExpression") ||
      node.params[0]?.type !== "Identifier" ||
      definition.name !== node.params[0] ||
      !isCatchCallback(node)
    ) {
      continue;
    }

    let ancestor: ESTree.Node | null = identifier.parent;

    while (ancestor !== null && ancestor !== node) {
      if (ancestor === node.body) return true;

      ancestor = ancestor.parent;
    }
  }

  return false;
}

/** Protect caught-error redaction; ponytail: aliases and indirectly supplied catch callbacks are not tracked. */
export const noStringifiedErrorsRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Require errorFields() instead of stringifying caught error bindings.",
    },
    messages: {
      stringifiedError:
        "Log caught `{{name}}` as `...errorFields({{name}})`: String() and template interpolation skip its SQL-param stripping and email redaction.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== "Identifier" || node.callee.name !== "String") return;

        const argument = node.arguments[0];

        if (argument?.type !== "Identifier" || !isCaughtReference(context.sourceCode, argument)) {
          return;
        }

        context.report({
          node,
          messageId: "stringifiedError",
          data: { name: argument.name },
        });
      },
      TemplateLiteral(node) {
        if (node.parent.type === "TaggedTemplateExpression") return;

        for (const expression of node.expressions) {
          if (
            expression.type !== "Identifier" ||
            !isCaughtReference(context.sourceCode, expression)
          ) {
            continue;
          }

          context.report({
            node,
            messageId: "stringifiedError",
            data: { name: expression.name },
          });
        }
      },
    };
  },
});
