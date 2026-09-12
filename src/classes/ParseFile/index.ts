import fs from "fs";
import { ParseResult, parseSync } from "oxc-parser";
import { walk } from "oxc-walker";
import { SourceMap, transform } from "oxc-transform";
import type { ExportInfo, ImportInfo, ModuleType, ModuleFormat } from "./types";
import ExtractImports from "./ExtractImports.js";
import ExtractExports from "./ExtractExports.js";
import ExtractCJSExports from "./ExtractCjsExports.js";
import Xanpack from "../Xanpack.js";

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

  async parse() {
    const lang = this.getLanguage();
    const content = await this.readFile();
    const result = await transform(this.resolved, content, {
      lang,
      define: this.xpack.option.define,
      // sourcemap: true,
    });

    const parsed = parseSync(this.resolved, result.code, {
      lang,
    });

    this.code = result.code;
    this.sourcemap = result.map;
    this.ast = parsed;

    let hasESM = false;
    let hasCJS = false;
    walk(parsed.program, {
      enter: (node) => {
        const importsFromNode = ExtractImports.extract(node);
        const exportsFromNode = ExtractExports.extract(node);
        const exportsCjsFromNode = ExtractCJSExports.extract(node);

        if (exportsFromNode.length > 0) {
          hasESM = true;
        }

        if (exportsCjsFromNode.length > 0) {
          hasCJS = true;
        }

        this.imports.push(...importsFromNode);
        this.exports.push(...exportsFromNode);
        this.exports.push(...exportsCjsFromNode);
      },
    });

    if (hasESM && !hasCJS) {
      this.format = "esm";
    } else if (hasCJS && !hasESM) {
      this.format = "cjs";
    } else if (hasESM && hasCJS) {
      this.format = "cjs";
    } else {
    }
  }
}

export default ParseFile;
