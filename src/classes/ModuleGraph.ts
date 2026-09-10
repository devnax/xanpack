import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { parseSync } from "oxc-parser";

export type Resolved = string;

export interface ModuleNode {
  id: string;
  resolved: Resolved;
  imports: ImportInfo[];
  exports: ExportInfo[];
  type: "entry" | "module" | "external" | "asset";
}

export interface ImportInfo {
  source: string;
  resolved: Resolved | null;
  name: string;
  local: string;
  kind: "static" | "dynamic";
}

export interface ExportInfo {
  name: string;
  local: string;
  kind: "named" | "default" | "namespace" | "re-export";
}

export type ModuleNodes = Map<Resolved, ModuleNode>;

export class ModuleGraph {
  private nodes: ModuleNodes = new Map();

  async build(entry: string): Promise<void> {
    const resolved = await this.resolve(entry, process.cwd());
    await this.loadModule(resolved, "entry");

    console.log(this.nodes.get(resolved));
  }

  private async loadModule(
    resolved: Resolved,
    type: ModuleNode["type"] = "module",
  ): Promise<ModuleNode> {
    const existing = this.nodes.get(resolved);
    if (existing) {
      return existing;
    }

    const source = await fs.readFile(resolved, "utf8");

    const parsed = parseSync(resolved, source, {
      lang: this.getLanguage(resolved),
    });

    const node: ModuleNode = {
      id: resolved,
      resolved,
      imports: [],
      exports: [],
      type,
    };

    this.addNode(node);
    this.collectImports(node, parsed.program.body);
    this.collectExports(node, parsed.program.body);

    for (const importInfo of node.imports) {
      if (!importInfo.resolved) {
        continue;
      }

      await this.loadModule(importInfo.resolved);
    }

    return node;
  }

  private collectImports(node: ModuleNode, body: any[]): void {
    for (const statement of body) {
      // import x from "x"
      // import { x } from "x"
      // import * as x from "x"
      if (statement.type === "ImportDeclaration") {
        const source = statement.source.value;

        for (const specifier of statement.specifiers) {
          if (specifier.type === "ImportDefaultSpecifier") {
            node.imports.push({
              source,
              resolved: null,
              name: "default",
              local: specifier.local.name,
              kind: "static",
            });

            continue;
          }

          if (specifier.type === "ImportNamespaceSpecifier") {
            node.imports.push({
              source,
              resolved: null,
              name: "*",
              local: specifier.local.name,
              kind: "static",
            });

            continue;
          }

          if (specifier.type === "ImportSpecifier") {
            node.imports.push({
              source,
              resolved: null,
              name: this.getImportedName(specifier),
              local: specifier.local.name,
              kind: "static",
            });
          }
        }

        // import "foo"
        if (statement.specifiers.length === 0) {
          node.imports.push({
            source,
            resolved: null,
            name: "*",
            local: "",
            kind: "static",
          });
        }
      }

      // import("foo")
      if (statement.type === "ExpressionStatement") {
        this.collectDynamicImports(node, statement.expression);
      }
    }
  }

  private collectDynamicImports(node: ModuleNode, expression: any): void {
    if (
      expression?.type === "CallExpression" &&
      expression.callee?.type === "Import"
    ) {
      const argument = expression.arguments?.[0];

      if (argument?.type === "Literal" && typeof argument.value === "string") {
        node.imports.push({
          source: argument.value,
          resolved: null,
          name: "*",
          local: "",
          kind: "dynamic",
        });
      }
    }
  }

  private collectExports(node: ModuleNode, body: any[]): void {
    for (const statement of body) {
      // export default ...
      if (statement.type === "ExportDefaultDeclaration") {
        let local = "default";

        if (
          statement.declaration?.type === "FunctionDeclaration" &&
          statement.declaration.id
        ) {
          local = statement.declaration.id.name;
        }

        if (
          statement.declaration?.type === "ClassDeclaration" &&
          statement.declaration.id
        ) {
          local = statement.declaration.id.name;
        }

        node.exports.push({
          name: "default",
          local,
          kind: "default",
        });

        continue;
      }

      // export const foo
      // export function foo
      // export class Foo
      if (statement.type === "ExportNamedDeclaration") {
        if (statement.declaration) {
          const declaration = statement.declaration;

          if (declaration.type === "VariableDeclaration") {
            for (const declarationItem of declaration.declarations) {
              if (declarationItem.id.type === "Identifier") {
                node.exports.push({
                  name: declarationItem.id.name,
                  local: declarationItem.id.name,
                  kind: "named",
                });
              }
            }
          }

          if (
            declaration.type === "FunctionDeclaration" ||
            declaration.type === "ClassDeclaration"
          ) {
            if (declaration.id) {
              node.exports.push({
                name: declaration.id.name,
                local: declaration.id.name,
                kind: "named",
              });
            }
          }
        }

        // export { foo }
        // export { foo as bar }
        for (const specifier of statement.specifiers ?? []) {
          const local = this.getExportName(specifier.local);
          const name = this.getExportName(specifier.exported);

          node.exports.push({
            name,
            local,
            kind: statement.source ? "re-export" : "named",
          });
        }

        // export * from "./foo"
        if (statement.source && statement.specifiers.length === 0) {
          node.exports.push({
            name: "*",
            local: statement.source.value,
            kind: "namespace",
          });
        }
      }
    }
  }

  private async resolve(source: string, importer: string): Promise<Resolved> {
    if (source.startsWith(".") || source.startsWith("/")) {
      return this.resolveFile(source, importer);
    }
    return this.resolvePackage(source, importer);
  }

  private async resolveFile(
    source: string,
    importer: string,
  ): Promise<Resolved> {
    const base = source.startsWith("/")
      ? source
      : path.resolve(path.dirname(importer), source);

    const extensions = [
      "",
      ".js",
      ".jsx",
      ".ts",
      ".tsx",
      ".mjs",
      ".cjs",
      ".mts",
      ".cts",
    ];

    for (const extension of extensions) {
      const file = `${base}${extension}`;

      if (await this.isFile(file)) {
        return file;
      }
    }

    for (const extension of [".js", ".jsx", ".ts", ".tsx"]) {
      const file = path.join(base, `index${extension}`);

      if (await this.isFile(file)) {
        return file;
      }
    }

    throw new Error(`Cannot resolve "${source}" from "${importer}"`);
  }

  private resolvePackage(source: string, importer: string): Resolved {
    const require = createRequire(importer);
    return require.resolve(source);
  }

  private async isFile(file: string): Promise<boolean> {
    try {
      const stat = await fs.stat(file);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  private getLanguage(file: string): "js" | "jsx" | "ts" | "tsx" {
    const extension = path.extname(file);

    switch (extension) {
      case ".ts":
        return "ts";

      case ".tsx":
        return "tsx";

      case ".jsx":
        return "jsx";

      default:
        return "js";
    }
  }

  private getImportedName(specifier: any): string {
    if (specifier.imported.type === "Identifier") {
      return specifier.imported.name;
    }
    return specifier.imported.value;
  }

  private getExportName(specifier: any): string {
    if (specifier.type === "Identifier") {
      return specifier.name;
    }

    return specifier.value;
  }

  addNode(node: ModuleNode): void {
    this.nodes.set(node.resolved, node);
  }

  getNode(resolved: Resolved): ModuleNode | undefined {
    return this.nodes.get(resolved);
  }

  getNodes(): ModuleNodes {
    return this.nodes;
  }
}
