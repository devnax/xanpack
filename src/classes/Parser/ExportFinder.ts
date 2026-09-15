import { Node } from "oxc-parser";

interface Specifier {
  local: string;
  name: string;
  kind: "value" | "type";
  namespace?: string;
}

export interface ExportNode {
  source: string;
  specifiers: Specifier[];
  kind: "value" | "type";
  start: number;
  end: number;
  exportStart: number;
  exportEnd: number;
}

const EXPORT_KEYWORD_LENGTH = "export".length;
const EXPORT_DEFAULT_KEYWORD_LENGTH = "export default".length;

class ExportFinder {
  private code: string;
  readonly exports: Array<ExportNode> = [];

  constructor(code: string) {
    this.code = code;
  }

  enter(node: Node) {
    this.findExports(node);
  }

  private findExports(node: any) {
    // -----------------------------------------
    // export const foo = ...
    // export let foo = ...
    // export var foo = ...
    // export function foo() {}
    // export class Foo {}
    // -----------------------------------------
    if (node.type === "ExportNamedDeclaration" && node.declaration) {
      const declaration = node.declaration;

      if (declaration.type === "VariableDeclaration") {
        for (const declarationItem of declaration.declarations) {
          const names = this.getBindingNames(declarationItem.id);

          for (const name of names) {
            this.add({
              source: "",
              specifiers: [
                {
                  local: name,
                  name,
                  kind: node.exportKind === "type" ? "type" : "value",
                },
              ],
              kind: node.exportKind === "type" ? "type" : "value",
              start: node.start,
              end: node.end,
              exportStart: node.start,
              exportEnd: node.start + EXPORT_KEYWORD_LENGTH,
            });
          }
        }

        return;
      }

      if (
        declaration.type === "FunctionDeclaration" ||
        declaration.type === "ClassDeclaration"
      ) {
        if (declaration.id) {
          const name = declaration.id.name;

          this.add({
            source: "",
            specifiers: [
              {
                local: name,
                name,
                kind: node.exportKind === "type" ? "type" : "value",
              },
            ],
            kind: node.exportKind === "type" ? "type" : "value",
            start: node.start,
            end: node.end,
            exportStart: node.start,
            exportEnd: node.start + EXPORT_KEYWORD_LENGTH,
          });
        }

        return;
      }
    }

    // -----------------------------------------
    // export { foo };
    // export { foo as bar };
    // export { foo, bar as baz };
    // export type { Foo };
    // -----------------------------------------
    if (node.type === "ExportNamedDeclaration" && !node.source) {
      const specifiers: Specifier[] =
        node.specifiers?.map((sp: any) => {
          const local = sp.local?.name ?? sp.exported?.name ?? "default";
          const name = sp.exported?.name ?? sp.local?.name ?? "default";
          const kind =
            sp.exportKind === "type" || node.exportKind === "type"
              ? "type"
              : "value";

          return {
            local,
            name,
            kind,
          };
        }) ?? [];

      if (specifiers.length > 0) {
        this.add({
          source: "",
          specifiers,
          kind: node.exportKind === "type" ? "type" : "value",
          start: node.start,
          end: node.end,
          exportStart: node.start,
          exportEnd: node.start + EXPORT_KEYWORD_LENGTH,
        });
      }

      return;
    }

    // -----------------------------------------
    // export { foo } from "./foo";
    // export { foo as bar } from "./foo";
    // export { default as Foo } from "./foo";
    // export type { Foo } from "./types";
    // export * as utils from "./utils";
    // -----------------------------------------
    if (node.type === "ExportNamedDeclaration" && node.source) {
      const specifiers: Specifier[] =
        node.specifiers?.map((sp: any) => {
          const local = sp.local?.name ?? sp.exported?.name ?? "default";
          const name = sp.exported?.name ?? sp.local?.name ?? "default";
          const kind =
            sp.exportKind === "type" || node.exportKind === "type"
              ? "type"
              : "value";

          return {
            local,
            name,
            kind,
            namespace:
              sp.type === "ExportNamespaceSpecifier"
                ? sp.exported?.name
                : undefined,
          };
        }) ?? [];

      this.add({
        source: node.source.value,
        specifiers,
        kind: node.exportKind === "type" ? "type" : "value",
        start: node.start,
        end: node.end,
        exportStart: node.start,
        exportEnd: node.start + EXPORT_KEYWORD_LENGTH,
      });

      return;
    }

    // -----------------------------------------
    // export default foo;
    // export default 123;
    // export default foo();
    // -----------------------------------------
    if (node.type === "ExportDefaultDeclaration") {
      const declaration = node.declaration;
      let local = "default";

      if (
        declaration?.type === "FunctionDeclaration" ||
        declaration?.type === "ClassDeclaration"
      ) {
        if (declaration.id) {
          local = declaration.id.name;
        }
      }

      this.add({
        source: "",
        specifiers: [
          {
            local,
            name: "default",
            kind: "value",
          },
        ],
        kind: "value",
        start: node.start,
        end: node.end,
        exportStart: node.start,
        exportEnd: node.start + EXPORT_DEFAULT_KEYWORD_LENGTH,
      });

      return;
    }

    // -----------------------------------------
    // export * as utils from "./utils";
    // -----------------------------------------
    if (node.type === "ExportAllDeclaration" && node.source && node.exported) {
      const name = node.exported.name ?? "default";

      this.add({
        source: node.source.value,
        specifiers: [
          {
            local: name,
            name,
            kind: "value",
            namespace: name,
          },
        ],
        kind: "value",
        start: node.start,
        end: node.end,
        exportStart: node.start,
        exportEnd: node.start + EXPORT_KEYWORD_LENGTH,
      });

      return;
    }

    // -----------------------------------------
    // export * from "./module";
    // -----------------------------------------
    if (node.type === "ExportAllDeclaration" && node.source) {
      this.add({
        source: node.source.value,
        specifiers: [],
        kind: "value",
        start: node.start,
        end: node.end,
        exportStart: node.start,
        exportEnd: node.start + EXPORT_KEYWORD_LENGTH,
      });
    }
  }

  private getBindingNames(pattern: any): string[] {
    if (!pattern) {
      return [];
    }

    if (pattern.type === "Identifier") {
      return [pattern.name];
    }

    if (pattern.type === "ObjectPattern") {
      const names: string[] = [];

      for (const property of pattern.properties ?? []) {
        if (property.type === "Property") {
          names.push(...this.getBindingNames(property.value));
        } else if (property.type === "RestElement") {
          names.push(...this.getBindingNames(property.argument));
        }
      }

      return names;
    }

    if (pattern.type === "ArrayPattern") {
      const names: string[] = [];

      for (const element of pattern.elements ?? []) {
        if (element) {
          names.push(...this.getBindingNames(element));
        }
      }

      return names;
    }

    if (pattern.type === "AssignmentPattern") {
      return this.getBindingNames(pattern.left);
    }

    if (pattern.type === "RestElement") {
      return this.getBindingNames(pattern.argument);
    }

    return [];
  }

  private add(exportNode: ExportNode) {
    this.exports.push(exportNode);
  }
}

export default ExportFinder;
