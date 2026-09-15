import path from "node:path";
import Resolver from "./Resolver/index.js";
import FileLoader from "./FileLoader/index.js";
import Parser from "./Parser/index.js";
import Replacer from "./Replacer/index.js";
import Transformar from "./Transformar/index.js";
import Xanpack from "./Xanpack";
import { ImportNode } from "./Parser/ImportFinder.js";
import { ExportNode } from "./Parser/ExportFinder.js";
import { ReplacerResult } from "../types/Xanpack.js";

export type NodeOption = {
  xpack: Xanpack;
  source: string;
  importer: string;
};

class Node {
  xpack: Xanpack;
  source: string;
  id: string;
  importer: string;
  code: string;
  imports: ImportNode[];
  requires: ImportNode[];
  exports: ExportNode[];
  replacements: ReplacerResult[];

  constructor(options: NodeOption) {
    this.source = options.source;
    this.xpack = options.xpack;
    this.importer = options.importer;
    this.id = "";
    this.imports = [];
    this.requires = [];
    this.exports = [];
    this.code = "";
    this.replacements = [];
  }

  async build() {
    const resolver = new Resolver(this);
    const resolved = await resolver.resolve(this.source, this.importer);
    this.id = resolved.id;

    if (this.xpack.Nodes.has(resolved.id)) {
      return;
    }

    const fileLoader = new FileLoader(this);
    const transformar = new Transformar(this);
    const parser = new Parser(this);
    const replacer = new Replacer(this);

    const code = await fileLoader.load();
    const transformed = await transformar.transform(code);
    const parsed = await parser.parse(transformed);

    for (const _import of parsed.imports) {
      const node = new Node({
        xpack: this.xpack,
        source: _import.source,
        importer: resolved.id,
      });
      await node.build();
      this.xpack.Nodes.set(node.id, node);
    }

    this.imports = parsed.imports;
    this.requires = parsed.requires;
    this.exports = parsed.exports;
    this.replacements.push(...parsed.replacements);

    const replaced = replacer.replace(resolved.id, parsed);
    console.log(replaced);

    this.code = replaced;
  }

  requireName(id: string): string {
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

export default Node;
