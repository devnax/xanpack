import fs from "node:fs/promises";
import path from "node:path";
import { parseSync } from "oxc-parser";
import { walk } from "oxc-walker";
import { transform } from "oxc-transform";
import { ResolverFactory } from "oxc-resolver";
import type { BundleOptions, Module, Plugin } from "./types.js";

export class Bundler {
  private options: BundleOptions;
  private plugins: Plugin[];
  private modules = new Map<string, Module>();
  private resolver: ResolverFactory;

  constructor(options: BundleOptions) {
    this.options = options;
    this.plugins = options.plugins || [];
    this.resolver = new ResolverFactory({
      extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
      conditionNames: ["node", "import"],
    });
  }

  async bundle(): Promise<void> {
    const input = Array.isArray(this.options.input)
      ? this.options.input
      : [this.options.input];

    console.log("📦 Starting bundle...");

    for (const file of input) {
      await this.processModule(file, null);
    }

    const output = this.generateOutput();
    await this.write(output);

    console.log(`✅ Bundle complete! Output: ${this.options.output.dir}`);
  }

  private async processModule(
    id: string,
    importer: string | null,
  ): Promise<void> {
    const resolved = await this.resolve(id, importer || process.cwd());

    if (this.modules.has(resolved)) {
      return; // Already processed
    }

    let code = await this.load(resolved);

    // Transform
    for (const plugin of this.plugins) {
      if (plugin.transform) {
        const result = plugin.transform(code, resolved);
        if (result) code = result;
      }
    }

    // Parse
    const lang =
      resolved.endsWith(".ts") || resolved.endsWith(".tsx") ? "ts" : "js";

    const transformed = await transform(resolved, code, {
      lang,
      define: {
        "process.env.NODE_ENV": JSON.stringify("development"),
      },
    });

    const ast = parseSync(resolved, transformed.code, {
      lang,
    });

    // Extract imports/exports
    const imports: any[] = [];
    const exports: any[] = [];

    walk(ast.program, {
      enter: (node) => {
        // Extract imports
        if (node.type === "ImportDeclaration") {
          imports.push({
            source: node.source?.value,
            dynamic: false,
            specifiers:
              node.specifiers?.map((s: any) => s.local?.name || s.local) || [],
          });
        }

        // Extract dynamic imports
        if (node.type === "ImportExpression") {
          const source = node.source;
          if (source?.type === "Literal") {
            imports.push({
              source: source.value,
              dynamic: true,
              specifiers: [],
            });
          }
        }

        // Extract require to imports
        if (node.type === "CallExpression" && node.callee?.name === "require") {
          const arg = node.arguments?.[0];
          if (arg?.type === "Literal") {
            imports.push({
              source: arg.value,
              dynamic: false,
              specifiers: [],
            });
          }
        }

        // Extract exports
        if (node.type === "ExportNamedDeclaration") {
          node.specifiers?.forEach((spec: any) => {
            exports.push({
              name: spec.exported?.name,
              local: spec.local?.name,
            });
          });
        }

        if (node.type === "ExportDefaultDeclaration") {
          exports.push({
            name: "default",
            local: "default",
          });
        }
      },
    });

    // Store module
    this.modules.set(resolved, {
      id: resolved,
      code: transformed.code,
      imports,
      exports,
    });

    // Process dependencies
    for (const imp of imports) {
      if (!imp.dynamic) {
        try {
          await this.processModule(imp.source, resolved);
        } catch (error) {
          console.warn(`⚠️  Failed to resolve ${imp.source} from ${resolved}`);
        }
      }
    }
  }

  private async resolve(id: string, importer: string): Promise<string> {
    // Try plugins first
    for (const plugin of this.plugins) {
      if (plugin.resolveId) {
        const result = plugin.resolveId(id, importer);
        if (result) return result;
      }
    }

    // Check if builtin
    if (id.startsWith("node:") || ["fs", "path", "os", "util"].includes(id)) {
      return id;
    }

    // Resolve with oxc-resolver
    const resolved = this.resolver.sync(path.dirname(importer), id);
    if (resolved.error) {
      throw new Error(`Cannot resolve ${id}`);
    }

    return resolved.path as string;
  }

  private async load(id: string): Promise<string> {
    // Try plugins first
    for (const plugin of this.plugins) {
      if (plugin.load) {
        const result = plugin.load(id);
        if (result) return result;
      }
    }

    // Return empty for builtins
    if (id.startsWith("node:") || ["fs", "path", "os", "util"].includes(id)) {
      return "";
    }

    return fs.readFile(id, "utf-8");
  }

  private generateOutput(): string {
    let output = `
const __modules = {};
const __cache = {};

function __require(id) {
  if (__cache[id]) return __cache[id].exports;
  const module = __modules[id];
  const exports = {};
  __cache[id] = { exports };
  if (module) module(exports, __require);
  return exports;
}
`;

    for (const [id, mod] of this.modules) {
      const transformedCode = this.transformExports(mod.code);
      output += `

__modules['${id}'] = function(exports, __require) {
${this.indent(transformedCode)}
};
`;
    }

    // Export first module
    const firstModule = this.modules.values().next().value;
    if (firstModule) {
      output += `
export default __require('${firstModule.id}');
`;
    }

    return output;
  }

  private transformExports(code: string): string {
    let transformed = code;

    // Handle: import name from "module";
    // import React from "react"; => const React = __require("react");
    transformed = transformed.replace(
      /import\s+(\w+)\s+from\s+["']([^"']+)["'];?/g,
      'const $1 = __require("$2");',
    );

    // Handle: import { name } from "module";
    // import { useState } from "react"; => const { useState } = __require("react");
    transformed = transformed.replace(
      /import\s+({[^}]+})\s+from\s+["']([^"']+)["'];?/g,
      'const $1 = __require("$2");',
    );

    // Handle: import * as name from "module";
    // import * as React from "react"; => const React = __require("react");
    transformed = transformed.replace(
      /import\s+\*\s+as\s+(\w+)\s+from\s+["']([^"']+)["'];?/g,
      'const $1 = __require("$2");',
    );

    // Dynamic import: import("module") => __require("module")
    transformed = transformed.replace(
      /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
      '__require("$1")',
    );

    // Handle: require("module") => __require("module")
    transformed = transformed.replace(/\brequire\s*\(/g, "__require(");

    // Handle: module.exports = value => exports.default = value
    transformed = transformed.replace(
      /module\.exports\s*=/g,
      "exports.default =",
    );

    // Handle: export const name = value;
    transformed = transformed.replace(
      /export\s+(const|let|var)\s+(\w+)\s*=/g,
      "const $2 =",
    );

    // Handle: export default expression;
    transformed = transformed.replace(
      /export\s+default\s+({[^}]+})/g,
      "exports.default = $1",
    );

    // Handle: export default identifier;
    transformed = transformed.replace(
      /export\s+default\s+(\w+);?$/m,
      "exports.default = $1;",
    );

    // Extract exported names and add exports
    const constMatches = transformed.matchAll(/^const\s+(\w+)\s*=/gm);
    const exportedNames = Array.from(constMatches).map((m) => m[1]);

    // Add export statements for each const
    let exportsCode = "";
    for (const name of exportedNames) {
      // Check if it's already exported as default
      if (!transformed.includes(`exports.default = ${name}`)) {
        exportsCode += `exports.${name} = ${name};\n`;
      }
    }

    // Append exports at the end if there are any
    if (exportsCode) {
      transformed = transformed.trimEnd() + "\n" + exportsCode;
    }

    return transformed;
  }

  private getModuleName(id: string): string {
    return path.basename(id).replace(/\.[^.]+$/, "");
  }

  private indent(code: string): string {
    return code
      .split("\n")
      .map((line) => (line.trim() ? "  " + line : line))
      .join("\n");
  }

  private async write(content: string): Promise<void> {
    const dir = this.options.output.dir;
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "bundle.js"), content, "utf-8");
  }
}
