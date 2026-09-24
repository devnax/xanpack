import { Bundler } from "./bundler.js";
import type { BundleOptions } from "./types.js";

export async function bundle(options: BundleOptions): Promise<void> {
  const bundler = new Bundler(options);
  await bundler.bundle();
}

export { Bundler };
export type { BundleOptions, Plugin, Module } from "./types.js";
