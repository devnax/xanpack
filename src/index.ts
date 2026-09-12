import path from "path";
import xanpack from "./functions/xanpack.js";

const main = async () => {
  console.time("build");
  const xp = await xanpack({
    input: path.resolve(process.cwd(), "example/input.tsx"),
    define: {
      __DEV__: JSON.stringify(false),

      "process.env.NODE_ENV": JSON.stringify("development"),
    },
  });
  console.timeEnd("build");
};
main();
