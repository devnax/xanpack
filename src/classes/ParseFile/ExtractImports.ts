import type {
  CallExpression,
  ExportAllDeclaration,
  ExportNamedDeclaration,
  ImportDeclaration,
  ImportExpression,
  Node,
} from "oxc-parser";

import type { ImportInfo } from "./types.js";

export default class ExtractImports {
  static extract(node: Node): ImportInfo[] {
    switch (node.type) {
      case "ImportDeclaration":
        return this.extractImportDeclaration(node);

      case "ExportNamedDeclaration":
        return this.extractExportNamedDeclaration(node);

      case "ExportAllDeclaration":
        return this.extractExportAllDeclaration(node);

      case "ImportExpression":
        return [this.extractImportExpression(node)];

      case "CallExpression":
        return this.extractCallExpression(node);

      default:
        return [];
    }
  }

  static extractImportExpression(node: ImportExpression): ImportInfo {
    if (
      node.source.type === "Literal" &&
      typeof node.source.value === "string"
    ) {
      return {
        source: node.source.value,
        resolved: null,
        name: "*",
        local: "",
        kind: "dynamic",
      };
    }

    return {
      source: null,
      resolved: null,
      name: "*",
      local: "",
      kind: "dynamic",
    };
  }

  static extractCallExpression(node: CallExpression): ImportInfo[] {
    if (node.callee.type === "Identifier" && node.callee.name === "require") {
      const argument = node.arguments[0];

      if (
        argument &&
        argument.type === "Literal" &&
        typeof argument.value === "string"
      ) {
        return [
          {
            source: argument.value,
            resolved: null,
            name: "default",
            local: "",
            kind: "require",
          },
        ];
      }

      return [
        {
          source: null,
          resolved: null,
          name: "default",
          local: "",
          kind: "require",
        },
      ];
    }

    return [];
  }

  private static extractImportDeclaration(
    node: ImportDeclaration,
  ): ImportInfo[] {
    const source = node.source.value;

    if (node.specifiers.length === 0) {
      return [
        {
          source,
          resolved: null,
          name: "*",
          local: "",
          kind: "static",
        },
      ];
    }

    return node.specifiers.map((specifier) => {
      switch (specifier.type) {
        case "ImportDefaultSpecifier":
          return {
            source,
            resolved: null,
            name: "default",
            local: specifier.local.name,
            kind: "static",
          };

        case "ImportNamespaceSpecifier":
          return {
            source,
            resolved: null,
            name: "*",
            local: specifier.local.name,
            kind: "static",
          };

        case "ImportSpecifier":
          return {
            source,
            resolved: null,
            name:
              specifier.imported.type === "Identifier"
                ? specifier.imported.name
                : String(specifier.imported.value),
            local: specifier.local.name,
            kind: "static",
          };
      }
    });
  }

  private static extractExportNamedDeclaration(
    node: ExportNamedDeclaration,
  ): ImportInfo[] {
    if (!node.source) {
      return [];
    }

    const source = node.source.value;

    return node.specifiers
      .filter((specifier) => specifier.type === "ExportSpecifier")
      .map((specifier) => ({
        source,
        resolved: null,
        name:
          specifier.exported.type === "Identifier"
            ? specifier.exported.name
            : String(specifier.exported.value),
        local:
          specifier.local.type === "Identifier"
            ? specifier.local.name
            : String(specifier.local.value),
        kind: "re-export" as const,
      }));
  }

  private static extractExportAllDeclaration(
    node: ExportAllDeclaration,
  ): ImportInfo[] {
    return [
      {
        source: node.source.value,
        resolved: null,
        name: "*",
        local: "",
        kind: "re-export",
      },
    ];
  }
}
