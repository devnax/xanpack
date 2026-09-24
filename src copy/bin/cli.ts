#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import xanpack from "../functions/xanpack.js";
import Logger, { LogLevel } from "../utils/Logger.js";
import { XanpackError } from "../utils/Errors.js";

interface CLIOptions {
  input?: string;
  output?: string;
  format?: "esm" | "cjs";
  config?: string;
  debug?: boolean;
  minify?: boolean;
  sourcemap?: boolean;
}

class CLI {
  private logger: Logger;

  constructor() {
    this.logger = new Logger({
      level: LogLevel.INFO,
      prefix: "xanpack-cli",
      colors: true,
    });
  }

  private parseArgs(): CLIOptions {
    const args = process.argv.slice(2);
    const options: CLIOptions = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === "--input" || arg === "-i") {
        options.input = args[++i];
      } else if (arg === "--output" || arg === "-o") {
        options.output = args[++i];
      } else if (arg === "--format" || arg === "-f") {
        options.format = args[++i] as "esm" | "cjs";
      } else if (arg === "--config" || arg === "-c") {
        options.config = args[++i];
      } else if (arg === "--debug") {
        options.debug = true;
      } else if (arg === "--minify") {
        options.minify = true;
      } else if (arg === "--sourcemap") {
        options.sourcemap = true;
      } else if (arg === "--help" || arg === "-h") {
        this.printHelp();
        process.exit(0);
      } else if (arg === "--version" || arg === "-v") {
        this.printVersion();
        process.exit(0);
      } else if (!arg.startsWith("-")) {
        // Assume first positional argument is input
        if (!options.input) {
          options.input = arg;
        } else if (!options.output) {
          options.output = arg;
        }
      }
    }

    return options;
  }

  private async loadConfig(configPath?: string): Promise<Record<string, any>> {
    const searchPaths = [
      configPath,
      path.resolve(process.cwd(), "xanpack.config.js"),
      path.resolve(process.cwd(), "xanpack.config.mjs"),
      path.resolve(process.cwd(), ".xanpackrc.json"),
      path.resolve(process.cwd(), ".xanpackrc.js"),
    ].filter((p): p is string => p !== undefined && p !== null);

    for (const filePath of searchPaths) {
      try {
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          if (filePath.endsWith(".json")) {
            const content = await fs.readFile(filePath, "utf-8");
            return JSON.parse(content);
          } else {
            // For .js/.mjs files, we'd need to use dynamic import
            this.logger.warn(
              `JavaScript config files require Node.js dynamic import`,
            );
            return {};
          }
        }
      } catch (error) {
        // Continue to next path
      }
    }

    return {};
  }

  private async run(): Promise<void> {
    try {
      const cliArgs = this.parseArgs();

      if (cliArgs.debug) {
        this.logger.setLevel(LogLevel.DEBUG);
      }

      this.logger.debug("CLI arguments", cliArgs);

      // Load config file
      const config = await this.loadConfig(cliArgs.config);
      this.logger.debug("Loaded configuration", config);

      // Merge CLI options with config
      const mergedConfig = {
        ...config,
        input: cliArgs.input || config.input,
        output: {
          dir: cliArgs.output || config.output?.dir,
          format: cliArgs.format || config.output?.format || "esm",
          minify: cliArgs.minify ?? config.output?.minify ?? false,
          sourcemap: cliArgs.sourcemap ?? config.output?.sourcemap ?? false,
        },
        debug: cliArgs.debug ?? config.debug ?? false,
      };

      // Validate required options
      if (!mergedConfig.input) {
        this.logger.error("Missing required option: --input <path>");
        this.printHelp();
        process.exit(1);
      }

      if (!mergedConfig.output?.dir) {
        this.logger.error("Missing required option: --output <path>");
        this.printHelp();
        process.exit(1);
      }

      this.logger.info("Starting bundler...");

      // Run bundler
      const result = await xanpack({
        input: mergedConfig.input,
        output: {
          dir: mergedConfig.output.dir,
          format: mergedConfig.output.format,
          minify: mergedConfig.output.minify,
          sourcemap: mergedConfig.output.sourcemap,
        },
        transform: config.transform,
        plugins: config.plugins,
      } as any);

      this.logger.info("Bundle created successfully!");
      process.exit(0);
    } catch (error) {
      if (error instanceof XanpackError) {
        this.logger.error(`${error.code}: ${error.message}`);
      } else if (error instanceof Error) {
        this.logger.error(error.message);
        if (this.logger["level"] === LogLevel.DEBUG) {
          console.error(error.stack);
        }
      } else {
        this.logger.error("Unknown error occurred");
      }
      process.exit(1);
    }
  }

  private printHelp(): void {
    console.log(`
Xanpack - Professional JavaScript Bundler

Usage:
  xanpack [options] <input> [output]

Options:
  -i, --input <path>      Entry point file
  -o, --output <path>     Output directory
  -f, --format <format>   Output format: esm or cjs (default: esm)
  -c, --config <path>     Configuration file path
  --debug                 Enable debug logging
  --minify                Minify output
  --sourcemap             Generate sourcemaps
  -h, --help              Show this help message
  -v, --version           Show version number

Examples:
  xanpack -i src/index.js -o dist
  xanpack --input src/main.ts --output build --format cjs
  xanpack --config xanpack.config.js
    `);
  }

  private printVersion(): void {
    const pkg = require("../../package.json");
    console.log(`Xanpack v${pkg.version}`);
  }
}

// Run CLI
const cli = new CLI();
(async () => {
  await cli["run"]();
})().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
