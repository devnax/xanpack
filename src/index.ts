import path from "path";
import Xanpack from "./Xanpack.js";

const bundler = new Xanpack({
  input: {
    main: path.resolve(process.cwd(), "example/input.tsx"),
    multiply: path.resolve(process.cwd(), "example/code/multiply.ts"),
  },
  output: {
    dir: "../build",
    format: "esm",
  },
});

bundler.build();
