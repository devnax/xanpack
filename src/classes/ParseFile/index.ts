import fs from "fs";
import { ModuleKind, ParseResult, parseSync } from "oxc-parser";
import Crypto from "crypto";
import { ScopeTracker, walk } from "oxc-walker";
import { SourceMap, transform } from "oxc-transform";
import type { ModuleType, ModuleFormat } from "./types";
import type { ImportNode } from "../Parser/ImportFinder.js";
import type { ExportNode } from "../Parser/ExportFinder.js";
import Xanpack from "../Xanpack.js";
import ImportFinder from "../Parser/ImportFinder.js";
import RequireFinder from "../Parser/RequireFinder.js";
import ExportFinder from "../Parser/ExportFinder.js";

class ParseFile {
  file: string;
  format: ModuleFormat = "esm";
  type: ModuleType = "module";
  sourceType: ModuleKind = "module";
  imports: ImportNode[] = [];
  requires: ImportNode[] = [];
  exports: ExportNode[] = [];
  resolved: string;
  code: string = "";
  sourcemap?: SourceMap;
  ast: ParseResult = {} as ParseResult;
  xpack: Xanpack;
  scopeTracker: ScopeTracker;
  hash: string = "";

  constructor(file: string, xpack: Xanpack) {
    this.file = file;
    const resolved = xpack.resolver.resolve(process.cwd(), file);
    this.resolved = resolved.resolved;
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

    const ast = parseSync(this.resolved, result.code, {
      lang,
    });

    this.ast = ast;
    this.code = result.code;
    this.sourcemap = result.map;
    this.sourceType = ast.program.sourceType;

    const isScript = ast.program.sourceType === "script";
    const importFinder = new ImportFinder(this.code);
    const requireFinder = new RequireFinder(this.code);
    const exportFinder = new ExportFinder(this.code);

    walk(ast.program, {
      scopeTracker: this.scopeTracker,
      enter(node) {
        if (!isScript) {
          importFinder.enter(node);
          exportFinder.enter(node);
        } else {
          requireFinder.enter(node);
        }
      },
      leave(node) {
        if (isScript) {
          requireFinder.leave();
        }
      },
    });

    this.imports = importFinder.imports;
    this.requires = requireFinder.requires ?? [];
    this.exports = exportFinder.exports;
    const exportGenerated = this.generateExports();

    console.log(this.resolved);
    console.dir(exportFinder.exports, { depth: null });
    // remove export, export default, and require statements from the code

    // console.log(this.resolved, this.imports);
    // console.log(this.code);

    // const replacements = [
    //   ...replaceRequire.replacements,
    //   ...replaceExport.replacements,
    //   ...replaceImport.replacements,
    // ];

    // replacements.sort((a, b) => b.start - a.start);
    // console.log(replacements);

    // let _replaced = parser.code;

    // for (const replacement of replacements) {
    //   _replaced =
    //     _replaced.slice(0, replacement.start) +
    //     replacement.code +
    //     _replaced.slice(replacement.end);
    // }

    // this.code = _replaced;
  }

  private generateExports() {
    const lines: string[] = [];
    const replacements: Array<{ start: number; end: number }> = [];
    for (let node of this.exports) {
      if (node.source) {
        lines.push(`export ${node};`);
      }
    }
    return {
      code: lines.join("\n"),
      replacements,
    };
  }
}

export default ParseFile;
