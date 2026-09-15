import Node from "../Node.js";
import fs from "node:fs/promises";

class FileLoader {
  Node: Node;
  constructor(Node: Node) {
    this.Node = Node;
  }

  async load() {
    const id = this.Node.id;
    const plugins = this.Node.xpack.option.plugins || [];
    for (const plugin of plugins) {
      if (plugin.load) {
        const result = await plugin.load(id);
        if (result) {
          return result;
        }
      }
    }

    return await fs.readFile(id, "utf-8");
  }
}

export default FileLoader;
