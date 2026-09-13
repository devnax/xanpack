import type {
  Declaration,
  ExportAllDeclaration,
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  Node,
} from "oxc-parser";

import type { ExportInfo } from "./types.js";

export default class ExtractExports {
  static extract(node: Node): ExportInfo[] {
    switch (node.type) {
      case "ExportNamedDeclaration":
        return this.extractNamed(node);

      case "ExportDefaultDeclaration":
        return this.extractDefault(node);

      case "ExportAllDeclaration":
        return this.extractAll(node);

      default:
        return [];
    }
  }

  /**
   * Handles:
   *
   * export const foo = 1;
   * export let foo = 1;
   * export var foo = 1;
   *
   * export function foo() {}
   * export class Foo {}
   *
   * export { foo };
   * export { foo as bar };
   *
   * export { foo } from "./foo";
   * export { foo as bar } from "./foo";
   */
  private static extractNamed(node: ExportNamedDeclaration): ExportInfo[] {
    const exports: ExportInfo[] = [];

    /*
     * export const foo = 1;
     * export function foo() {}
     * export class Foo {}
     */
    if (node.declaration) {
      exports.push(
        ...this.extractDeclaration(node.declaration, node.start, node.end),
      );
    }

    /*
     * export { foo };
     * export { foo as bar };
     *
     * export { foo } from "./foo";
     * export { foo as bar } from "./foo";
     */
    for (const specifier of node.specifiers) {
      if (specifier.type !== "ExportSpecifier") {
        continue;
      }

      const name = this.getName(specifier.exported);
      const local = this.getName(specifier.local);

      /*
       * Re-export:
       *
       * export { foo } from "./foo";
       * export { foo as bar } from "./foo";
       */
      if (node.source) {
        exports.push({
          name,
          local,
          kind: "re-export",
          loc: {
            start: node.start,
            end: node.end,
          },
        });

        continue;
      }

      /*
       * Local export:
       *
       * export { foo };
       * export { foo as bar };
       */
      exports.push({
        name,
        local,
        kind: "named",
        loc: {
          start: node.start,
          end: node.end,
        },
      });
    }

    return exports;
  }

  /**
   * Handles:
   *
   * export default foo;
   *
   * export default function foo() {}
   * export default function () {}
   *
   * export default class Foo {}
   * export default class {}
   */
  private static extractDefault(node: ExportDefaultDeclaration): ExportInfo[] {
    const declaration = node.declaration;

    /*
     * export default function foo() {}
     * export default class Foo {}
     */
    if (
      declaration.type === "FunctionDeclaration" ||
      declaration.type === "ClassDeclaration"
    ) {
      /*
       * Named:
       *
       * export default function foo() {}
       * export default class Foo {}
       */
      if (declaration.id) {
        return [
          {
            name: "default",
            local: declaration.id.name,
            kind: "default",
            loc: {
              start: node.start,
              end: node.end,
            },
          },
        ];
      }

      /*
       * Anonymous:
       *
       * export default function () {}
       * export default class {}
       */
      return [
        {
          name: "default",
          local: "default",
          kind: "default",
          loc: {
            start: node.start,
            end: node.end,
          },
        },
      ];
    }

    /*
     * export default foo;
     */
    if (declaration.type === "Identifier") {
      return [
        {
          name: "default",
          local: declaration.name,
          kind: "default",
          loc: {
            start: node.start,
            end: node.end,
          },
        },
      ];
    }

    /*
     * export default 123;
     * export default "hello";
     * export default {};
     *
     * There is no local binding.
     */
    return [
      {
        name: "default",
        local: "default",
        kind: "default",
        loc: {
          start: node.start,
          end: node.end,
        },
      },
    ];
  }

  /**
   * Handles:
   *
   * export * from "./foo";
   * export * as foo from "./foo";
   */
  private static extractAll(node: ExportAllDeclaration): ExportInfo[] {
    /*
     * export * from "./foo";
     *
     * Re-export all named exports from "./foo".
     */
    if (!node.exported) {
      return [
        {
          name: "*",
          local: "*",
          kind: "re-export",
          loc: {
            start: node.start,
            end: node.end,
          },
        },
      ];
    }

    /*
     * export * as foo from "./foo";
     *
     * Namespace export.
     */
    const name = this.getName(node.exported);

    return [
      {
        name,
        local: name,
        kind: "namespace",
        loc: {
          start: node.start,
          end: node.end,
        },
      },
    ];
  }

  /**
   * Extract exports from:
   *
   * export const foo = 1;
   * export let foo = 1;
   * export var foo = 1;
   *
   * export function foo() {}
   * export class Foo {}
   */
  private static extractDeclaration(
    declaration: Declaration,
    start: number,
    end: number,
  ): ExportInfo[] {
    switch (declaration.type) {
      /*
       * export const foo = 1;
       * export const foo = 1, bar = 2;
       */
      case "VariableDeclaration":
        return declaration.declarations.flatMap((declarator) => {
          const names = this.extractBindingNames(declarator.id);

          return names.map((name) => ({
            name,
            local: name,
            kind: "named" as const,
            loc: {
              start,
              end,
            },
          }));
        });

      /*
       * export function foo() {}
       */
      case "FunctionDeclaration":
        if (!declaration.id) {
          return [];
        }

        return [
          {
            name: declaration.id.name,
            local: declaration.id.name,
            kind: "named",
            loc: {
              start,
              end,
            },
          },
        ];

      /*
       * export class Foo {}
       */
      case "ClassDeclaration":
        if (!declaration.id) {
          return [];
        }

        return [
          {
            name: declaration.id.name,
            local: declaration.id.name,
            kind: "named",
            loc: {
              start,
              end,
            },
          },
        ];

      default:
        return [];
    }
  }

  /**
   * Extract identifiers from variable bindings.
   *
   * Supports:
   *
   * const foo = 1;
   *
   * const { foo } = obj;
   * const { foo: bar } = obj;
   *
   * const [foo, bar] = arr;
   *
   * const { foo: { bar } } = obj;
   */
  private static extractBindingNames(node: any): string[] {
    switch (node.type) {
      /*
       * const foo = 1;
       */
      case "Identifier":
        return [node.name];

      /*
       * const { foo, bar } = obj;
       * const { foo: baz } = obj;
       * const { foo: { bar } } = obj;
       */
      case "ObjectPattern":
        return node.properties.flatMap((property: any) => {
          /*
           * { foo }
           * { foo: bar }
           */
          if (property.type === "Property") {
            return this.extractBindingNames(property.value);
          }

          /*
           * { ...rest }
           */
          if (property.type === "RestElement") {
            return this.extractBindingNames(property.argument);
          }

          return [];
        });

      /*
       * const [foo, bar] = arr;
       */
      case "ArrayPattern":
        return node.elements.flatMap((element: any) => {
          if (!element) {
            return [];
          }

          return this.extractBindingNames(element);
        });

      /*
       * const foo = 1;
       *
       * const foo = 1 with default value
       */
      case "AssignmentPattern":
        return this.extractBindingNames(node.left);

      /*
       * const { ...foo } = obj;
       */
      case "RestElement":
        return this.extractBindingNames(node.argument);

      default:
        return [];
    }
  }

  /**
   * Get an identifier or string-literal name.
   */
  private static getName(node: any): string {
    if (node.type === "Identifier") {
      return node.name;
    }

    return String(node.value);
  }
}
