import { Node } from "oxc-parser";

export interface Specifier {
  local: string;
  name: string;
  kind: "value" | "type";
  namespace?: string;
}

export interface ImportNode {
  dynamic: boolean;
  source: string;
  glob?: string;
  specifiers: Specifier[];
  kind: "value" | "type";
  start: number;
  end: number;
  resolved?: string;
}

class ImportFinder {
  private code: string;
  readonly imports: Array<ImportNode> = [];

  constructor(code: string) {
    this.code = code;
  }

  enter(node: Node) {
    this.findStaticImports(node);
    this.findDynamicImports(node);
    this.findReExportImports(node);
  }

  /**
   * import static modules from the code
   * example:
   * import { useState } from "react";
   * import ReactDOM from "react-dom";
   */
  private findStaticImports(node: Node) {
    if (node.type === "ImportDeclaration") {
      const specifiers = node.specifiers.map((sp: any) => ({
        local: sp.local.name,
        name: sp.imported ? sp.imported.name : "default",
        kind: sp.importKind === "type" ? "type" : ("value" as any),
        namespace:
          sp.type === "ImportNamespaceSpecifier" ? sp.local.name : undefined,
      }));

      this.imports.push({
        dynamic: false,
        source: node.source.value,
        specifiers,
        kind: node.importKind === "type" ? "type" : "value",
        start: node.start,
        end: node.end,
      });
    }
  }

  private findDynamicImports(node: Node) {
    if (node.type !== "ImportExpression") {
      return;
    }

    const source = node.source;
    // import("./foo")
    if (source.type === "Literal" && typeof source.value === "string") {
      this.imports.push({
        dynamic: true,
        source: source.value,
        specifiers: [],
        kind: "value",
        start: node.start,
        end: node.end,
      });

      return;
    }

    // import(`./foo`)
    // import(`./${name}.js`)
    // import(`./components/${name}/${file}.js`)
    if (source.type === "TemplateLiteral") {
      const dynamicSource = this.code.slice(source.start, source.end);
      // import(`./foo`)
      if (source.expressions.length === 0) {
        this.imports.push({
          dynamic: true,
          source: source.quasis[0].value.cooked ?? "",
          specifiers: [],
          kind: "value",
          start: node.start,
          end: node.end,
        });
        return;
      }

      let glob = "";
      for (let i = 0; i < source.quasis.length; i++) {
        glob += source.quasis[i].value.cooked ?? "";
        if (i < source.expressions.length) {
          glob += "*";
        }
      }

      this.imports.push({
        dynamic: true,
        source: dynamicSource,
        glob,
        specifiers: [],
        kind: "value",
        start: node.start,
        end: node.end,
      });

      return;
    }

    // import(path)
    // import("./" + name)
    const dynamicSource = this.code.slice(source.start, source.end);

    this.imports.push({
      dynamic: true,
      source: dynamicSource,
      specifiers: [],
      kind: "value",
      start: node.start,
      end: node.end,
    });
  }

  private findReExportImports(node: Node) {
    if (node.type === "ExportNamedDeclaration" && node.source) {
      const specifiers =
        node.specifiers?.map((sp: any) => ({
          local: sp.local?.name ?? sp.exported?.name ?? "default",
          name: sp.exported?.name ?? sp.local?.name ?? "default",
          kind: sp.exportKind === "type" ? "type" : "value",
          namespace:
            sp.type === "ExportNamespaceSpecifier"
              ? sp.exported?.name
              : undefined,
        })) ?? [];

      this.imports.push({
        dynamic: false,
        source: node.source.value,
        specifiers: specifiers as Specifier[],
        kind: node.exportKind === "type" ? "type" : "value",
        start: node.start,
        end: node.end,
      });

      return;
    }

    if (node.type === "ExportAllDeclaration" && node.source) {
      this.imports.push({
        dynamic: false,
        source: node.source.value,
        specifiers: [],
        kind: "value",
        start: node.start,
        end: node.end,
      });
    }
  }
}

export default ImportFinder;
