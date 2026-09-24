import type {
  AssignmentExpression,
  AssignmentTarget,
  Expression,
  Node,
} from "oxc-parser";
import { ExportInfo } from "./types";

export default class ExtractCJSExports {
  static extract(node: Node): ExportInfo[] {
    switch (node.type) {
      case "ExpressionStatement":
        return this.extractExpression(node.expression);

      case "AssignmentExpression":
        return this.extractAssignment(node);

      default:
        return [];
    }
  }

  private static extractExpression(node: Expression): ExportInfo[] {
    switch (node.type) {
      case "AssignmentExpression":
        return this.extractAssignment(node);

      default:
        return [];
    }
  }

  private static extractAssignment(node: AssignmentExpression): ExportInfo[] {
    if (node.operator !== "=") {
      return [];
    }

    const target = this.getTarget(node.left);

    if (!target) {
      return [];
    }

    // module.exports = ...
    if (target.type === "default") {
      return this.extractDefault(node.right);
    }

    // exports.foo = ...
    // module.exports.foo = ...
    return [
      {
        name: target.name,
        local: this.getLocalName(node.right),
        kind: "named",
        loc: {
          start: node.start,
          end: node.end,
        },
      },
    ];
  }

  private static getTarget(
    target: AssignmentTarget,
  ): { type: "default" } | { type: "named"; name: string } | null {
    if (target.type !== "MemberExpression") {
      return null;
    }

    /*
     * exports.foo
     * exports["foo"]
     */
    if (
      target.object.type === "Identifier" &&
      target.object.name === "exports"
    ) {
      const name = this.getMemberName(target);

      if (!name) {
        return null;
      }

      return {
        type: "named",
        name,
      };
    }

    /*
     * module.exports
     */
    if (
      target.object.type === "Identifier" &&
      target.object.name === "module"
    ) {
      const property = this.getMemberName(target);

      if (property === "exports") {
        return {
          type: "default",
        };
      }

      return null;
    }

    /*
     * module.exports.foo
     * module.exports["foo"]
     */
    if (target.object.type === "MemberExpression") {
      const object = target.object;

      if (
        object.object.type === "Identifier" &&
        object.object.name === "module" &&
        this.getMemberName(object) === "exports"
      ) {
        const name = this.getMemberName(target);

        if (!name) {
          return null;
        }

        return {
          type: "named",
          name,
        };
      }
    }

    return null;
  }

  private static getMemberName(
    node: Extract<AssignmentTarget, { type: "MemberExpression" }>,
  ): string | null {
    if (!node.computed) {
      if (node.property.type === "Identifier") {
        return node.property.name;
      }

      return null;
    }

    if (
      node.property.type === "Literal" &&
      typeof node.property.value === "string"
    ) {
      return node.property.value;
    }

    if (
      node.property.type === "Literal" &&
      typeof node.property.value === "number"
    ) {
      return String(node.property.value);
    }

    return null;
  }

  private static extractDefault(node: Expression): ExportInfo[] {
    /*
     * module.exports = foo
     */
    if (node.type === "Identifier") {
      return [
        {
          name: "default",
          local: node.name,
          kind: "default",
          loc: {
            start: node.start,
            end: node.end,
          },
        },
      ];
    }

    /*
     * module.exports = function foo() {}
     */
    if (node.type === "FunctionExpression") {
      return [
        {
          name: "default",
          local: node.id?.name ?? "default",
          kind: "default",
          loc: {
            start: node.start,
            end: node.end,
          },
        },
      ];
    }

    /*
     * module.exports = class Foo {}
     */
    if (node.type === "ClassExpression") {
      return [
        {
          name: "default",
          local: node.id?.name ?? "default",
          kind: "default",
          loc: {
            start: node.start,
            end: node.end,
          },
        },
      ];
    }

    /*
     * module.exports = {
     *   foo,
     *   bar,
     * }
     */
    if (node.type === "ObjectExpression") {
      return this.extractObject(node);
    }

    /*
     * module.exports = 123
     * module.exports = foo()
     * module.exports = condition ? foo : bar
     *
     * These don't have a statically identifiable local binding.
     */
    return [
      {
        name: "default",
        local: "default",
        kind: "default",
        loc: {
          start: node.start,
          end: node.end,
        },
      },
    ];
  }

  private static extractObject(
    node: Extract<Expression, { type: "ObjectExpression" }>,
  ): ExportInfo[] {
    const exports: ExportInfo[] = [];

    for (const property of node.properties) {
      if (property.type !== "Property") {
        continue;
      }

      if (property.kind !== "init") {
        continue;
      }

      const name = this.getObjectPropertyName(property);

      if (!name) {
        continue;
      }

      /*
       * {
       *   foo
       * }
       */
      if (property.shorthand) {
        if (property.value.type === "Identifier") {
          exports.push({
            name,
            local: property.value.name,
            kind: "named",
            loc: {
              start: property.start,
              end: property.end,
            },
          });
        }

        continue;
      }

      /*
       * {
       *   foo: bar
       * }
       */
      exports.push({
        name,
        local: this.getLocalName(property.value),
        kind: "named",
        loc: {
          start: property.start,
          end: property.end,
        },
      });
    }

    return exports;
  }

  private static getObjectPropertyName(
    property: Extract<
      import("oxc-parser").ObjectExpression["properties"][number],
      { type: "Property" }
    >,
  ): string | null {
    if (property.computed) {
      if (
        property.key.type === "Literal" &&
        typeof property.key.value === "string"
      ) {
        return property.key.value;
      }

      return null;
    }

    if (property.key.type === "Identifier") {
      return property.key.name;
    }

    if (
      property.key.type === "Literal" &&
      typeof property.key.value === "string"
    ) {
      return property.key.value;
    }

    if (
      property.key.type === "Literal" &&
      typeof property.key.value === "number"
    ) {
      return String(property.key.value);
    }

    return null;
  }

  private static getLocalName(node: Expression): string {
    if (node.type === "Identifier") {
      return node.name;
    }

    return "default";
  }
}
