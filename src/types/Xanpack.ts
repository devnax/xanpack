import {
  CompilerAssumptions,
  DecoratorOptions,
  Helpers,
  JsxOptions,
  TransformOptions,
  TypeScriptOptions,
} from "oxc-transform";
import ParseFile from "../classes/ParseFile";

export type XanpackInput = string | Record<string, any>;
export type Defines = Record<string, string>;

export interface PluginOption {
  name: string;
  buildStart?: (options: NormalizedInputOptions) => void | Promise<void>;
  resolveId?: (
    source: string,
    importer?: string,
    options?: {
      isEntry: boolean;
      attributes: Record<string, string>;
    },
  ) => string | null | false | Promise<string | null | false>;

  load?: (id: string) => string | null | Promise<string | null>;

  transform?: (
    code: string,
    id: string,
  ) =>
    | string
    | TransformResult
    | null
    | Promise<string | TransformResult | null>;

  buildEnd?: (error?: Error) => void | Promise<void>;
}

export interface TransformResult {
  code: string;
  map?: string | object | null;
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
  input: string | Record<string, any>;
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

export type XanpackNodes = Map<string, ParseFile>;
