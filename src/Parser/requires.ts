import { Node as AstNode } from "oxc-parser";
import Node from "../Node";

class ParseRequire {
  private Node: Node;
  private code: string;

  constructor(node: Node) {
    this.Node = node;
    this.code = node.code;
  }

  parse(node: AstNode) {
    this.findRequire(node);
  }

  private findRequire(node: AstNode) {
    if (node.type !== "CallExpression") {
      return;
    }

    if (!this.isRequireCall(node)) {
      return;
    }

    const argument = node.arguments?.[0];
    if (!argument) {
      return;
    }

    /*
     * require("./module")
     */
    if (argument.type === "Literal" && typeof argument.value === "string") {
      this.Node.requires.push({
        type: "static",
        source: argument.value,
        start: node.start,
        end: node.end,
      });
      return;
    }

    /*
     * require(`./module`)
     *
     * This is still static because there
     * are no template expressions.
     */
    if (argument.type === "TemplateLiteral") {
      this.parseTemplateRequire(node, argument);
      return;
    }

    /*
     * require(path)
     *
     * require("./" + name)
     *
     * require(getModule())
     */
    const source = this.code.slice(argument.start, argument.end);
    this.Node.requires.push({
      type: "dynamic",
      source,
      start: node.start,
      end: node.end,
    });
  }

  private parseTemplateRequire(node: AstNode, source: any) {
    const dynamicSource = this.code.slice(source.start, source.end);

    /*
     * require(`./module`)
     */
    if (source.expressions.length === 0) {
      this.Node.requires.push({
        type: "static",
        source: source.quasis[0].value.cooked ?? "",
        start: node.start,
        end: node.end,
      });

      return;
    }

    /*
     * require(`./pages/${name}.js`)
     *
     * ./pages/*.js
     */
    const glob = this.createGlob(source);
    this.Node.requires.push({
      type: "dynamic",
      source: dynamicSource,
      glob,
      start: node.start,
      end: node.end,
    });
  }

  private isRequireCall(node: any) {
    const callee = node.callee;
    return callee?.type === "Identifier" && callee.name === "require";
  }

  private createGlob(source: any) {
    let glob = "";

    for (let i = 0; i < source.quasis.length; i++) {
      glob += source.quasis[i].value.cooked ?? "";
      if (i < source.expressions.length) {
        glob += "*";
      }
    }

    return glob;
  }
}

export default ParseRequire;
