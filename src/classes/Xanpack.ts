import path from "node:path";
import { XanpackOption } from "../types/Xanpack.js";
import Node from "./Node.js";

class Xanpack {
  readonly option: XanpackOption;
  readonly Nodes = new Map<string, Node>();

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
    const nodes = await this.buildNode();

    for (const [filePath, node] of nodes) {
      // Implement the logic to handle each node after building
      await node.build();
    }
  }

  private async buildNode() {
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
      const filePath = input[key];
      const name = path.basename(filePath, path.extname(filePath));
      const node = new Node({
        xpack: this,
        source: filePath,
        name,
        rootDir: path.dirname(filePath),
      });
      this.Nodes.set(filePath, node);
    }

    return this.Nodes;
  }

  // async buildGraph(): Promise<void> {
  //   const input = this.option.input as string;
  //   const resolved = this.resolver.resolve(process.cwd(), input);
  //   await this.buildModule(resolved.resolved);
  // }

  // private async buildModule(resolvedPath: string): Promise<ParseFile> {
  //   const existing = this.Nodes.get(resolvedPath);

  //   if (existing) {
  //     return existing;
  //   }

  //   const parser = new ParseFile(resolvedPath, this);
  //   this.Nodes.set(resolvedPath, parser);

  //   await parser.parse();

  //   for (const _import of parser.imports) {
  //     if (!_import.source) {
  //       continue;
  //     }

  //     const resolved = this.resolver.resolve(parser.resolved, _import.source);

  //     if (!resolved.resolved) {
  //       continue;
  //     }

  //     _import.resolved = resolved.resolved;

  //     if (this.Nodes.has(resolved.resolved)) {
  //       continue;
  //     }

  //     await this.buildModule(resolved.resolved);
  //   }

  //   return parser;
  // }

  // private async writeOutput(input: string, code: string): Promise<void> {
  //   const outDir = this.option.output.dir;

  //   // delete outdir
  //   if (fs.existsSync(outDir)) {
  //     await fs.promises.rm(outDir, {
  //       recursive: true,
  //       force: true,
  //     });
  //   }
  //   await fs.promises.mkdir(outDir, {
  //     recursive: true,
  //   });

  //   const inputName = path.basename(input);
  //   const outputName = inputName
  //     .replace(/\.(tsx?|jsx?|mjs|cjs)$/, "")
  //     .concat(".js");

  //   const outputPath = path.join(outDir, outputName);
  //   await fs.promises.writeFile(outputPath, code, "utf8");
  // }

  // private indent(code: string, spaces: number): string {
  //   const prefix = " ".repeat(spaces);

  //   return code
  //     .trim()
  //     .split("\n")
  //     .map((line) => (line.trim() ? prefix + line : line))
  //     .join("\n");
  // }
}

export default Xanpack;
