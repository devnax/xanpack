import path from "node:path";
import Resolver from "./Resolver/index.js";
import FileLoader from "./FileLoader/index.js";
import Parser from "./Parser/index.js";
import Replacer from "./Replacer/index.js";
import Transformar from "./Transformar/index.js";
import Generator from "./Generator/index.js";
import Xanpack from "./Xanpack";

export type NodeOption = {
  xpack: Xanpack;
  source: string;
  name: string;
  rootDir: string;
};

class Node {
  xpack: Xanpack;
  source: string;
  name: string;
  rootDir: string;

  constructor(options: NodeOption) {
    this.source = options.source;
    this.name = options.name;
    this.xpack = options.xpack;
    this.rootDir = options.rootDir;
  }

  async build(): Promise<string> {
    const resolver = new Resolver(this);
    const fileLoader = new FileLoader(this);
    const parser = new Parser(this);
    const replacer = new Replacer(this);
    const transformar = new Transformar(this);

    const resolved = await resolver.resolve(this.rootDir, this.source);
    const code = await fileLoader.load(resolved.id);
    const parsed = await parser.parse(resolved.id, code);
    const replaced = replacer.replace(resolved.id, parsed);
    const transformed = await transformar.transform(resolved.id, replaced);
    const moduleName = this.getModuleName(resolved.id);
    return `
     const require_${moduleName} = __xmod((module, exports) => {
      ${transformed}
     })
    `;
  }

  getModuleName(id: string): string {
    let name = path.basename(id, path.extname(id));
    if (name === "index") {
      name = path.basename(path.dirname(id));
    }
    name = name.toLowerCase();
    name = name.replace(/[^a-zA-Z0-9_$]/g, "_");
    return name;
  }
}

export default Node;
