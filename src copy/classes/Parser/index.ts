import { parseSync } from "oxc-parser";
import Node from "../Node";
import { walk, ScopeTracker } from "oxc-walker";
import ExportFinder from "./ExportFinder.js";
import RequireFinder from "./RequireFinder.js";
import ImportFinder from "./ImportFinder.js";

export type ParserResult = {
  imports: any[];
  requires: any[];
  exports: any[];
  scopeTracker: ScopeTracker;
};

class Parser {
  Node: Node;
  constructor(Node: Node) {
    this.Node = Node;
  }

  private getLanguage(): "js" | "jsx" | "ts" | "tsx" {
    const id = this.Node.id;
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

  async parse(code: string) {
    const id = this.Node.id;
    const lang = this.getLanguage();
    const parsed = parseSync(id, code, { lang });

    const isScript = parsed.program.sourceType === "script";
    const importFinder = new ImportFinder(code);
    const requireFinder = new RequireFinder(code);
    const exportFinder = new ExportFinder(code);
    const tracker = new ScopeTracker({
      preserveExitedScopes: true,
    });

    walk(parsed.program, {
      scopeTracker: tracker,
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

    return {
      imports: importFinder.imports,
      requires: requireFinder.requires,
      exports: exportFinder.exports,
      scopeTracker: tracker,
    };
  }
}

export default Parser;
