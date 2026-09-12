import fs from "node:fs";
import path from "node:path";
import { minify } from "oxc-minify";
import { XanpackNodes, XanpackOption } from "../types/Xanpack.js";
import { SourceMap, transform } from "oxc-transform";

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

      define: {
        "process.env.NODE_ENV": JSON.stringify(
          process.env.NODE_ENV || "development",
        ),

        ...option?.define,
      },
    };

    this.resolver = new Resolver(this);
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
      codes += node.code + "\n\n";
    }

    const root = input.resolved
      .replace(process.cwd(), "")
      .replaceAll("\\", "/");
    codes += `
    __xpack.import(${JSON.stringify(root)});
        `;

    const transformed = await transform(this.option.input as string, codes);

    // const minified = await minify(
    //   this.resolver.resolve(process.cwd(), this.option.input as string)
    //     .resolved,
    //   transformed.code,
    // );
    // await this.writeOutput(input.resolved, minified.code);
    await this.writeOutput(input.resolved, transformed.code);
  }

  async buildGraph(): Promise<void> {
    const input = this.option.input as string;
    const resolved = this.resolver.resolve(process.cwd(), input);
    await this.buildModule(resolved.resolved);

    // for (let node of this.Nodes.values()) {
    //   console.log(node.exports);
    // }
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
    const outDir = path.resolve(process.cwd(), "build");

    await fs.promises.mkdir(outDir, {
      recursive: true,
    });

    const inputName = path.basename(input);

    const outputName = inputName
      .replace(/\.(tsx?|jsx?|mjs|cjs)$/, "")
      .concat(".js");

    const outputPath = path.join(outDir, outputName);

    await fs.promises.writeFile(outputPath, code, "utf8");

    console.log(`Compiled: ${outputPath}`);
  }
}

export default Xanpack;
