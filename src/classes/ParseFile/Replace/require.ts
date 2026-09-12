import { Node } from "oxc-parser";

interface Replacement {
  type: "static" | "dynamic";
  start: number;
  end: number;
  code: string;
}

export default class ReplaceRequire {
  replacements: Replacement[] = [];

  constructor(private code: string) {}

  add(node: Node) {
    if (
      node.type !== "CallExpression" ||
      node.callee.type !== "Identifier" ||
      node.callee.name !== "require" ||
      !node.arguments[0]
    ) {
      return;
    }

    const argument = node.arguments[0];

    if (argument?.type === "Literal" && typeof argument.value === "string") {
      this.replacements.push({
        type: "static",
        start: node.start,
        end: node.end,
        code: `__xpack.import(${JSON.stringify(argument.value)})`,
      });
    } else {
      this.replacements.push({
        type: "dynamic",
        start: node.start,
        end: node.end,
        code: `__xpack.importAsync(${this.code.slice(
          argument.start,
          argument.end,
        )})`,
      });
    }
  }

  apply() {
    this.replacements.sort((a, b) => b.start - a.start);

    let result = this.code;
    for (const replacement of this.replacements) {
      result =
        result.slice(0, replacement.start) +
        replacement.code +
        result.slice(replacement.end);
    }

    this.code = result;
    this.replacements = [];

    return result;
  }
}
