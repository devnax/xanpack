import { parseSync } from "oxc-parser";
import Node from "../Node";
import { ParserResult } from "../Parser";
import { walk } from "oxc-walker";

class Replacer {
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

  async replace(id: string, code: string) {
    const plugins = this.Node.xpack.option.plugins || [];
    const replacers = plugins.map((plugin) => plugin.replacer).filter(Boolean);

    if (replacers.length === 0) {
      return code;
    }

    const lang = this.getLanguage();
    const parsed = parseSync(id, code, { lang });
    const replacements: Array<{ start: number; end: number; code: string }> =
      [];

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

    // Apply replacements collected during AST walk
    const sorted = replacements.sort((a, b) => b.start - a.start);
    for (const { start, end, code: _code } of sorted) {
      code = code.slice(0, start) + _code + code.slice(end);
    }

    return code;
  }

  imports(imports: ParserResult["imports"]) {}
}

export default Replacer;
