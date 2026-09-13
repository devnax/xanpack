import type { Node } from "oxc-parser";

export interface ExportInfo {
  name: string;
  local: string;
  kind: "named" | "default" | "namespace" | "re-export";
}

export default class OptimizeExports {
  readonly exports: ExportInfo[] = [];

  optimize(
    node: any,
    walker: any,
    parent: any,
    key: string | null,
    index: number | null,
  ): void {
    switch (node.type) {
      case "ExportDefaultDeclaration":
        this.defaultExport(node, walker, parent, key, index);
        break;

      case "ExportNamedDeclaration":
        this.namedExport(node, walker, parent, key, index);
        break;

      case "ExportAllDeclaration":
        this.exportAll(node, walker);
        break;
    }
  }

  private defaultExport(
    node: any,
    walker: any,
    parent: any,
    key: string | null,
    index: number | null,
  ): void {
    const declaration = node.declaration;

    // export default function foo() {}
    if (
      declaration.type === "FunctionDeclaration" ||
      declaration.type === "ClassDeclaration"
    ) {
      const local = declaration.id?.name;

      if (local) {
        this.exports.push({
          name: "default",
          local,
          kind: "default",
        });

        this.replaceStatements(parent, key, index, [
          declaration,
          this.statement(this.assignment("default", this.identifier(local))),
        ]);

        return;
      }

      // export default function () {}
      // export default class {}
      const localName = "__xpack_default";

      this.exports.push({
        name: "default",
        local: localName,
        kind: "default",
      });

      this.replaceStatements(parent, key, index, [
        {
          type: "VariableDeclaration",
          kind: "const",
          declarations: [
            {
              type: "VariableDeclarator",
              id: this.identifier(localName),
              init: declaration,
            },
          ],
        },
        this.statement(this.assignment("default", this.identifier(localName))),
      ]);

      return;
    }

    // export default 1
    this.exports.push({
      name: "default",
      local: "__xpack_default",
      kind: "default",
    });

    walker.replace(this.statement(this.assignment("default", declaration)));
  }

  private namedExport(
    node: any,
    walker: any,
    parent: any,
    key: string | null,
    index: number | null,
  ): void {
    /*
     * export const foo = 1
     */
    if (node.declaration) {
      const declaration = node.declaration;

      if (declaration.type === "VariableDeclaration") {
        for (const declarator of declaration.declarations) {
          const names = this.patternNames(declarator.id);

          for (const local of names) {
            this.exports.push({
              name: local,
              local,
              kind: "named",
            });

            if (declarator.init) {
              declarator.init = this.assignment(local, declarator.init);
            }
          }
        }

        walker.replace(declaration);
        return;
      }

      /*
       * export function foo() {}
       *
       * export class Foo {}
       */
      if (
        declaration.type === "FunctionDeclaration" ||
        declaration.type === "ClassDeclaration"
      ) {
        const local = declaration.id?.name;

        if (!local) {
          return;
        }

        this.exports.push({
          name: local,
          local,
          kind: "named",
        });

        this.replaceStatements(parent, key, index, [
          declaration,
          this.statement(this.assignment(local, this.identifier(local))),
        ]);

        return;
      }
    }

    /*
     * export { foo };
     * export { foo as bar };
     */
    for (const specifier of node.specifiers ?? []) {
      if (specifier.type !== "ExportSpecifier") {
        continue;
      }

      const local = this.name(specifier.local);
      const exported = this.name(specifier.exported);

      if (!local || !exported) {
        continue;
      }

      this.exports.push({
        name: exported,
        local,
        kind: "named",
      });
    }

    const statements = [];

    for (const specifier of node.specifiers ?? []) {
      if (specifier.type !== "ExportSpecifier") {
        continue;
      }

      const local = this.name(specifier.local);
      const exported = this.name(specifier.exported);

      if (local === null || exported === null) {
        continue;
      }

      statements.push(
        this.statement(this.assignment(exported, this.identifier(local))),
      );
    }

    this.replaceStatements(parent, key, index, statements);
  }

  private exportAll(node: any, walker: any): void {
    /*
     * export * as foo from "./foo"
     */
    if (node.exported) {
      const name = this.name(node.exported);

      if (!name) {
        return;
      }

      this.exports.push({
        name,
        local: name,
        kind: "namespace",
      });

      walker.replace(
        this.statement(this.assignment(name, this.require(node.source))),
      );

      return;
    }

    /*
     * export * from "./foo"
     */
    this.exports.push({
      name: "*",
      local: "*",
      kind: "re-export",
    });

    walker.replace(
      this.statement({
        type: "CallExpression",
        callee: {
          type: "MemberExpression",
          object: this.identifier("Object"),
          property: this.identifier("assign"),
          computed: false,
          optional: false,
        },
        arguments: [this.identifier("exports"), this.require(node.source)],
        optional: false,
      }),
    );
  }

  private replaceStatements(
    node: any,
    walker: any,
    parent: any,
    key: string | null,
    index: number | null,
    statements: any[],
  ): void {
    if (statements.length === 0) {
      walker.remove();
      return;
    }

    walker.replace(statements[0]);

    if (parent && key && index !== null && Array.isArray(parent[key])) {
      parent[key].splice(index + 1, 0, ...statements.slice(1));
    }
  }

  private assignment(name: string, value: any): any {
    return {
      type: "AssignmentExpression",
      operator: "=",
      left: {
        type: "MemberExpression",
        object: this.identifier("exports"),
        property: this.identifier(name),
        computed: false,
        optional: false,
      },
      right: value,
    };
  }

  private statement(expression: any): any {
    return {
      type: "ExpressionStatement",
      expression,
    };
  }

  private identifier(name: string): any {
    return {
      type: "Identifier",
      name,
    };
  }

  private require(source: any): any {
    return {
      type: "CallExpression",
      callee: this.identifier("require"),
      arguments: [
        {
          type: "Literal",
          value: source.value,
          raw: source.raw,
        },
      ],
      optional: false,
    };
  }

  private name(node: any): string | null {
    if (node?.type === "Identifier") {
      return node.name;
    }

    if (node?.type === "Literal" && typeof node.value === "string") {
      return node.value;
    }

    return null;
  }

  private patternNames(node: any): string[] {
    if (node.type === "Identifier") {
      return [node.name];
    }

    if (node.type === "RestElement") {
      return this.patternNames(node.argument);
    }

    if (node.type === "AssignmentPattern") {
      return this.patternNames(node.left);
    }

    if (node.type === "ArrayPattern") {
      return node.elements.flatMap((item: any) =>
        item ? this.patternNames(item) : [],
      );
    }

    if (node.type === "ObjectPattern") {
      return node.properties.flatMap((property: any) => {
        if (property.type === "RestElement") {
          return this.patternNames(property.argument);
        }

        return this.patternNames(property.value);
      });
    }

    return [];
  }
}
