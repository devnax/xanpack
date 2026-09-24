import {
  CompilerAssumptions,
  DecoratorOptions,
  JsxOptions,
  TypeScriptOptions,
} from "oxc-transform";
import { Node } from "oxc-parser";

export type XanpackInput = string | Record<string, any>;
export type Defines = Record<string, string>;
export type ResolverResult = {
  id: string;
  type: "source" | "external" | "asset";
  external?: boolean;
};
export type ReplacerResult = {
  code: string;
  start: number;
  end: number;
};

export interface PluginOption {
  name: string;
  buildStart?: (options: NormalizedInputOptions) => void | Promise<void>;
  watchChange?: (id: string) => void | Promise<void>;
  resolveId?: (
    source: string,
    importer?: string,
  ) => ResolverResult | null | Promise<ResolverResult | null>;

  load?: (id: string) => string | null | Promise<string | null>;
  replacer?: (id: string, node: Node) => ReplacerResult | null;
  transform?: (
    code: string,
    id: string,
  ) => string | null | Promise<string | null>;

  buildEnd?: (error?: Error) => void | Promise<void>;
}

export interface NormalizedInputOptions {
  input: string | string[] | Record<string, string>;
}

export interface OutputOptions {
  dir: string;
  format: "esm" | "cjs";
  sourcemap?: boolean;
  minify?: boolean;
  entryFileNames?: string | ((chunk: OutputChunk) => string);
  chunkFileNames?: string | ((chunk: OutputChunk) => string);
  assetFileNames?: string | ((asset: OutputAsset) => string);
}

export interface OutputChunk {
  name: string;
  facadeModuleId: string | null;
  isEntry: boolean;
  isDynamicEntry: boolean;
  modules: Record<string, OutputModule>;
}

export interface OutputModule {
  renderedLength: number;
  removedExports: string[];
}

export interface OutputAsset {
  name: string;
  source: string | Uint8Array;
}

export type XanpackOption = {
  input: string | string[] | Record<string, any>;
  output: OutputOptions;
  transform?: {
    typescript?: TypeScriptOptions;
    assumptions?: CompilerAssumptions;
    decorator?: DecoratorOptions;
    jsx?: "preserve" | JsxOptions;
    target?: string | Array<string>;
    inject?: Record<string, string | [string, string]>;
    define?: Defines;
  };
  plugins?: Array<PluginOption>;
};

export type XanpackNodes = Map<string, Node>;

// Export Node Types
export type ExportSpecifier = {
  local: string;
  exported: string;
};

export type ExportNode = {
  type: "export" | "re-export" | "identifier" | "default" | "namespace";
  source?: string;
  namespace?: string;
  specifiers: ExportSpecifier[];
  start: number;
  end: number;
};

export interface ImportSpecifier {
  type: "default" | "named" | "namespace";
  local: string;
  imported: string;
  namespace?: string;
}

export interface ImportNode {
  type: "static" | "dynamic" | "re-export";
  source: string;
  glob?: string;
  specifiers?: ImportSpecifier[];
  start: number;
  end: number;
  resolved?: string;
}

export interface RequireNode {
  type: "static" | "dynamic";
  source: string;
  glob?: string;
  start: number;
  end: number;
  resolved?: string;
}
