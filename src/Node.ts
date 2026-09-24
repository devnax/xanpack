import { transform } from "oxc-transform";
import type {
  ImportNode,
  ResolverResult,
  ExportNode,
  RequireNode,
} from "./types";
import fs from "fs/promises";
import { parseSync } from "oxc-parser";
import { walk } from "oxc-walker";
import ParseExports from "./Parser/exports.js";
import ParseImport from "./Parser/imports.js";
import ParseRequire from "./Parser/requires.js";
import Xanpack from "./Xanpack.js";

class Node {
  readonly xpack: Xanpack;
  readonly source: string;
  private lang: "ts" | "js";
  readonly imports: ImportNode[] = [];
  readonly exports: ExportNode[] = [];
  readonly requires: RequireNode[] = [];
  readonly isEntry: boolean;
  id: string;
  importer?: string;
  code: string;
  name: string;

  constructor(xpack: Xanpack, source: string, importer?: string) {
    this.xpack = xpack;
    this.source = source;
    this.importer = importer;
    this.code = "";
    this.lang = source.endsWith(".ts") || source.endsWith(".tsx") ? "ts" : "js";
    this.name = xpack.generateName(source);
    this.id = source;
    this.isEntry = !importer;
  }

  private async resolve(): Promise<ResolverResult> {
    for (const plugin of this.xpack.plugins) {
      if (plugin.resolveId) {
        const result = await plugin.resolveId(this.source, this.importer);
        if (result) return result;
      }
    }
    const resolved = await this.xpack.resolver.resolve(
      this.source,
      this.importer,
    );
    return resolved;
  }

  private async load() {
    const plugins = this.xpack.plugins || [];
    for (const plugin of plugins) {
      if (plugin.load) {
        const result = await plugin.load(this.id);
        if (result) {
          return result;
        }
      }
    }
    return await fs.readFile(this.id, "utf-8");
  }

  private async transform(code: string) {
    const plugins = this.xpack.plugins || [];
    for (const plugin of plugins) {
      if (plugin && typeof plugin.transform === "function") {
        const _code = await plugin.transform(code, this.id);
        if (_code !== null) {
          code = _code;
        }
      }
    }

    const result = await transform(this.id, code, {
      ...this.xpack.option.transform,
      lang: this.lang,
      sourcemap: this.xpack.option.output?.sourcemap || false,
    });

    return result.code;
  }

  async build() {
    const resolved = await this.resolve();
    if (resolved.type === "external" || this.xpack.nodes.has(resolved.id)) {
      // return;
    }
    this.id = resolved.id;
    this.xpack.nodes.set(this.id, this);

    this.code = await this.load();
    this.code = await this.transform(this.code);
    console.log(this.code);

    const parsed = parseSync(this.id, this.code, { lang: this.lang });
    const parseExport = new ParseExports(this);
    const parseImport = new ParseImport(this);
    const parseRequire = new ParseRequire(this);

    walk(parsed.program, {
      enter(node) {
        parseExport.parse(node);
        parseImport.parse(node);
        parseRequire.parse(node);
      },
      leave() {},
    });

    for (let _import of this.imports) {
      const node = new Node(this.xpack, _import.source, this.id);
      await node.build();
    }

    console.dir(this.id, { depth: null });
  }
}
export default Node;
