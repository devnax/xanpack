import { ResolverFactory } from "oxc-resolver";
import { builtinModules } from "node:module";
import path from "node:path";
import Xanpack from "../Xanpack";

export interface ResolverResult {
  resolved: string;
  builtin: boolean;
}

class Resolver {
  xpack: Xanpack;
  resolver: ResolverFactory;
  constructor(xpack: Xanpack) {
    this.xpack = xpack;
    this.resolver = new ResolverFactory({
      conditionNames: ["node", "import"],
      extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
    });
  }

  private isBuiltinModule(id: string) {
    return builtinModules.includes(id) || id.startsWith("node:");
  }

  resolve(importer: string, specifier: string): ResolverResult {
    const dirname = path.dirname(importer);
    if (this.isBuiltinModule(specifier)) {
      return {
        resolved: specifier,
        builtin: true,
      };
    }

    const resolved = this.resolver.sync(dirname, specifier);
    if (resolved.error) {
      throw new Error(`Failed to resolve module: ${specifier}`);
    }

    return {
      resolved: resolved.path as string,
      builtin: false,
    };
  }
}

export default Resolver;
