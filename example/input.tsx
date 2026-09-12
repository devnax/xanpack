import multiply from "./code/multiply";

if (__DEV__) {
  console.log(multiply(2, 2));
  console.log(multiply(2, 2));
}
const foo = __DEV__ ? 1 : 2;
