import path from "path";
import xanpack from "./functions/xanpack.js";

const main = async () => {
  console.time("build");
  for (let i = 0; i < 1; i++) {
    await xanpack({
      input: path.resolve(process.cwd(), "example/input.tsx"),
      output: {
        dir: path.resolve(process.cwd(), "build"),
        format: "esm",
      },
      transform: {
        define: {
          __DEV__: JSON.stringify(false),
          "process.env.NODE_ENV": JSON.stringify("development"),
        },
      },
    });
  }
  console.timeEnd("build");
};
main();
