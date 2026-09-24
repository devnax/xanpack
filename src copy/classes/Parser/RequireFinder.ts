import { CallExpression, Node } from "oxc-parser";
import { ImportNode } from "./ImportFinder";

class RequireFinder {
  readonly requires: Array<ImportNode> = [];
  private code: string;
  constructor(code: string) {
    this.code = code;
  }

  private parents: Node[] = [];

  enter(node: Node) {
    this.find(node);
    this.parents.push(node);
  }

  leave() {
    this.parents.pop();
  }

  find(node: Node) {
    if (
      node.type !== "CallExpression" ||
      node.callee.type !== "Identifier" ||
      node.callee.name !== "require" ||
      node.arguments.length !== 1
    ) {
      return;
    }

    this.findStaticRequires(node);
    this.findDynamicRequires(node);
  }

  private add(
    node: CallExpression,
    source: string,
    dynamic: boolean,
    glob?: string,
  ) {
    this.requires.push({
      dynamic,
      source,
      specifiers: [],
      kind: "value",
      start: node.start,
      end: node.end,
      glob,
    });
  }

  private findStaticRequires(node: CallExpression) {
    const source = node.arguments[0];
    if (source.type === "Literal" && typeof source.value === "string") {
      this.add(node, source.value, false);
    }
  }

  private findDynamicRequires(node: CallExpression) {
    const source = node.arguments[0];
    if (source.type !== "TemplateLiteral") {
      return;
    }

    if (source.expressions.length === 0) {
      this.add(node, source.quasis[0].value.cooked ?? "", false);
      return;
    }

    const dynamicSource = this.code.slice(source.start, source.end);
    let glob = "";
    for (let i = 0; i < source.quasis.length; i++) {
      glob += source.quasis[i].value.cooked ?? "";
      if (i < source.expressions.length) {
        glob += "*";
      }
    }

    this.add(node, dynamicSource, true, glob);
  }
}

export default RequireFinder;
