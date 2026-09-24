import { Node as AstNode } from "oxc-parser";

import Node from "../Node";
import { ImportSpecifier } from "../types";

class ParseImport {
  private Node: Node;
  private code: string;

  constructor(node: Node) {
    this.Node = node;
    this.code = node.code;
  }

  parse(node: AstNode) {
    this.findStaticImports(node);
    this.findDynamicImports(node);
    this.findReExportImports(node);
  }

  /**
   * import foo from "./module";
   * import { foo } from "./module";
   * import { foo as bar } from "./module";
   * import * as foo from "./module";
   * import foo, { bar } from "./module";
   * import foo, * as bar from "./module";
   * import "./module";
   */
  private findStaticImports(node: AstNode) {
    if (node.type !== "ImportDeclaration") {
      return;
    }

    const specifiers: ImportSpecifier[] = node.specifiers.map((sp: any) => {
      if (sp.type === "ImportDefaultSpecifier") {
        return {
          type: "default",
          imported: "default",
          local: sp.local.name,
          namespace: undefined,
        };
      }

      if (sp.type === "ImportNamespaceSpecifier") {
        return {
          type: "namespace",
          imported: "*",
          local: sp.local.name,
          namespace: sp.local.name,
        };
      }

      return {
        type: "named",
        imported: sp.imported.name,
        local: sp.local.name,
        namespace: undefined,
      };
    });

    this.Node.imports.push({
      type: "static",
      source: node.source.value,
      specifiers,
      start: node.start,
      end: node.end,
    });
  }

  /**
   * import("./module");
   * import(`./module`);
   * import(`./pages/${name}.js`);
   * import(path);
   */
  private findDynamicImports(node: AstNode) {
    if (node.type !== "ImportExpression") {
      return;
    }

    const source = node.source;

    /*
     * import("./module")
     */
    if (source.type === "Literal" && typeof source.value === "string") {
      this.Node.imports.push({
        type: "dynamic",
        source: source.value,
        start: node.start,
        end: node.end,
      });

      return;
    }

    /*
     * import(`./module`)
     *
     * import(`./pages/${name}.js`)
     *
     * import(`./pages/${name}/${file}.js`)
     */
    if (source.type === "TemplateLiteral") {
      const dynamicSource = this.code.slice(source.start, source.end);

      /*
       * import(`./module`)
       */
      if (source.expressions.length === 0) {
        this.Node.imports.push({
          type: "dynamic",
          source: source.quasis[0].value.cooked ?? "",
          start: node.start,
          end: node.end,
        });

        return;
      }

      /*
       * import(`./pages/${name}.js`)
       *
       * becomes:
       *
       * ./pages/*.js
       */
      const glob = this.createGlob(source);

      this.Node.imports.push({
        type: "dynamic",
        source: dynamicSource,
        glob,
        start: node.start,
        end: node.end,
      });

      return;
    }

    /*
     * import(path)
     *
     * import("./" + name)
     */
    const dynamicSource = this.code.slice(source.start, source.end);

    this.Node.imports.push({
      type: "dynamic",
      source: dynamicSource,
      start: node.start,
      end: node.end,
    });
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

  /**
   * Re-exports:
   *
   * export { foo } from "./module";
   *
   * export { foo as bar } from "./module";
   *
   * export { default as Foo } from "./module";
   *
   * export { foo, bar as baz } from "./module";
   *
   * export * from "./module";
   *
   * export * as Foo from "./module";
   */
  private findReExportImports(node: AstNode) {
    if (node.type === "ExportNamedDeclaration" && node.source) {
      this.parseNamedReExport(node);
      return;
    }

    if (node.type === "ExportAllDeclaration" && node.source) {
      this.parseExportAll(node);
    }
  }

  /**
   * export {
   *   foo,
   *   bar as baz
   * } from "./module";
   */
  private parseNamedReExport(node: any) {
    const specifiers: ImportSpecifier[] = (node.specifiers ?? []).map(
      (sp: any) => {
        /*
         * export { foo as bar } from "./module";
         *
         * foo = dependency export
         * bar = current module export
         */
        if (sp.type === "ExportSpecifier") {
          return {
            type: "named",
            imported: sp.local?.name ?? "default",
            local: sp.exported?.name ?? "default",
            namespace: undefined,
          };
        }

        /*
         * export * as Foo from "./module";
         */
        if (sp.type === "ExportNamespaceSpecifier") {
          return {
            type: "namespace",
            imported: "*",
            local: sp.exported?.name ?? "default",
            namespace: sp.exported?.name,
          };
        }

        return {
          type: "named",
          imported: sp.local?.name ?? "default",
          local: sp.exported?.name ?? "default",
          namespace: undefined,
        };
      },
    );

    this.Node.imports.push({
      type: "re-export",
      source: node.source.value,
      specifiers,
      start: node.start,
      end: node.end,
    });
  }

  /**
   * export * from "./module";
   */
  private parseExportAll(node: any) {
    /*
     * export * as Foo from "./module";
     */
    if (node.exported) {
      this.Node.imports.push({
        type: "re-export",
        source: node.source.value,
        specifiers: [
          {
            type: "namespace",
            imported: "*",
            local: node.exported.name,
            namespace: node.exported.name,
          },
        ],
        start: node.start,
        end: node.end,
      });

      return;
    }

    /*
     * export * from "./module";
     *
     * There is no local name.
     *
     * "*" means re-export all named exports.
     */
    this.Node.imports.push({
      type: "re-export",
      source: node.source.value,
      specifiers: [
        {
          type: "namespace",
          imported: "*",
          local: "*",
          namespace: undefined,
        },
      ],
      start: node.start,
      end: node.end,
    });
  }
}

export default ParseImport;
