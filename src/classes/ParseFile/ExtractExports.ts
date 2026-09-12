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
      exports.push(...this.extractDeclaration(node.declaration));
    }

    /*
     * export { foo };
     *
     * export { foo as bar };
     *
     * export { foo } from "./foo";
     *
     * export { foo as bar } from "./foo";
     */
    for (const specifier of node.specifiers) {
      if (specifier.type !== "ExportSpecifier") {
        continue;
      }

      const name = this.getName(specifier.exported);
      const local = this.getName(specifier.local);

      /*
       * export { foo } from "./foo";
       *
       * export { foo as bar } from "./foo";
       *
       * These are re-exports.
       */
      if (node.source) {
        exports.push({
          name,
          local,
          kind: "re-export",
        });

        continue;
      }

      /*
       * export { foo };
       *
       * export { foo as bar };
       */
      exports.push({
        name,
        local,
        kind: "named",
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
     *
     * export default class Foo {}
     */
    if (
      declaration.type === "FunctionDeclaration" ||
      declaration.type === "ClassDeclaration"
    ) {
      /*
       * Named declaration:
       *
       * export default function foo() {}
       *
       * export default class Foo {}
       */
      if (declaration.id) {
        return [
          {
            name: "default",
            local: declaration.id.name,
            kind: "default",
          },
        ];
      }

      /*
       * Anonymous declaration:
       *
       * export default function () {}
       *
       * export default class {}
       */
      return [
        {
          name: "default",
          local: "default",
          kind: "default",
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
        },
      ];
    }

    /*
     * export default 123;
     *
     * export default "hello";
     *
     * export default {};
     *
     * There is no local binding.
     */
    return [
      {
        name: "default",
        local: "default",
        kind: "default",
      },
    ];
  }

  /**
   * Handles:
   *
   * export * from "./foo";
   *
   * export * as foo from "./foo";
   */
  private static extractAll(node: ExportAllDeclaration): ExportInfo[] {
    /*
     * export * from "./foo";
     *
     * This re-exports all named exports from "./foo".
     */
    if (!node.exported) {
      return [
        {
          name: "*",
          local: "*",
          kind: "re-export",
        },
      ];
    }

    /*
     * export * as foo from "./foo";
     *
     * This creates a namespace export.
     */
    return [
      {
        name: this.getName(node.exported),
        local: this.getName(node.exported),
        kind: "namespace",
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
  private static extractDeclaration(declaration: Declaration): ExportInfo[] {
    switch (declaration.type) {
      /*
       * export const foo = 1;
       *
       * export const foo = 1, bar = 2;
       */
      case "VariableDeclaration":
        return declaration.declarations.flatMap((declarator) => {
          const names = this.extractBindingNames(declarator.id);

          return names.map((name) => ({
            name,
            local: name,
            kind: "named" as const,
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
   *
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
       *
       * const { foo: baz } = obj;
       *
       * const { foo: { bar } } = obj;
       */
      case "ObjectPattern":
        return node.properties.flatMap((property: any) => {
          /*
           * { foo }
           *
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
       * const foo = ...
       *
       * with default:
       *
       * const foo = 1;
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
