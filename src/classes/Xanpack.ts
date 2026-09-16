import { ReplacerResult, XanpackOption } from "../types/Xanpack.js";
import Node from "./Node.js";
import path from "node:path";

class Xanpack {
  readonly option: XanpackOption;
  readonly nodes = new Map<string, Node>();

  constructor(option: XanpackOption) {
    this.option = {
      ...option,
      transform: {
        define: {
          "process.env.NODE_ENV": JSON.stringify(
            process.env.NODE_ENV || "development",
          ),
          ...option?.transform?.define,
        },
        ...option?.transform,
      },
    };
  }

  async build(): Promise<void> {
    const input: Record<string, string> = {};

    if (typeof this.option.input === "string") {
      input[this.option.input] = this.option.input;
    } else if (Array.isArray(this.option.input)) {
      for (const item of this.option.input) {
        input[item] = item;
      }
    } else if (typeof this.option.input === "object") {
      for (const key in this.option.input) {
        input[key] = this.option.input[key];
      }
    }

    for (const key in input) {
      await this.buildNode(input[key], null);
    }

    for (const node of this.nodes.values()) {
      const id = node.id;
      await this.applyReplace(node);
      console.log(node.code);
    }
  }

  private async buildNode(source: string, importer: string | null) {
    const node = new Node({
      xpack: this,
      source: source,
      importer: importer || source,
    });

    const resolve = node.resolveSource();
    if (resolve.external) {
      return;
    }

    await node.build();
    this.nodes.set(node.id, node);

    for (let _import of node.imports) {
      if (!_import.dynamic) {
        await this.buildNode(_import.source, node.id);
      }
    }
    for (let _import of node.requires) {
      if (!_import.dynamic) {
        await this.buildNode(_import.source, node.id);
      }
    }
  }

  private async applyReplace(node: Node) {
    let replacements: ReplacerResult[] = [];
    for (const _import of [...node.imports, ...node.requires]) {
      const name = node.name;
      if (!_import.dynamic) {
        replacements.push({
          start: _import.start,
          end: _import.end,
          code: `${name}()`,
        });
      } else {
        replacements.push({
          start: _import.start,
          end: _import.end,
          code: `__require(${JSON.stringify(_import.source)})`,
        });
      }
    }

    // exports
    for (const _export of node.exports) {
      replacements.push({
        start: _export.exportStart,
        end: _export.exportEnd,
        code: "",
      });
    }

    // remove comment
    for (const comment of node.comments) {
      replacements.push({
        start: comment.start,
        end: comment.end,
        code: "",
      });
    }

    // sort
    const sorted = replacements.sort((a, b) => b.start - a.start);
    for (const replacement of sorted) {
      node.code =
        node.code.slice(0, replacement.start) +
        replacement.code +
        node.code.slice(replacement.end);
    }

    node.code = node.code.trim();
  }
}

export default Xanpack;
