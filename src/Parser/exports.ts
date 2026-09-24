import { Node as AstNode } from "oxc-parser";
import type { ExportNode, ExportSpecifier } from "../types";
import Node from "../Node";

class ParseExports {
  private Node: Node;

  constructor(node: Node) {
    this.Node = node;
  }

  parse(node: AstNode) {
    if (node.type === "ExportNamedDeclaration") {
      /**
       * Handle named export declarations with variable declarations.
       * Create an ExportNode for each variable declarator.
       * export var foo = 1;
       * export const foo = 1, bar = 2;
       */
      if (node.declaration && node.declaration.type === "VariableDeclaration") {
        const exportNode: ExportNode = {
          type: "identifier",
          specifiers: [],
          start: node.start,
          end: node.end,
        };

        const codes = [];
        for (let declarator of node.declaration.declarations) {
          const local = (declarator as any).id.name;
          const specifier: ExportSpecifier = {
            local: local,
            exported: local,
          };
          exportNode.specifiers.push(specifier);
        }

        this.Node.exports.push(exportNode);
      }

      /**
       * Handle named export declarations with function or class declarations.
       * Create an ExportNode for the declaration.
       * export function foo() {}
       * export class Foo {}
       */
      if (
        node.declaration &&
        (node.declaration.type === "FunctionDeclaration" ||
          node.declaration.type === "ClassDeclaration")
      ) {
        const local = (node.declaration as any).id.name;
        const specifier: ExportSpecifier = {
          local: local,
          exported: local,
        };
        const exportNode: ExportNode = {
          type: "identifier",
          specifiers: [specifier],
          start: node.start,
          end: node.end,
        };

        this.Node.exports.push(exportNode);
      }

      /**
       * Handle named export declarations without a declaration (e.g., export { foo, bar }).
       * Create an ExportNode for each specifier.
       * export { foo, bar };
       * with source (e.g., export { foo, bar } from 'module';) handle by importParser
       */
      if (!node.declaration && node.specifiers && !node.source) {
        const exportNode: ExportNode = {
          type: "export",
          specifiers: [],
          start: node.start,
          end: node.end,
        };
        const codes: string[] = [];
        for (let specifier of node.specifiers) {
          const local = (specifier as any).local.name;
          const exported = (specifier as any).exported.name;
          exportNode.specifiers.push({ local, exported });
          codes.push(`exports.${exported} = ${local};`);
        }

        this.Node.exports.push(exportNode);
      }
    }

    // ExportDefaultDeclaration
    if (node.type === "ExportDefaultDeclaration") {
      const exportNode: ExportNode = {
        type: "default",
        specifiers: [],
        start: node.start,
        end: node.end,
      };

      this.Node.exports.push(exportNode);
    }

    // export { namedValue } from "./named-module";
    if (
      node.type === "ExportNamedDeclaration" &&
      node.specifiers &&
      node.source
    ) {
      const exportNode: ExportNode = {
        type: "re-export",
        specifiers: [],
        start: node.start,
        end: node.end,
        source: node.source.value,
      };

      for (let specifier of node.specifiers) {
        const local = (specifier as any).local.name;
        const exported = (specifier as any).exported.name;
        exportNode.specifiers.push({ local, exported });
      }

      this.Node.exports.push(exportNode);
    }

    if (node.type === "ExportAllDeclaration") {
      const local = (node as any).exported?.name;
      const exportNode: ExportNode = {
        specifiers: [],
        type: "namespace",
        namespace: local,
        start: node.start,
        end: node.end,
        source: node.source.value,
      };

      this.Node.exports.push(exportNode);
    }
  }
}

export default ParseExports;
