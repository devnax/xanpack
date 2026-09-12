import { walk } from "oxc-walker";

export interface XSymbol {
  id: number;
  name: string;
  declaration: any;
  references: any[];
}

export interface XScope {
  parent: XScope | null;
  symbols: Map<string, XSymbol>;
}

export class ScopeAnalyzer {
  private symbolId = 0;

  private globalScope: XScope = {
    parent: null,
    symbols: new Map(),
  };

  private scope: XScope = this.globalScope;

  analyze(program: any) {
    walk(program, {
      enter: (node, parent, ctx) => {
        this.enter(node, parent, ctx);
      },

      leave: (node) => {
        this.leave(node);
      },
    });

    return this.globalScope;
  }

  private enter(node: any, parent: any, ctx: any) {
    /*
     * Function
     */
    if (
      node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression"
    ) {
      /*
       * Function declaration belongs to
       * the parent scope.
       */
      if (
        node.type === "FunctionDeclaration" &&
        node.id?.type === "Identifier"
      ) {
        this.declare(node.id.name, node.id);
      }

      this.enterScope();

      /*
       * Named function expression:
       *
       * const fn = function foo() {};
       */
      if (
        node.type === "FunctionExpression" &&
        node.id?.type === "Identifier"
      ) {
        this.declare(node.id.name, node.id);
      }

      /*
       * Parameters
       */
      for (const param of node.params) {
        this.declarePattern(param);
      }

      return;
    }

    /*
     * Variable
     */
    if (node.type === "VariableDeclarator") {
      this.declarePattern(node.id);
      return;
    }

    /*
     * Class
     */
    if (node.type === "ClassDeclaration" && node.id?.type === "Identifier") {
      this.declare(node.id.name, node.id);
      return;
    }

    /*
     * Imports
     */
    if (node.type === "ImportDeclaration") {
      for (const specifier of node.specifiers) {
        if (specifier.local?.type === "Identifier") {
          this.declare(specifier.local.name, specifier.local);
        }
      }

      return;
    }

    /*
     * Identifier reference
     */
    if (node.type === "Identifier" && this.isReference(node, parent)) {
      const symbol = this.resolve(node.name);

      if (symbol) {
        symbol.references.push(node);
      }
    }
  }

  private leave(node: any) {
    if (
      node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression"
    ) {
      this.leaveScope();
    }
  }

  private declare(name: string, declaration: any): XSymbol {
    const existing = this.scope.symbols.get(name);

    if (existing) {
      return existing;
    }

    const symbol: XSymbol = {
      id: ++this.symbolId,
      name,
      declaration,
      references: [],
    };

    this.scope.symbols.set(name, symbol);

    return symbol;
  }

  private declarePattern(node: any) {
    if (!node) return;

    switch (node.type) {
      case "Identifier":
        this.declare(node.name, node);
        break;

      case "ObjectPattern":
        for (const property of node.properties) {
          if (property.type === "Property") {
            this.declarePattern(property.value);
          } else if (property.type === "RestElement") {
            this.declarePattern(property.argument);
          }
        }
        break;

      case "ArrayPattern":
        for (const element of node.elements) {
          if (element) {
            this.declarePattern(element);
          }
        }
        break;

      case "AssignmentPattern":
        this.declarePattern(node.left);
        break;

      case "RestElement":
        this.declarePattern(node.argument);
        break;
    }
  }

  private resolve(name: string): XSymbol | undefined {
    let current: XScope | null = this.scope;

    while (current) {
      const symbol = current.symbols.get(name);

      if (symbol) {
        return symbol;
      }

      current = current.parent;
    }

    return undefined;
  }

  private enterScope() {
    this.scope = {
      parent: this.scope,
      symbols: new Map(),
    };
  }

  private leaveScope() {
    if (this.scope.parent) {
      this.scope = this.scope.parent;
    }
  }

  private isReference(node: any, parent: any): boolean {
    if (!parent) {
      return false;
    }

    /*
     * We need to know where the Identifier occurs
     * inside the parent.
     *
     * Use object identity instead of the old `key`
     * argument.
     */

    if (parent.type === "VariableDeclarator" && parent.id === node) {
      return false;
    }

    if (
      (parent.type === "FunctionDeclaration" ||
        parent.type === "FunctionExpression") &&
      parent.id === node
    ) {
      return false;
    }

    if (parent.type === "ClassDeclaration" && parent.id === node) {
      return false;
    }

    /*
     * MemberExpression:
     *
     * obj.foo
     *
     * `foo` is not a variable reference.
     */
    if (
      parent.type === "MemberExpression" &&
      parent.property === node &&
      !parent.computed
    ) {
      return false;
    }

    /*
     * Property:
     *
     * { foo: value }
     *
     * `foo` is a property key.
     */
    if (parent.type === "Property" && parent.key === node && !parent.computed) {
      return false;
    }

    /*
     * Import specifiers.
     */
    if (
      parent.type === "ImportSpecifier" &&
      (parent.imported === node || parent.local === node)
    ) {
      return false;
    }

    if (parent.type === "ImportDefaultSpecifier" && parent.local === node) {
      return false;
    }

    if (parent.type === "ImportNamespaceSpecifier" && parent.local === node) {
      return false;
    }

    return true;
  }
}
