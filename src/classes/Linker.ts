import type { Node } from "oxc-parser";
import { print } from "esrap";
import tsx from "esrap/languages/tsx";

import type ParseFile from "./ParseFile/index.js";

class Linker {
  private readonly nodes: Map<string, ParseFile>;
  private readonly visited = new Set<string>();
  private readonly ordered: ParseFile[] = [];
  private readonly cjsModules = new Set<string>();

  constructor(nodes: Map<string, ParseFile>) {
    this.nodes = nodes;
  }

  link(entry: string): string {
    this.visited.clear();
    this.ordered.length = 0;
    this.cjsModules.clear();

    this.collect(entry);

    return this.generate();
  }

  private collect(resolved: string): void {
    if (this.visited.has(resolved)) {
      return;
    }

    const node = this.nodes.get(resolved);

    if (!node) {
      throw new Error(
        `Cannot link module "${resolved}". Module does not exist in graph.`,
      );
    }

    this.visited.add(resolved);

    if (node.format === "cjs") {
      this.cjsModules.add(node.resolved);
    }

    for (const dependency of node.imports) {
      if (!dependency.resolved) {
        continue;
      }

      if (!this.nodes.has(dependency.resolved)) {
        continue;
      }

      this.collect(dependency.resolved);
    }

    this.ordered.push(node);
  }

  private generate(): string {
    const chunks: string[] = [];

    if (this.cjsModules.size > 0) {
      chunks.push(this.generateRuntime());
    }

    for (const node of this.ordered) {
      const code = this.generateModule(node);

      if (!code.trim()) {
        continue;
      }

      chunks.push(`// ${node.resolved}`);

      if (node.format === "cjs") {
        chunks.push(this.wrapCJSModule(node, code));
      } else {
        chunks.push(code);
      }
    }

    const output = chunks.filter(Boolean).join("\n\n");

    return output ? `${output}\n` : "";
  }

  private generateRuntime(): string {
    return `
const __xanpack_cache = Object.create(null);
const __xanpack_modules = Object.create(null);
const __xanpack_require = (id) => {
  const cached = __xanpack_cache[id];
  if (cached) {
    return cached.exports;
  }

  const factory = __xanpack_modules[id];

  if (!factory) {
    throw new Error(
      "Cannot find bundled module: " + id
    );
  }

  const module = {
    exports: {},
  };

  __xanpack_cache[id] = module;

  factory(
    module,
    module.exports,
    __xanpack_require,
  );

  return module.exports;
};
`.trim();
  }

  private wrapCJSModule(node: ParseFile, code: string): string {
    const id = this.moduleId(node.resolved);

    const transformed = this.transformRequires(node, code);

    return `
__xanpack_modules[${JSON.stringify(id)}] = (
  module,
  exports,
  __xanpack_require,
) => {
${this.indent(transformed, 2)}
};
`.trim();
  }

  private transformRequires(node: ParseFile, code: string): string {
    /*
     * This is only a temporary generation-level
     * replacement. The proper implementation should
     * replace require() CallExpression nodes directly
     * in the Oxc AST.
     *
     * This handles static require("...")
     * calls that already exist in the module graph.
     */

    let output = code;

    for (const dependency of node.imports) {
      if (
        dependency.kind !== "require" ||
        !dependency.source ||
        !dependency.resolved
      ) {
        continue;
      }

      if (!this.nodes.has(dependency.resolved)) {
        continue;
      }

      const dependencyId = this.moduleId(dependency.resolved);
      const replacement = `__xanpack_require(${JSON.stringify(dependencyId)})`;
      const escapedSource = this.escapeRegExp(dependency.source);

      const pattern = new RegExp(
        `\\brequire\\(\\s*["']${escapedSource}["']\\s*\\)`,
        "g",
      );

      output = output.replace(pattern, replacement);
    }

    return output;
  }

  private generateModule(node: ParseFile): string {
    const program = node.ast.program;

    if (program.type !== "Program") {
      return "";
    }

    if (node.format === "esm") {
      this.removeESMSyntax(program);
    }

    const result = print(program, tsx());

    return result.code;
  }

  private removeESMSyntax(program: Node): void {
    if (program.type !== "Program") {
      return;
    }

    const body = program.body;

    for (let i = body.length - 1; i >= 0; i--) {
      const statement = body[i];

      switch (statement.type) {
        case "ImportDeclaration":
          body.splice(i, 1);
          break;

        case "ExportNamedDeclaration": {
          if (statement.declaration) {
            body[i] = statement.declaration;
          } else {
            body.splice(i, 1);
          }

          break;
        }
        case "ExportDefaultDeclaration": {
          const declaration = statement.declaration;

          if (declaration.type === "Identifier") {
            body.splice(i, 1);
            break;
          }

          if (
            declaration.type === "FunctionDeclaration" ||
            declaration.type === "ClassDeclaration"
          ) {
            body[i] = declaration;
            break;
          }

          body[i] = {
            type: "VariableDeclaration",
            kind: "const",
            declarations: [
              {
                type: "VariableDeclarator",
                id: {
                  type: "Identifier",
                  name: `__xanpack_default_${i}`,
                  start: statement.start,
                  end: statement.start,
                },
                init: declaration as any,
                start: statement.start,
                end: statement.end,
              },
            ],
            start: statement.start,
            end: statement.end,
          };

          break;
        }

        case "ExportAllDeclaration":
          body.splice(i, 1);
          break;
      }
    }
  }

  private createDefaultDeclaration(
    declaration: Extract<
      Node,
      {
        type: "ExportDefaultDeclaration";
      }
    >["declaration"],
    statement: Extract<
      Node,
      {
        type: "ExportDefaultDeclaration";
      }
    >,
    index: number,
  ): Node {
    const name = `__xanpack_default_${index}`;

    return {
      type: "VariableDeclaration",
      kind: "const",
      declarations: [
        {
          type: "VariableDeclarator",
          id: {
            type: "Identifier",
            name,
          },
          init: declaration,
        },
      ],
      start: statement.start,
      end: statement.end,
    } as Node;
  }

  private moduleId(resolved: string): string {
    return resolved.replace(process.cwd(), "");
  }

  private indent(code: string, spaces: number): string {
    const prefix = " ".repeat(spaces);

    return code
      .split("\n")
      .map((line) => (line.trim() ? prefix + line : line))
      .join("\n");
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

export default Linker;
