import Node from "../Node";

class Transformar {
  Node: Node;
  constructor(Node: Node) {
    this.Node = Node;
  }

  async transform(id: string, code: string) {
    return "";
  }
}

export default Transformar;
