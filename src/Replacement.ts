import Node from "./Node";
import { ReplacerResult } from "./types";
import { XanpackError } from "./utils/Errors.js";
import Xanpack from "./Xanpack";

class Replacement {
  node: Node;
  xpack: Xanpack;
  private replacements: ReplacerResult[] = [];
  constructor(node: Node) {
    this.node = node;
    this.xpack = node.xpack;
  }

  add(replacement: ReplacerResult) {
    this.replacements.push(replacement);
  }

  private collectExports() {
    for (let _export of this.node.exports) {
      if (_export.type === "default") {
        this.replacements.push({
          start: _export.start,
          end: _export.start + "export default".length,
          code: `exports.default =`,
        });
      } else if (_export.type === "identifier") {
        this.replacements.push({
          start: _export.start,
          end: _export.start + "export ".length,
          code: ``,
        });

        for (let specifier of _export.specifiers) {
          this.replacements.push({
            start: _export.end,
            end: _export.end,
            code: `\nexports.${specifier.exported} = ${specifier.local};`,
          });
        }
      } else if (_export.type === "export") {
        // export {name}
        const specifiers: string[] = [];
        for (let specifier of _export.specifiers) {
          specifiers.push(
            `exports.${specifier.exported} = ${specifier.local};`,
          );
        }
        this.replacements.push({
          start: _export.start,
          end: _export.end,
          code: specifiers.join("\n"),
        });
      } else if (_export.type === "re-export") {
        const node = this.xpack.getNode(_export.source!);
        if (!node) {
          throw new XanpackError(`Module not found: ${_export.source}`);
        }
        // export { namedValue } from "./named-module";
        const specifiers: string[] = [];
        const _code = `var _${node.name} = ${node.name}();`;
        for (let specifier of _export.specifiers) {
          specifiers.push(
            `exports.${specifier.exported} = _${node.name}.${specifier.local};`,
          );
        }
        this.replacements.push({
          start: _export.end,
          end: _export.end,
          code: `${_code}\n${specifiers.join("\n")}`,
        });
      } else if (_export.type === "namespace") {
        const node = this.xpack.getNode(_export.source!);
        if (!node) {
          throw new XanpackError(`Module not found: ${_export.source}`);
        }
        // export * as name from "module", export * from 'module'
        if (_export.namespace === undefined) {
          // export * from 'module'
          this.replacements.push({
            start: _export.end,
            end: _export.end,
            code: `\nObject.assign(exports, _${node.name});`,
          });
        } else {
          this.replacements.push({
            start: _export.end,
            end: _export.end,
            code: `\nexports.${_export.namespace} = _${node.name}`,
          });
        }
      }
    }
  }

  apply() {
    this.collectExports();
    const sorted = this.replacements.sort((a, b) => b.start - a.start);
    for (let replacement of sorted) {
      this.node.code =
        this.node.code.slice(0, replacement.start) +
        replacement.code +
        this.node.code.slice(replacement.end);
    }
  }
}

export default Replacement;
