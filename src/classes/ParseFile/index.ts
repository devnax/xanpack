import fs from "fs";
import { ParseResult, parseSync } from "oxc-parser";
import { walk } from "oxc-walker";
import { SourceMap, transform } from "oxc-transform";
import type { ExportInfo, ImportInfo, ModuleType, ModuleFormat } from "./types";
import ExtractImports from "./ExtractImports.js";
import ExtractExports from "./ExtractExports.js";
import ExtractCJSExports from "./ExtractCjsExports.js";
import ReplaceExport from "./Replace/export.js";
import Xanpack from "../Xanpack.js";
import { createHash } from "node:crypto";
import ReplaceRequire from "./Replace/require.js";
import { format } from "oxfmt";
import ReplaceImport from "./Replace/import.js";
import { ScopeAnalyzer } from "./ScopeAnalyzer.js";

class ParseFile {
  format: ModuleFormat = "esm";
  type: ModuleType = "module";
  imports: ImportInfo[] = [];
  exports: ExportInfo[] = [];
  resolved: string;
  code: string = "";
  sourcemap?: SourceMap;
  ast: ParseResult = {} as ParseResult;
  xpack: Xanpack;

  constructor(resolved: string, xpack: Xanpack) {
    this.resolved = resolved;
    this.xpack = xpack;
  }

  private async readFile() {
    return await fs.promises.readFile(this.resolved, "utf-8");
  }

  private getLanguage(): "js" | "jsx" | "ts" | "tsx" {
    const extension = this.resolved.split(".").pop()?.toLowerCase();

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

  normalizePath(filePath: string): string {
    return filePath.replaceAll(process.cwd(), "").replaceAll("\\", "/");
  }

  async parse() {
    const lang = this.getLanguage();
    const content = await this.readFile();
    const result = await transform(this.resolved, content, {
      lang,
      define: this.xpack.option.define,
      // sourcemap: true,
    });

    const hash = this.normalizePath(this.resolved);
    const replaceRequire = new ReplaceRequire(result.code);
    const replaceExport = new ReplaceExport(result.code);
    const replaceImport = new ReplaceImport(result.code);
    const parsed = parseSync(this.resolved, result.code, {
      lang,
    });

    this.code = result.code;
    this.sourcemap = result.map;
    this.ast = parsed;

    const analizer = new ScopeAnalyzer();
    const globalScope = analizer.analyze(parsed.program);
    console.log(this.resolved, parsed.program.sourceType);
    // console.dir(globalScope, { depth: 10 });

    const isScript = parsed.program.sourceType === "script";

    walk(parsed.program, {
      enter: (node, parent, key) => {
        if (isScript) {
          replaceRequire.add(node);
          replaceExport.add(node);
          replaceImport.add(node);
        }
        const importsFromNode = ExtractImports.extract(node);
        const exportsFromNode = ExtractExports.extract(node);
        const exportsCjsFromNode = ExtractCJSExports.extract(node);

        this.imports.push(...importsFromNode);
        this.exports.push(...exportsFromNode);
        this.exports.push(...exportsCjsFromNode);
      },
    });
    // this.code = replaceRequire.apply();
    // this.code = replaceExport.apply();
    // this.code = replaceImport.apply();

    const replacements = [
      ...replaceRequire.replacements,
      ...replaceExport.replacements,
      ...replaceImport.replacements,
    ];

    replacements.sort((a, b) => b.start - a.start);

    let _replaced = this.code;

    for (const replacement of replacements) {
      _replaced =
        _replaced.slice(0, replacement.start) +
        replacement.code +
        _replaced.slice(replacement.end);
    }

    if (isScript) {
      this.code = `
__xpack.module(${JSON.stringify(hash)}, (module, exports) => {
${this.indent(_replaced, 2)}
})`;
    } else {
      this.code = _replaced;
    }

    // const { code } = await format("a.js", wrapped, {});
    // this.code = wrapped;
  }

  private indent(code: string, spaces: number): string {
    const prefix = " ".repeat(spaces);

    return code
      .trim()
      .split("\n")
      .map((line) => (line.trim() ? prefix + line : line))
      .join("\n");
  }
}

export default ParseFile;
