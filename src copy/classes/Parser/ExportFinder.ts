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
  replacement: string;
}

const EXPORT_KEYWORD_LENGTH = "export ".length;
const EXPORT_DEFAULT_KEYWORD_LENGTH = "export default ".length;

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
    // export const/let/var
    if (node.type === "ExportNamedDeclaration" && node.declaration) {
      const declaration = node.declaration;

      if (declaration.type === "VariableDeclaration") {
        const specifiers: Specifier[] = [];

        for (const declarationItem of declaration.declarations) {
          const names = this.getBindingNames(declarationItem.id);

          for (const name of names) {
            specifiers.push({
              local: name,
              name,
              kind: node.exportKind === "type" ? "type" : "value",
            });
          }
        }

        const kind = node.exportKind === "type" ? "type" : "value";

        const declarationCode = this.cleanCode(
          this.code.slice(declaration.start, declaration.end),
        );

        const replacement =
          kind === "type"
            ? declarationCode
            : [
                declarationCode,
                ...specifiers.map(
                  (specifier) =>
                    `exports.${this.getExportName(specifier.name)} = ${specifier.local};`,
                ),
              ].join("\n");

        this.add({
          source: "",
          specifiers,
          kind,
          start: node.start,
          end: node.end,
          exportStart: node.start,
          exportEnd: node.start + EXPORT_KEYWORD_LENGTH,
          replacement,
        });

        return;
      }

      // export function foo()
      // export class Foo
      if (
        declaration.type === "FunctionDeclaration" ||
        declaration.type === "ClassDeclaration"
      ) {
        if (declaration.id) {
          const name = declaration.id.name;
          const kind = node.exportKind === "type" ? "type" : "value";

          const declarationCode = this.cleanCode(
            this.code.slice(declaration.start, declaration.end),
          );

          const replacement =
            kind === "type"
              ? declarationCode
              : [
                  declarationCode,
                  `exports.${this.getExportName(name)} = ${name};`,
                ].join("\n");

          this.add({
            source: "",
            specifiers: [
              {
                local: name,
                name,
                kind,
              },
            ],
            kind,
            start: node.start,
            end: node.end,
            exportStart: node.start,
            exportEnd: node.start + EXPORT_KEYWORD_LENGTH,
            replacement,
          });
        }

        return;
      }
    }

    // export { foo }
    // export { foo as bar }
    // export type { Foo }
    if (node.type === "ExportNamedDeclaration" && !node.source) {
      const specifiers: Specifier[] =
        node.specifiers?.map((sp: any) => {
          const local =
            sp.local?.name ??
            sp.local?.value ??
            sp.exported?.name ??
            sp.exported?.value ??
            "default";

          const name =
            sp.exported?.name ??
            sp.exported?.value ??
            sp.local?.name ??
            sp.local?.value ??
            "default";

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
        const kind = node.exportKind === "type" ? "type" : "value";

        const replacement =
          kind === "type"
            ? ""
            : specifiers
                .map(
                  (specifier) =>
                    `exports.${this.getExportName(specifier.name)} = ${specifier.local};`,
                )
                .join("\n");

        this.add({
          source: "",
          specifiers,
          kind,
          start: node.start,
          end: node.end,
          exportStart: node.start,
          exportEnd: node.start + EXPORT_KEYWORD_LENGTH,
          replacement,
        });
      }

      return;
    }

    // export { foo } from "./foo"
    // export { foo as bar } from "./foo"
    // export * as utils from "./utils"
    if (node.type === "ExportNamedDeclaration" && node.source) {
      const specifiers: Specifier[] =
        node.specifiers?.map((sp: any) => {
          const local =
            sp.local?.name ??
            sp.local?.value ??
            sp.exported?.name ??
            sp.exported?.value ??
            "default";

          const name =
            sp.exported?.name ??
            sp.exported?.value ??
            sp.local?.name ??
            sp.local?.value ??
            "default";

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
                ? (sp.exported?.name ?? sp.exported?.value)
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

        // Re-exports are resolved later by the linker.
        replacement: "",
      });

      return;
    }

    // export default function foo() {}
    // export default class Foo {}
    // export default expression
    if (node.type === "ExportDefaultDeclaration") {
      const declaration = node.declaration;

      let local = "default";
      let replacement = "";

      if (
        declaration?.type === "FunctionDeclaration" ||
        declaration?.type === "ClassDeclaration"
      ) {
        if (declaration.id) {
          local = declaration.id.name;

          const declarationCode = this.cleanCode(
            this.code.slice(declaration.start, declaration.end),
          );

          replacement = [declarationCode, `exports.default = ${local};`].join(
            "\n",
          );
        } else {
          const declarationCode = this.cleanCode(
            this.code.slice(declaration.start, declaration.end),
          );

          replacement = `exports.default = ${declarationCode};`;
        }
      } else {
        const declarationCode = this.cleanCode(
          this.code.slice(declaration.start, declaration.end),
        );

        replacement = `exports.default = ${declarationCode};`;
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
        replacement,
      });

      return;
    }

    // export * as utils from "./utils"
    if (node.type === "ExportAllDeclaration" && node.source && node.exported) {
      const name = node.exported.name ?? node.exported.value ?? "default";

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

        replacement: "",
      });

      return;
    }

    // export * from "./module"
    if (node.type === "ExportAllDeclaration" && node.source) {
      this.add({
        source: node.source.value,
        specifiers: [],
        kind: "value",
        start: node.start,
        end: node.end,
        exportStart: node.start,
        exportEnd: node.start + EXPORT_KEYWORD_LENGTH,

        replacement: "",
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

  /**
   * Removes comments while preserving:
   *
   * - strings
   * - template literals
   * - regex literals
   * - escaped characters
   * - line structure
   */
  private cleanCode(code: string): string {
    let result = "";

    let i = 0;
    let state:
      | "code"
      | "single"
      | "double"
      | "template"
      | "line-comment"
      | "block-comment"
      | "regex" = "code";

    let escaped = false;
    let regexClass = false;

    while (i < code.length) {
      const char = code[i];
      const next = code[i + 1];

      if (state === "line-comment") {
        if (char === "\n" || char === "\r") {
          result += char;
          state = "code";
        } else {
          result += " ";
        }

        i++;
        continue;
      }

      if (state === "block-comment") {
        if (char === "*" && next === "/") {
          result += "  ";
          i += 2;
          state = "code";
          continue;
        }

        if (char === "\n" || char === "\r") {
          result += char;
        } else {
          result += " ";
        }

        i++;
        continue;
      }

      if (state === "single") {
        result += char;

        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === "'") {
          state = "code";
        }

        i++;
        continue;
      }

      if (state === "double") {
        result += char;

        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === '"') {
          state = "code";
        }

        i++;
        continue;
      }

      if (state === "template") {
        result += char;

        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === "`") {
          state = "code";
        }

        i++;
        continue;
      }

      if (state === "regex") {
        result += char;

        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === "[") {
          regexClass = true;
        } else if (char === "]") {
          regexClass = false;
        } else if (char === "/" && !regexClass) {
          state = "code";
        }

        i++;
        continue;
      }

      // CODE

      if (char === "/" && next === "/") {
        result += "  ";
        i += 2;
        state = "line-comment";
        continue;
      }

      if (char === "/" && next === "*") {
        result += "  ";
        i += 2;
        state = "block-comment";
        continue;
      }

      if (char === "'") {
        result += char;
        state = "single";
        escaped = false;
        i++;
        continue;
      }

      if (char === '"') {
        result += char;
        state = "double";
        escaped = false;
        i++;
        continue;
      }

      if (char === "`") {
        result += char;
        state = "template";
        escaped = false;
        i++;
        continue;
      }

      /*
       * Detect a regex literal.
       *
       * This is intentionally conservative. We only treat `/` as a
       * regex when the previous significant character indicates that
       * an expression can start there.
       */
      if (char === "/" && next !== "/" && next !== "*") {
        const previous = this.getPreviousSignificantCharacter(result);

        if (previous === "" || "([{:;,=!?&|+-*%^~<>".includes(previous)) {
          result += char;
          state = "regex";
          regexClass = false;
          escaped = false;
          i++;
          continue;
        }
      }

      result += char;
      i++;
    }

    return result.trim();
  }

  private getPreviousSignificantCharacter(code: string): string {
    for (let i = code.length - 1; i >= 0; i--) {
      if (!/\s/.test(code[i])) {
        return code[i];
      }
    }

    return "";
  }

  private getExportName(name: string): string {
    /*
     * Identifier exports can be emitted directly.
     *
     * For unusual names, use bracket notation.
     */
    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
      return name;
    }

    return JSON.stringify(name);
  }

  private add(exportNode: ExportNode) {
    this.exports.push(exportNode);
  }
}

export default ExportFinder;
