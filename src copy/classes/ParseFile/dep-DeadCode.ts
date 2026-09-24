import type { Node } from "oxc-parser";

export const UNKNOWN = Symbol("UNKNOWN");

export type ConstantValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | typeof UNKNOWN;

class DeadCode {
  static evaluate(node: Node): ConstantValue {
    switch (node.type) {
      case "Literal": {
        const value = node.value;

        if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean" ||
          value === null
        ) {
          return value;
        }

        return UNKNOWN;
      }

      case "Identifier": {
        if (node.name === "undefined") {
          return undefined;
        }

        return UNKNOWN;
      }

      case "UnaryExpression":
        return this.evaluateUnary(node);

      case "BinaryExpression":
        return this.evaluateBinary(node);

      case "LogicalExpression":
        return this.evaluateLogical(node);

      default:
        return UNKNOWN;
    }
  }

  private static evaluateUnary(
    node: Extract<Node, { type: "UnaryExpression" }>,
  ): ConstantValue {
    const value = this.evaluate(node.argument);

    if (value === UNKNOWN) {
      return UNKNOWN;
    }

    switch (node.operator) {
      case "!":
        return !value;

      case "+":
        return Number(value);

      case "-":
        return -Number(value);

      case "~":
        return ~Number(value);

      case "typeof":
        return typeof value;

      case "void":
        return undefined;

      default:
        return UNKNOWN;
    }
  }

  private static evaluateBinary(
    node: Extract<Node, { type: "BinaryExpression" }>,
  ): ConstantValue {
    const left = this.evaluate(node.left);
    const right = this.evaluate(node.right);

    if (left === UNKNOWN || right === UNKNOWN) {
      return UNKNOWN;
    }

    switch (node.operator) {
      case "===":
        return left === right;

      case "!==":
        return left !== right;

      case "==":
        return left == right;

      case "!=":
        return left != right;

      case ">":
        return Number(left) > Number(right);

      case ">=":
        return Number(left) >= Number(right);

      case "<":
        return Number(left) < Number(right);

      case "<=":
        return Number(left) <= Number(right);

      case "+":
        if (typeof left === "string" || typeof right === "string") {
          return String(left) + String(right);
        }

        return Number(left) + Number(right);

      case "-":
        return Number(left) - Number(right);

      case "*":
        return Number(left) * Number(right);

      case "/":
        return Number(left) / Number(right);

      case "%":
        return Number(left) % Number(right);

      case "**":
        return Number(left) ** Number(right);

      default:
        return UNKNOWN;
    }
  }

  private static evaluateLogical(
    node: Extract<Node, { type: "LogicalExpression" }>,
  ): ConstantValue {
    const left = this.evaluate(node.left);

    if (left === UNKNOWN) {
      return UNKNOWN;
    }

    switch (node.operator) {
      case "&&":
        if (!left) {
          return left;
        }

        return this.evaluate(node.right);

      case "||":
        if (left) {
          return left;
        }

        return this.evaluate(node.right);

      case "??":
        if (left !== null && left !== undefined) {
          return left;
        }

        return this.evaluate(node.right);

      default:
        return UNKNOWN;
    }
  }

  static isTruthy(node: Node): boolean | null {
    const value = this.evaluate(node);

    if (value === UNKNOWN) {
      return null;
    }

    return Boolean(value);
  }
}

export default DeadCode;
