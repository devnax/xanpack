import path from "path";
import xanpack from "./functions/xanpack.js";

const main = async () => {
  const xp = await xanpack({
    input: path.resolve(process.cwd(), "example/input.ts"),
  });
};
main();
