import type { XanpackOption } from "./types";
import Resolver from "./Resolver.js";
import Node from "./Node.js";

class Xanpack {
  readonly nodes: Map<string, Node> = new Map();
  readonly option: XanpackOption;
  readonly resolver = new Resolver();

  get plugins() {
    return this.option.plugins ?? [];
  }

  constructor(option: XanpackOption) {
    this.option = option;
  }

  async build() {
    const input: Record<string, string> = {};
    if (typeof this.option.input === "string") {
      const name = this.generateName(this.option.input);
      input[name] = this.option.input;
    } else if (Array.isArray(this.option.input)) {
      this.option.input.forEach((entry) => {
        const name = this.generateName(entry);
        input[name] = entry;
      });
    } else {
      Object.assign(input, this.option.input);
    }

    for (let name in input) {
      const source = input[name];
      const node = new Node(this, source);
      await node.build();
    }
    for (let node of this.nodes.values()) {
      // console.log(node.code);
    }
  }

  getNode(source: string): Node | undefined {
    for (let node of this.nodes.values()) {
      if (node.source === source) {
        return node;
      }
    }
    return undefined;
  }

  generateChunkName(id: string): string {
    return this.generateName(id);
  }

  generateName(id: string): string {
    let root = process.cwd().replace(/\\/g, "/").replace(/\/+/g, "/");
    id = id
      .trim()
      .replace(/\\/g, "/")
      .replace(/\/+/g, "/")
      .replace(`${root}/`, "")
      .replace("node_modules/", "")
      .toLowerCase()
      .replace(/\/index\.(js|ts|tsx)$/, "")
      .replace(/\.(js|ts|tsx)$/, "")
      .replace(/[^a-zA-Z0-9_$]/g, "_");
    return id;
  }
}

export default Xanpack;
