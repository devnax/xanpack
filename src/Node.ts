import { transform } from "oxc-transform";
import type {
  ImportNode,
  ResolverResult,
  ExportNode,
  RequireNode,
  ReplacerResult,
} from "./types";
import fs from "fs/promises";
import { parseSync } from "oxc-parser";
import { walk } from "oxc-walker";
import ParseExports from "./Parser/exports.js";
import ParseImport from "./Parser/imports.js";
import ParseRequire from "./Parser/requires.js";
import Xanpack from "./Xanpack.js";
import { XanpackError } from "./utils/Errors.js";

class Node {
  readonly xpack: Xanpack;
  readonly source: string;
  readonly imports: ImportNode[] = [];
  readonly exports: ExportNode[] = [];
  readonly requires: RequireNode[] = [];
  readonly isEntry: boolean;
  id: string;
  importer?: string;
  code: string;
  name: string;

  constructor(
    xpack: Xanpack,
    source: string,
    importer?: string,
    name?: string,
  ) {
    this.xpack = xpack;
    this.source = source;
    this.importer = importer;
    this.code = "";
    this.name = name ?? "";
    this.id = source;
    this.isEntry = !importer;
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
    if (resolved.type === "external" || this.xpack.nodes.has(resolved.id)) {
      return;
    }

    this.name = this.name || this.xpack.generateName(resolved.id);

    this.id = resolved.id;
    this.xpack.nodes.set(this.id, this);

    this.code = await this.load();
    this.code = await this.transform(this.code);

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
    });

    let replacements: ReplacerResult[] = [];

    for (let _import of this.imports) {
      const node = new Node(this.xpack, _import.source, this.id);
      await node.build();

      if (_import.type === "static") {
        replacements.push({
          start: _import.start,
          end: _import.end,
          code: ``,
        });
        // if (_import.specifiers) {
        //   const specifiers: string[] = [];
        //   for (let specifier of _import.specifiers) {
        //     specifiers.push(``);
        //   }
        //   console.log(specifiers);
        // }
      }
    }

    for (let _export of this.exports) {
      if (_export.type === "default") {
        replacements.push({
          start: _export.start,
          end: _export.start + "export default".length,
          code: `exports.default =`,
        });
      } else if (_export.type === "identifier") {
        replacements.push({
          start: _export.start,
          end: _export.start + "export ".length,
          code: ``,
        });

        for (let specifier of _export.specifiers) {
          replacements.push({
            start: _export.end,
            end: _export.end,
            code: `\nexports.${specifier.exported} = ${specifier.local};`,
          });
        }
      }
    }

    const sorted = replacements.sort((a, b) => b.start - a.start);
    for (let replacement of sorted) {
      this.code =
        this.code.slice(0, replacement.start) +
        replacement.code +
        this.code.slice(replacement.end);
    }
  }
}
export default Node;
