import Xanpack from "../classes/Xanpack.js";
import { XanpackOption } from "../types/Xanpack.js";

const xanpack = async (option: XanpackOption) => {
  const xp = new Xanpack(option);
  await xp.build();
  return xp;
};

export default xanpack;
