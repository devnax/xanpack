import { ResolverFactory } from "oxc-resolver";
import { builtinModules } from "node:module";
import path from "node:path";
import Xanpack from "../Xanpack";
import Node from "../Node";

export interface ResolverResult {
  id: string;
  external: boolean;
}

class Resolver {
  Node: Node;
  resolver: ResolverFactory;
  resolved: ResolverResult | null = null;
  constructor(Node: Node) {
    this.Node = Node;
    this.resolver = new ResolverFactory({
      conditionNames: ["node", "import"],
      extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
    });
  }

  private isBuiltinModule(id: string) {
    return builtinModules.includes(id) || id.startsWith("node:");
  }

  async resolve(importer: string, source: string): Promise<ResolverResult> {
    const dirname = path.dirname(importer);
    if (this.isBuiltinModule(source)) {
      this.resolved = {
        id: source,
        external: true,
      };
      return this.resolved;
    }

    const plugins = this.Node.xpack.option.plugins || [];
    for (const plugin of plugins) {
      if (plugin.resolveId) {
        const result = await plugin.resolveId(source, importer);
        if (result) {
          this.resolved = {
            id: result.id,
            external: result.external,
          };
          return this.resolved;
        }
      }
    }

    const resolved = this.resolver.sync(dirname, source);
    if (resolved.error) {
      throw new Error(`Failed to resolve module: ${source}`);
    }
    this.resolved = {
      id: resolved.path as string,
      external: false,
    };
    return this.resolved;
  }
}

export default Resolver;
