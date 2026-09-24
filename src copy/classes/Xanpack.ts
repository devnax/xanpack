import { ReplacerResult, XanpackOption } from "../types/Xanpack.js";
import Node from "./Node.js";
import Resolver from "./Resolver/index.js";
import path from "node:path";
import fs from "node:fs/promises";
import Logger, { LogLevel } from "../utils/Logger.js";
import ConfigValidator from "../utils/ConfigValidator.js";
import { CircularDependencyError, XanpackError } from "../utils/Errors.js";

class Xanpack {
  readonly option: XanpackOption;
  readonly nodes = new Map<string, Node>();
  readonly logger: Logger;
  private dependencyChain = new Set<string>();

  constructor(option: XanpackOption) {
    // Validate configuration
    try {
      ConfigValidator.validate(option);
    } catch (error) {
      throw error;
    }

    // Initialize logger
    const logLevel = (option as any).debug ? LogLevel.DEBUG : LogLevel.INFO;
    this.logger = new Logger({
      level: logLevel,
      prefix: "xanpack",
      colors: true,
    });

    this.logger.debug("Initializing Xanpack with options", option);

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
    const startTime = performance.now();
    this.logger.time("build");

    try {
      // Call buildStart plugins
      if (this.option.plugins) {
        for (const plugin of this.option.plugins) {
          if (plugin.buildStart) {
            await plugin.buildStart({ input: this.option.input });
          }
        }
      }

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

      this.logger.info(`Building ${Object.keys(input).length} entry point(s)`);

      for (const key in input) {
        this.logger.debug(`Processing entry: ${key}`);
        await this.buildNode(input[key], null);
      }

      let finalCode = "";
      for (const node of this.nodes.values()) {
        try {
          const code = await node.generate();
          finalCode += code + "\n\n";
        } catch (error) {
          this.logger.error(`Failed to generate code for ${node.id}`, error);
          throw error;
        }
      }

      // Write to output file
      if (this.option.output?.dir) {
        await fs.mkdir(this.option.output.dir, { recursive: true });
        const outputPath = path.join(this.option.output.dir, "bundle.js");
        await fs.writeFile(outputPath, finalCode, "utf-8");
        this.logger.info(`Bundle written to ${outputPath}`);
      }

      // Call buildEnd plugins
      if (this.option.plugins) {
        for (const plugin of this.option.plugins) {
          if (plugin.buildEnd) {
            await plugin.buildEnd();
          }
        }
      }

      this.logger.timeEnd("build");
      this.logger.info(`Build completed successfully`);
    } catch (error) {
      if (this.option.plugins) {
        for (const plugin of this.option.plugins) {
          if (plugin.buildEnd) {
            await plugin.buildEnd(
              error instanceof Error ? error : new Error(String(error)),
            );
          }
        }
      }

      this.logger.error("Build failed", error);
      throw error;
    } finally {
      this.dependencyChain.clear();
    }
  }

  private async buildNode(
    source: string,
    importer: string | null,
  ): Promise<void> {
    const resolvedPath = path.resolve(source);

    // Detect circular dependencies
    if (this.dependencyChain.has(resolvedPath)) {
      throw new CircularDependencyError(Array.from(this.dependencyChain));
    }

    if (this.nodes.has(resolvedPath)) {
      this.logger.debug(`Node already built: ${resolvedPath}`);
      return;
    }

    this.dependencyChain.add(resolvedPath);

    try {
      const node = new Node({
        xpack: this,
        source: source,
        importer: importer || source,
      });

      const resolve = await node.resolve();
      this.nodes.set(resolve.id, node);

      if (resolve.type !== "source") {
        this.logger.debug(
          `Skipping non-source module: ${resolve.id} (type: ${resolve.type})`,
        );
        return;
      }

      await node.build();

      // Build dependencies
      for (let _import of [...node.imports, ...node.requires]) {
        if (!_import.dynamic && _import.resolved) {
          try {
            await this.buildNode(_import.source, node.id);
          } catch (error) {
            if (error instanceof CircularDependencyError) {
              throw error;
            }
            this.logger.warn(
              `Failed to build dependency: ${_import.source}`,
              error,
            );
            // Continue with other dependencies
          }
        }
      }
    } finally {
      this.dependencyChain.delete(resolvedPath);
    }
  }

  private async applyReplace(node: Node): Promise<void> {
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
          code: `__require(${_import.source})`,
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
