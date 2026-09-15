import Node from "../Node";

class Replacer {
  Node: Node;
  constructor(Node: Node) {
    this.Node = Node;
  }

  replace(id: string, node: any) {
    return "";
  }
}

export default Replacer;
