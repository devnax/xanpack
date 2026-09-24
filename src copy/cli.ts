#!/usr/bin/env node

import { bundle } from "./index.js";
import process from "node:process";
import path from "node:path";

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`
Xanpack - Minimal JavaScript Bundler

Usage:
  xanpack <input> <output> [--format esm|cjs]

Examples:
  xanpack src/index.js dist
  xanpack src/main.ts build --format cjs
`);
    process.exit(1);
  }

  const input = args[0];
  const output = args[1];
  let format: "esm" | "cjs" = "esm";

  // Parse --format option
  const formatIndex = args.indexOf("--format");
  if (formatIndex !== -1 && args[formatIndex + 1]) {
    format = args[formatIndex + 1] as "esm" | "cjs";
  }

  try {
    // Resolve paths to absolute
    const cwd = process.cwd();
    const absoluteInput = path.isAbsolute(input)
      ? input
      : path.join(cwd, input);
    const absoluteOutput = path.isAbsolute(output)
      ? output
      : path.join(cwd, output);

    await bundle({
      input: absoluteInput,
      output: { dir: absoluteOutput, format },
    });
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
