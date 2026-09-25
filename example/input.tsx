import multiply from "./code/multiply";

export { multiply as m, multiply } from "./code/multiply";
export * as name from "./code/multiply";

const result = () => {
  return multiply(2, 3);
};
export const test = multiply;
export default result;
