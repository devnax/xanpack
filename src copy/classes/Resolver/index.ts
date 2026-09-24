import { ResolverFactory } from "oxc-resolver";
import { builtinModules } from "node:module";
import path from "node:path";
import Xanpack from "../Xanpack";
import Node from "../Node";
import { ResolverResult } from "../../types/Xanpack.js";
import { ResolveError } from "../../utils/Errors.js";

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

  private isBuiltinModule(id: string): boolean {
    return builtinModules.includes(id) || id.startsWith("node:");
  }

  async resolve(source: string, importer: string): Promise<ResolverResult> {
    try {
      // Check for builtin modules
      if (this.isBuiltinModule(source)) {
        this.resolved = {
          id: source,
          type: "external",
          external: true,
        };
        this.Node.xpack.logger.debug(`Resolved builtin module: ${source}`);
        return this.resolved;
      }

      // Try plugins first
      const plugins = this.Node.xpack.option.plugins || [];
      for (const plugin of plugins) {
        if (plugin.resolveId) {
          const result = await plugin.resolveId(source, importer);
          if (result) {
            this.resolved = {
              id: result.id,
              type: result.type,
              external: result.type === "external",
            };
            this.Node.xpack.logger.debug(
              `Plugin resolved: ${source} -> ${result.id}`,
            );
            return this.resolved;
          }
        }
      }

      // Use oxc-resolver for file resolution
      const resolved = this.resolver.sync(path.dirname(importer), source);
      if (resolved.error) {
        throw new ResolveError(source, importer);
      }

      const resolvedPath = resolved.path as string;
      this.resolved = {
        id: resolvedPath,
        type: "source",
        external: false,
      };

      this.Node.xpack.logger.debug(`Resolved: ${source} -> ${resolvedPath}`);
      return this.resolved;
    } catch (error) {
      if (error instanceof ResolveError) {
        throw error;
      }
      throw new ResolveError(source, importer);
    }
  }
}

export default Resolver;
