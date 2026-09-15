import Node from "../Node";
import { ParserResult } from "../Parser";

class Replacer {
  Node: Node;
  constructor(Node: Node) {
    this.Node = Node;
  }

  replace(id: string, parsed: ParserResult) {
    return "";
  }

  imports(imports: ParserResult["imports"]) {}
}

export default Replacer;
