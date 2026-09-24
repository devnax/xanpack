import { ResolverFactory } from "oxc-resolver";
import { builtinModules } from "node:module";
import path from "node:path";
import { ResolveError } from "./utils/Errors.js";
import { ResolverResult } from "./types";

class Resolver {
  resolver: ResolverFactory;

  constructor() {
    this.resolver = new ResolverFactory({
      conditionNames: ["node", "import"],
      extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
    });
  }

  private isBuiltinModule(id: string): boolean {
    return builtinModules.includes(id) || id.startsWith("node:");
  }

  async resolve(source: string, importer?: string): Promise<ResolverResult> {
    importer = importer ?? process.cwd();

    if (this.isBuiltinModule(source)) {
      return {
        id: source,
        type: "external",
      };
    }

    try {
      const resolved = this.resolver.sync(path.dirname(importer), source);
      if (resolved.error) {
        throw new ResolveError(source, importer);
      }

      const extensions = [".ts", ".tsx", ".js", ".jsx", ".json"];
      const ext = path.extname(resolved.path as string);
      const type = extensions.includes(ext) ? "source" : "asset";

      return {
        id: resolved.path as string,
        type: type,
      };
    } catch (error) {
      if (error instanceof ResolveError) {
        throw error;
      }
      throw new ResolveError(source, importer);
    }
  }
}

export default Resolver;
