import Node from "../Node";
import { transform } from "oxc-transform";

class Transformar {
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

  async load(code: string) {
    const id = this.Node.id;
    const plugins = this.Node.xpack.option.plugins || [];

    for (const plugin of plugins) {
      if (plugin && typeof plugin.transform === "function") {
        const _code = await plugin.transform(code, id);
        if (_code !== null) {
          code = _code;
        }
      }
    }

    // const lang = this.getLanguage(id);
    // const result = await transform(id, code, {
    //   lang,
    //   sourcemap: false,
    // });
    return code;
  }
}

export default Transformar;
