import type { Expression, Argument } from "oxc-parser";
export type Resolved = string;
export type ModuleType = "entry" | "module" | "external" | "asset";
export type ModuleFormat = "esm" | "cjs";

type ImportKind =
  | "static"
  | "dynamic"
  | "require"
  | "re-export"
  | "require-resolve"
  | "import-meta-resolve";

export interface ImportInfo {
  source: string | null;
  resolved: Resolved | null;
  name: string;
  local: string;
  kind: ImportKind;
  expression?: Expression | Argument;
}

export interface ExportInfo {
  name: string;
  local: string;
  kind: "named" | "default" | "namespace" | "re-export";
}
