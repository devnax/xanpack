export interface BundleOptions {
  input: string | string[];
  output: {
    dir: string;
    format?: "esm" | "cjs";
  };
  plugins?: Plugin[];
}

export interface Plugin {
  name: string;
  resolveId?: (source: string, importer?: string) => string | null;
  load?: (id: string) => string | null;
  transform?: (code: string, id: string) => string | null;
}

export interface Module {
  id: string;
  code: string;
  imports: ImportInfo[];
  exports: ExportInfo[];
}

export interface ImportInfo {
  source: string;
  specifiers: string[];
  dynamic: boolean;
}

export interface ExportInfo {
  name: string;
  local: string;
}
