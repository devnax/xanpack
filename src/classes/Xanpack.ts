import fs from "node:fs";
import path from "node:path";
import { minify } from "oxc-minify";
import { XanpackNodes, XanpackOption } from "../types/Xanpack.js";
import { SourceMap, transform } from "oxc-transform";
import tsx from "esrap/languages/ts";
import ParseFile from "./ParseFile/index.js";
import Resolver from "./ParseFile/Resolver.js";
import Linker from "./Linker.js";

class Xanpack {
  readonly option: XanpackOption;
  readonly Nodes: XanpackNodes = new Map();
  readonly resolver: Resolver;

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

    this.resolver = new Resolver(this);
  }
  private indent(code: string, spaces: number): string {
    const prefix = " ".repeat(spaces);

    return code
      .trim()
      .split("\n")
      .map((line) => (line.trim() ? prefix + line : line))
      .join("\n");
  }
  async build(): Promise<void> {
    await this.buildGraph();

    const input = this.resolver.resolve(
      process.cwd(),
      this.option.input as string,
    );

    const linker = new Linker(this.Nodes);
    // const code = linker.link(input.resolved);

    let codes = `
const __xpack = {
  __module: Object.create(null),
  __cache: Object.create(null),

  module(id, factory) {
    __xpack.__module[id] = factory;
  },
  import: (id) => {
    if (__xpack.__cache[id]) {
      return __xpack.__cache[id].exports;
    }

    const module = {
      exports: {},
    };

    __xpack.__cache[id] = module;
    __xpack.__module[id](module, module.exports);

    return module.exports;
  },
  importAsync: () => {},
};
`;

    for (const node of this.Nodes.values()) {
      try {
        const id = node.resolved
          .replace(process.cwd() + "\\", "")
          .replace("node_modules\\", "")
          .replaceAll("-", "_")
          .replaceAll("\\", "/")
          .replaceAll(/\//g, "_")
          .split(".")[0];

        codes += `
const require_${id} = __mod((module, exports) => {
${this.indent(node.code, 4)}
});
    `;
      } catch (error) {
        console.log(error);
        console.dir(node.ast.program, { depth: null });
      }
    }

    const root = input.resolved
      .replace(process.cwd(), "")
      .replaceAll("\\", "/");
    codes += `
    __xpack.import(${JSON.stringify(root)});
        `;

    // const minified = await minify(
    //   this.resolver.resolve(process.cwd(), this.option.input as string)
    //     .resolved,
    //   codes,
    // );
    // await this.writeOutput(input.resolved, minified.code);
    await this.writeOutput(input.resolved, codes);
  }

  async buildGraph(): Promise<void> {
    const input = this.option.input as string;
    const resolved = this.resolver.resolve(process.cwd(), input);
    await this.buildModule(resolved.resolved);
  }

  private async buildModule(resolvedPath: string): Promise<ParseFile> {
    const existing = this.Nodes.get(resolvedPath);

    if (existing) {
      return existing;
    }

    const parser = new ParseFile(resolvedPath, this);
    this.Nodes.set(resolvedPath, parser);

    await parser.parse();

    for (const _import of parser.imports) {
      if (!_import.source) {
        continue;
      }

      const resolved = this.resolver.resolve(parser.resolved, _import.source);

      if (!resolved.resolved) {
        continue;
      }

      _import.resolved = resolved.resolved;

      if (this.Nodes.has(resolved.resolved)) {
        continue;
      }

      await this.buildModule(resolved.resolved);
    }

    return parser;
  }

  private async writeOutput(input: string, code: string): Promise<void> {
    const outDir = this.option.output.dir;

    // delete outdir
    if (fs.existsSync(outDir)) {
      await fs.promises.rm(outDir, {
        recursive: true,
        force: true,
      });
    }
    await fs.promises.mkdir(outDir, {
      recursive: true,
    });

    const inputName = path.basename(input);
    const outputName = inputName
      .replace(/\.(tsx?|jsx?|mjs|cjs)$/, "")
      .concat(".js");

    const outputPath = path.join(outDir, outputName);
    await fs.promises.writeFile(outputPath, code, "utf8");
  }
}

export default Xanpack;
