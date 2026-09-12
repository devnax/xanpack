import fs from "fs";
import { ModuleKind, ParseResult, parseSync } from "oxc-parser";
import Crypto from "crypto";
import { ScopeTracker, walk } from "oxc-walker";
import { SourceMap, transform } from "oxc-transform";
import type { ExportInfo, ImportInfo, ModuleType, ModuleFormat } from "./types";
import ExtractImports from "./ExtractImports.js";
import ExtractExports from "./ExtractExports.js";
import ExtractCJSExports from "./ExtractCjsExports.js";
import ReplaceExport from "./Replace/export.js";
import Xanpack from "../Xanpack.js";
import ReplaceRequire from "./Replace/require.js";
import ReplaceImport from "./Replace/import.js";

class ParseFile {
  format: ModuleFormat = "esm";
  type: ModuleType = "module";
  sourceType: ModuleKind = "module";
  imports: ImportInfo[] = [];
  exports: ExportInfo[] = [];
  resolved: string;
  code: string = "";
  sourcemap?: SourceMap;
  ast: ParseResult = {} as ParseResult;
  xpack: Xanpack;
  scopeTracker: ScopeTracker;
  hash: string = "";

  constructor(resolved: string, xpack: Xanpack) {
    this.resolved = resolved;
    this.xpack = xpack;
    this.hash = Crypto.createHash("md5")
      .update(this.resolved + Date.now().toString())
      .digest("hex")
      .substring(0, 8);
    this.scopeTracker = new ScopeTracker({
      preserveExitedScopes: true,
    });
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
    const option = this.xpack.option || {};
    const transformOption = option?.transform || {};
    const lang = this.getLanguage();
    const content = await fs.promises.readFile(this.resolved, "utf-8");
    const result = await transform(this.resolved, content, {
      lang,
      sourcemap: option.output?.sourcemap,
      define: transformOption.define,
      assumptions: transformOption.assumptions,
      target: transformOption.target,
      inject: transformOption.inject,
      jsx: transformOption.jsx,
    });

    const replaceRequire = new ReplaceRequire(result.code);
    const replaceExport = new ReplaceExport(result.code);
    const replaceImport = new ReplaceImport(result.code);
    const ast = parseSync(this.resolved, result.code, {
      lang,
    });

    this.ast = ast;
    this.code = result.code;
    this.sourcemap = result.map;
    this.sourceType = ast.program.sourceType;

    const parser = this;
    const isScript = ast.program.sourceType === "script";

    walk(ast.program, {
      scopeTracker: this.scopeTracker,
      enter(node) {
        if (isScript) {
          replaceRequire.add(node);
          replaceExport.add(node);
          replaceImport.add(node);
        }
        const importsFromNode = ExtractImports.extract(node);
        const exportsFromNode = ExtractExports.extract(node);
        const exportsCjsFromNode = ExtractCJSExports.extract(node);
        parser.imports.push(...importsFromNode);
        parser.exports.push(...exportsFromNode);
        parser.exports.push(...exportsCjsFromNode);

        if (
          importsFromNode.length &&
          (node.type === "ExpressionStatement" ||
            node.type === "VariableDeclaration" ||
            node.type === "ImportDeclaration")
        ) {
          this.remove();
        }
      },
    });

    // this.code = replaceRequire.apply();
    // this.code = replaceExport.apply();
    // this.code = replaceImport.apply();

    // const replacements = [
    //   ...replaceRequire.replacements,
    //   ...replaceExport.replacements,
    //   ...replaceImport.replacements,
    // ];

    // replacements.sort((a, b) => b.start - a.start);

    // let _replaced = parser.code;

    // for (const replacement of replacements) {
    //   _replaced =
    //     _replaced.slice(0, replacement.start) +
    //     replacement.code +
    //     _replaced.slice(replacement.end);
    // }
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
