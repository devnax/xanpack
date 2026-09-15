import multiply from "./code/multiply";

export * as u from "./code/multiply";
console.log(multiply(1, 2));
if (true) {
  require("./code/multiply");
}
export const re = () => {
  if (true) {
    const im = require(`./code/${name}`);
    return im;
  }
};

function test() {
  return multiply(2, 3);
}
