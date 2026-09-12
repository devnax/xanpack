import { Node } from "oxc-parser";

interface Replacement {
  type: "default" | "named" | "namespace" | "side-effect";
  start: number;
  end: number;
  code: string;
}

export default class ReplaceImport {
  replacements: Replacement[] = [];

  constructor(private code: string) {}

  add(node: Node) {
    if (node.type !== "ImportDeclaration") {
      return;
    }

    const source = node.source;

    if (source.type !== "Literal" || typeof source.value !== "string") {
      return;
    }

    const moduleName = JSON.stringify(source.value);

    // import "react";
    if (node.specifiers.length === 0) {
      this.replacements.push({
        type: "side-effect",
        start: node.start,
        end: node.end,
        code: `__xpack.import(${moduleName});`,
      });

      return;
    }

    const codes: string[] = [];

    for (const specifier of node.specifiers) {
      // import React from "react";
      if (specifier.type === "ImportDefaultSpecifier") {
        codes.push(
          `const ${specifier.local.name} = __xpack.import(${moduleName}).default;`,
        );

        continue;
      }

      // import * as React from "react";
      if (specifier.type === "ImportNamespaceSpecifier") {
        codes.push(
          `const ${specifier.local.name} = __xpack.import(${moduleName});`,
        );

        continue;
      }

      // import { useState } from "react";
      // import { useState as state } from "react";
      if (specifier.type === "ImportSpecifier") {
        const imported = specifier.imported;

        let importedName: string;

        if (imported.type === "Identifier") {
          importedName = imported.name;
        } else {
          importedName = imported.value;
        }

        codes.push(
          `const ${specifier.local.name} = __xpack.import(${moduleName}).${importedName};`,
        );
      }
    }

    this.replacements.push({
      type: "named",
      start: node.start,
      end: node.end,
      code: codes.join("\n"),
    });
  }

  apply() {
    this.replacements.sort((a, b) => b.start - a.start);

    let result = this.code;

    for (const replacement of this.replacements) {
      result =
        result.slice(0, replacement.start) +
        replacement.code +
        result.slice(replacement.end);
    }

    this.code = result;
    this.replacements = [];

    return result;
  }
}
