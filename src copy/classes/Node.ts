import fs from "node:fs/promises";
import path from "node:path";
import Xanpack from "./Xanpack";
import ImportFinder, { ImportNode } from "./Parser/ImportFinder.js";
import ExportFinder, { ExportNode } from "./Parser/ExportFinder.js";
import { ResolverFactory } from "oxc-resolver";
import { builtinModules } from "node:module";
import { Comment, parseSync } from "oxc-parser";
import { walk, ScopeTracker } from "oxc-walker";
import { ReplacerResult, ResolverResult } from "../types/Xanpack.js";
import RequireFinder from "./Parser/RequireFinder.js";
import { SourceMap, transform } from "oxc-transform";

export type NodeOption = {
  xpack: Xanpack;
  source: string;
  importer: string;
};

class Node {
  name: string = "";
  id: string = "";
  code: string = "";
  xpack: Xanpack;
  source: string;
  importer: string;
  sourceType: ResolverResult["type"] = "source";

  sourcemap: SourceMap | undefined;
  imports: ImportNode[] = [];
  requires: ImportNode[] = [];
  exports: ExportNode[] = [];
  scopeTracker: ScopeTracker;
  comments: Comment[] = [];

  constructor(options: NodeOption) {
    this.source = options.source;
    this.xpack = options.xpack;
    this.importer = options.importer;
    this.scopeTracker = new ScopeTracker({
      preserveExitedScopes: true,
    });
  }

  async build() {
    if (!this.id) {
      throw new Error(
        `Source not resolved for node with source: ${this.source}`,
      );
    }
    await this.load();
    await this.transform();
    this.replacer();
    await this.parse();
    this.name = this.generateName(this.id);

    // for (const _import of [...this.imports, ...this.requires]) {
    //   if (!_import.dynamic) {
    //     const node = new Node({
    //       xpack: this.xpack,
    //       source: _import.source,
    //       importer: this.id,
    //     });
    //     const resolved = await node.resolve();
    //     if (this.xpack.nodes.has(resolved.id)) {
    //       continue;
    //     }
    //     this.xpack.nodes.set(resolved.id, node);
    //     _import.resolved = resolved.id;

    //     if (resolved.type === "source") {
    //       await node.build();
    //     }
    //   }
    // }
  }

  async resolve() {
    const plugins = this.xpack.option.plugins || [];
    const source = this.source;
    const isBuiltin =
      builtinModules.includes(source) || source.startsWith("node:");

    if (isBuiltin) {
      this.id = this.source;
      this.sourceType = "external";
      return {
        id: this.source,
        type: "external",
      };
    }

    for (const plugin of plugins) {
      if (plugin.resolveId) {
        const result = await plugin.resolveId(this.source, this.importer);
        if (result) {
          this.id = result.id;
          this.sourceType = result.type;
          return {
            id: result.id,
            type: result.type,
          };
        }
      }
    }

    const extensions = [".ts", ".tsx", ".js", ".jsx", ".json"];
    const resolver = new ResolverFactory({
      conditionNames: ["node", "import"],
      extensions: extensions,
    });

    const resolved = resolver.sync(path.dirname(this.importer), this.source);
    if (resolved.error) {
      throw new Error(`Failed to resolve module: ${this.source}`);
    }
    const ext = path.extname(resolved.path as string);
    const type = extensions.includes(ext) ? "source" : "asset";
    this.id = resolved.path as string;
    this.sourceType = type;
    return {
      id: resolved.path as string,
      type: type,
    };
  }

  async generate() {
    let replacements: ReplacerResult[] = [];
    for (const _import of [...this.imports, ...this.requires]) {
      if (!_import.dynamic) {
        const importNode = this.xpack.nodes.get(_import.resolved!);
        const isSource = importNode?.sourceType === "source";
        if (!isSource) continue;

        replacements.push({
          start: _import.start,
          end: _import.end,
          code: `${importNode.name}()`,
        });
      } else {
        replacements.push({
          start: _import.start,
          end: _import.end,
          code: `__require(${_import.source})`,
        });
      }
    }

    // for (let _export of this.exports) {
    //   replacements.push({
    //     start: _export.start,
    //     end: _export.end,
    //     code: _export.replacement,
    //   });
    // }

    // apply replacements
    let code = this.code;
    const sorted = replacements.sort((a, b) => b.start - a.start);
    for (const replacement of sorted) {
      code =
        code.slice(0, replacement.start) +
        replacement.code +
        code.slice(replacement.end);
    }

    this.code = code;
    const result = code.replace(
      /^(\s*)export\s+(?=(?:const|let|var|function|class)\b)/gm,
      "$1",
    );

    return `const ${this.name} = __xmod((module, exports) => {\n${result}\n})`;
  }

  private indent() {
    return (this.code = this.code
      .split("\n")
      .map((line) => "  " + line)
      .join("\n"));
  }

  private async load() {
    const plugins = this.xpack.option.plugins || [];
    for (const plugin of plugins) {
      if (plugin.load) {
        const result = await plugin.load(this.id);
        if (result) {
          this.code = result;
          return;
        }
      }
    }
    this.code = await fs.readFile(this.id, "utf-8");
  }

  private async transform() {
    const plugins = this.xpack.option.plugins || [];
    for (const plugin of plugins) {
      if (plugin && typeof plugin.transform === "function") {
        const _code = await plugin.transform(this.code, this.id);
        if (_code !== null) {
          this.code = _code;
        }
      }
    }
  }

  private replacer() {
    let code = this.code;
    const id = this.id;
    const lang = this.getLanguage();
    const parsed = parseSync(id, code, { lang });
    const plugins = this.xpack.option.plugins || [];
    const replacers = plugins.map((plugin) => plugin.replacer).filter(Boolean);

    const replacements: Array<ReplacerResult> = [];
    if (replacers.length === 0) {
      walk(parsed.program, {
        enter(node) {
          for (const replacer of replacers) {
            if (replacer) {
              const result = replacer(id, node);
              if (result) {
                replacements.push(result);
                this.skip();
                break;
              }
            }
          }
        },
      });
    }

    for (const comment of parsed.comments) {
      const { start, end } = comment;
      replacements.push({ start, end, code: "" });
    }

    const sorted = replacements.sort((a, b) => b.start - a.start);
    for (const { start, end, code: _code } of sorted) {
      code = code.slice(0, start) + _code + code.slice(end);
    }
    this.code = code;
  }

  private async parse() {
    const option = this.xpack.option;
    const lang = this.getLanguage();
    const result = await transform(this.id, this.code, {
      ...option.transform,
      lang,
      sourcemap: option.output?.sourcemap || false,
    });
    const parsed = parseSync(this.id, result.code, { lang });
    const isScript = parsed.program.sourceType === "script";
    const importFinder = new ImportFinder(result.code);
    const requireFinder = new RequireFinder(result.code);
    const exportFinder = new ExportFinder(result.code);

    walk(parsed.program, {
      scopeTracker: this.scopeTracker,
      enter(node) {
        if (!isScript) {
          importFinder.enter(node);
          exportFinder.enter(node);
        } else {
          requireFinder.enter(node);
        }
      },
      leave() {
        if (isScript) {
          requireFinder.leave();
        }
      },
    });

    this.code = result.code;
    this.sourcemap = result.map;
    this.imports = importFinder.imports;
    this.requires = requireFinder.requires;
    this.exports = exportFinder.exports;
    this.comments = parsed.comments;
  }

  private getLanguage(): "js" | "jsx" | "ts" | "tsx" {
    const id = this.id;
    const extension = id.split(".").pop()?.toLowerCase();
    switch (extension) {
      case "ts":
        return "ts";

      case "tsx":
        return "tsx";

      case "jsx":
        return "jsx";

      case "js":
      case "mjs":
      case "cjs":
      default:
        return "js";
    }
  }

  private generateName(id: string): string {
    let root = process.cwd().replace(/\\/g, "/").replace(/\/+/g, "/");
    id = id
      .trim()
      .replace(/\\/g, "/")
      .replace(/\/+/g, "/")
      .replace(`${root}/`, "")
      .replace("node_modules/", "")
      .toLowerCase()
      .replace(/\/index\.(js|ts|tsx)$/, "")
      .replace(/\.(js|ts|tsx)$/, "")
      .replace(/[^a-zA-Z0-9_$]/g, "_");
    return id;
  }
}

export default Node;
