import { parseSync } from "oxc-parser";
import Node from "../Node";
import { walk, ScopeTracker } from "oxc-walker";
import ExportFinder from "./ExportFinder.js";
import RequireFinder from "./RequireFinder.js";
import ImportFinder from "./ImportFinder.js";
import { ReplacerResult } from "../../types/Xanpack";

class Parser {
  Node: Node;
  constructor(Node: Node) {
    this.Node = Node;
  }

  private getLanguage(id: string): "js" | "jsx" | "ts" | "tsx" {
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

  async parse(id: string, code: string) {
    const lang = this.getLanguage(id);
    const parsed = parseSync(id, code, { lang });

    const isScript = parsed.program.sourceType === "script";
    const importFinder = new ImportFinder(code);
    const requireFinder = new RequireFinder(code);
    const exportFinder = new ExportFinder(code);
    const tracker = new ScopeTracker({
      preserveExitedScopes: true,
    });

    const plugins = this.Node.xpack.option.plugins || [];
    const replacers = plugins.map((plugin) => plugin.replacer).filter(Boolean);
    const replacements: ReplacerResult[] = [];

    walk(parsed.program, {
      scopeTracker: tracker,
      enter(node) {
        let skip = false;
        for (const replacer of replacers) {
          if (replacer) {
            const result = replacer(id, node);
            if (result) {
              replacements.push(result);
              skip = true;
              this.skip();
              break;
            }
          }
        }

        if (!skip) {
          if (!isScript) {
            importFinder.enter(node);
            exportFinder.enter(node);
          } else {
            requireFinder.enter(node);
          }
        }
      },
      leave() {
        if (isScript) {
          requireFinder.leave();
        }
      },
    });

    for (let _import of importFinder.imports) {
      const isRelativeSource =
        _import.source.startsWith(".") || _import.source.startsWith("/");
      if (_import.dynamic) {
        replacements.push({
          start: _import.start,
          end: _import.end,
          code: `__import(${JSON.stringify(_import.source)})`,
        });
      } else {
        replacements.push({
          start: _import.start,
          end: _import.end,
          code: `__require(${JSON.stringify(_import.source)})`,
        });
      }
    }

    for (let _require of requireFinder.requires) {
      replacements.push({
        start: _require.start,
        end: _require.end,
        code: `__require(${JSON.stringify(_require.source)})`,
      });
    }

    for (let _export of exportFinder.exports) {
      replacements.push({
        start: _export.exportStart,
        end: _export.exportEnd,
        code: ``,
      });
    }

    return {
      imports: importFinder.imports,
      requires: requireFinder.requires,
      exports: exportFinder.exports,
      scopeTracker: tracker,
      replacements,
    };
  }
}

export default Parser;
