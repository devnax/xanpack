const example_input = __xmod((module, exports) => {
const namedConst = 1;
const multipleA = 4, multipleB = 5;
export { existingValue };
export { anotherValue as renamedValue };
export { existingValue as valueA, anotherValue as valueB };
function namedFunction() {}
class NamedClass {}
export default 123;
const defaultArrow = () => {};
export default function defaultFunction() {}
export default class DefaultClass {}
export { default as ReExportedDefault } from "./default-module";
export { namedValue } from "./named-module";
export { namedValue as renamedNamedValue } from "./named-module";
export { valueA, valueB, valueC as renamedValueC } from "./named-module";
export { default as DefaultFromModule, namedValue, anotherValue as renamedAnotherValue } from "./module";
export * from "./all-module";
export * as namespace from "./namespace-module";

})

