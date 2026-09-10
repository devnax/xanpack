export type Resolved = string;

export interface ModuleNode {
  id: string;
  resolved: Resolved;

  imports: ImportInfo[];
  exports: ExportInfo[];

  type: "entry" | "module" | "external" | "asset";
}

export interface ImportInfo {
  source: string;
  resolved: Resolved | null;
  name: string;
  local: string;
  kind: "static" | "dynamic";
}

export interface ExportInfo {
  name: string;
  local: string;
  kind: "named" | "default" | "namespace" | "re-export";
}

export type ModuleNodes = Map<Resolved, ModuleNode>;
