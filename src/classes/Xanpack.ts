import { XanpackOption } from "../types/Xanpack.js";
import { ModuleGraph } from "./ModuleGraph.js";
import Resolver from "./Resolver.js";

class Xanpack {
  private option: XanpackOption;
  private resolver: Resolver;
  private graph = new ModuleGraph();
  constructor(option: XanpackOption) {
    this.option = option;
    this.resolver = new Resolver(this);
  }

  async buildGraph() {
    await this.graph.build(this.option.input as string);
  }
}
export default Xanpack;
