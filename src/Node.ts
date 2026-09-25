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
import Replacement from "./Replacement.js";
import Xanpack from "./Xanpack.js";
import { XanpackError } from "./utils/Errors.js";

class Node {
  readonly xpack: Xanpack;
  readonly source: string;
  readonly imports: ImportNode[] = [];
  readonly exports: ExportNode[] = [];
  readonly requires: RequireNode[] = [];

  id: string = "<unresolved>";
  importer?: string;
  code: string = "";
  name: string = "";
  type: ResolverResult["type"] = "source";

  constructor(xpack: Xanpack, source: string, importer?: string) {
    this.xpack = xpack;
    this.source = source;
    this.importer = importer;
  }

  private get lang() {
    const ext = this.id.toLowerCase().split(".").pop();
    switch (ext) {
      case "ts":
        return "ts";

      case "tsx":
        return "tsx";

      case "jsx":
        return "jsx";

      default:
        return "js";
    }
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

    const result = await transform(this.source, code, {
      ...this.xpack.option.transform,
      lang: this.lang,
      sourcemap: this.xpack.option.output?.sourcemap || false,
    });

    if (result.errors && result.errors.length > 0) {
      throw new XanpackError((result as any).errors[0].codeframe);
    }

    return result.code;
  }

  async build() {
    const resolved = await this.resolve();
    this.type = resolved.type;

    if (resolved.type === "external" || this.xpack.nodes.has(resolved.id)) {
      return;
    }

    this.xpack.nodes.set(resolved.id, this);
    this.name = this.xpack.generateName(resolved.id);
    this.id = resolved.id;

    this.code = await this.load();
    this.code = await this.transform(this.code);

    const parsed = parseSync(this.id, this.code, { lang: this.lang });
    const parseExport = new ParseExports(this);
    const parseImport = new ParseImport(this);
    const parseRequire = new ParseRequire(this);
    const replacement = new Replacement(this);

    walk(parsed.program, {
      enter(node) {
        parseExport.parse(node);
        parseImport.parse(node);
        parseRequire.parse(node);
      },
    });

    for (let _import of this.imports) {
      const node = new Node(this.xpack, _import.source, this.id);
      await node.build();

      _import.external = node.type === "external";
      _import.resolved = node.id;

      replacement.add({
        start: _import.start,
        end: _import.end,
        code: ``,
      });
    }

    replacement.apply();
  }
}
export default Node;
