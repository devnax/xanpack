import path from "path";
import Xanpack from "./Xanpack.js";

const bundler = new Xanpack({
  input: path.resolve(process.cwd(), "example/input.tsx"),
  output: {
    dir: "../build",
    format: "esm",
  },
});

bundler.build();
