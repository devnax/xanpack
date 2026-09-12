import { Node } from "oxc-parser";

interface Replacement {
  type: "default" | "named";
  start: number;
  end: number;
  code: string;
}

export default class ReplaceExport {
  replacements: Replacement[] = [];

  constructor(private code: string) {}

  add(node: Node) {
    if (node.type === "ExportDefaultDeclaration") {
      const declaration = node.declaration;

      // export default foo
      if (declaration.type === "Identifier") {
        this.replacements.push({
          type: "default",
          start: node.start,
          end: node.end,
          code: `module.exports.default = ${declaration.name};`,
        });

        return;
      }

      // export default function foo() {}
      if (declaration.type === "FunctionDeclaration" && declaration.id) {
        this.replacements.push({
          type: "default",
          start: node.start,
          end: node.end,
          code:
            this.code.slice(declaration.start, declaration.end) +
            `\nmodule.exports.default = ${declaration.id.name};`,
        });

        return;
      }

      // export default class Foo {}
      if (declaration.type === "ClassDeclaration" && declaration.id) {
        this.replacements.push({
          type: "default",
          start: node.start,
          end: node.end,
          code:
            this.code.slice(declaration.start, declaration.end) +
            `\nmodule.exports.default = ${declaration.id.name};`,
        });

        return;
      }

      // export default expression
      this.replacements.push({
        type: "default",
        start: node.start,
        end: node.end,
        code: `module.exports.default = ${this.code.slice(
          declaration.start,
          declaration.end,
        )};`,
      });

      return;
    }

    if (node.type === "ExportNamedDeclaration") {
      // export const foo = ...
      // export let foo = ...
      // export var foo = ...
      if (node.declaration) {
        const declaration = node.declaration;

        if (declaration.type === "VariableDeclaration") {
          const exports: string[] = [];

          for (const declarator of declaration.declarations) {
            if (declarator.id.type !== "Identifier") {
              continue;
            }

            exports.push(
              `module.exports.${declarator.id.name} = ${declarator.id.name};`,
            );
          }

          this.replacements.push({
            type: "named",
            start: node.start,
            end: node.end,
            code:
              this.code.slice(declaration.start, declaration.end) +
              (exports.length ? `\n${exports.join("\n")}` : ""),
          });

          return;
        }

        // export function foo() {}
        if (declaration.type === "FunctionDeclaration" && declaration.id) {
          this.replacements.push({
            type: "named",
            start: node.start,
            end: node.end,
            code:
              this.code.slice(declaration.start, declaration.end) +
              `\nmodule.exports.${declaration.id.name} = ${declaration.id.name};`,
          });

          return;
        }

        // export class Foo {}
        if (declaration.type === "ClassDeclaration" && declaration.id) {
          this.replacements.push({
            type: "named",
            start: node.start,
            end: node.end,
            code:
              this.code.slice(declaration.start, declaration.end) +
              `\nmodule.exports.${declaration.id.name} = ${declaration.id.name};`,
          });

          return;
        }
      }

      // export { foo, bar }
      if (node.specifiers.length) {
        const exports: string[] = [];

        for (const specifier of node.specifiers) {
          if (specifier.type !== "ExportSpecifier") {
            continue;
          }

          const local = specifier.local;
          const exported = specifier.exported;

          if (local.type !== "Identifier" || exported.type !== "Identifier") {
            continue;
          }

          exports.push(`module.exports.${exported.name} = ${local.name};`);
        }

        if (exports.length) {
          this.replacements.push({
            type: "named",
            start: node.start,
            end: node.end,
            code: exports.join("\n"),
          });
        }
      }
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
