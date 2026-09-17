export const namedConst = 1;

export const multipleA = 4,
  multipleB = 5;

export { existingValue };

export { anotherValue as renamedValue };

export { existingValue as valueA, anotherValue as valueB };

export function namedFunction() {}

export class NamedClass {}

export default 123;

export const defaultArrow = () => {};

export default function defaultFunction() {}

export default class DefaultClass {}

export { default as ReExportedDefault } from "./default-module";

export { namedValue } from "./named-module";

export { namedValue as renamedNamedValue } from "./named-module";

export { valueA, valueB, valueC as renamedValueC } from "./named-module";

export {
  default as DefaultFromModule,
  namedValue,
  anotherValue as renamedAnotherValue,
} from "./module";

export * from "./all-module";

export * as namespace from "./namespace-module";

export type TypeValue = string;

export interface User {
  id: string;
  name: string;
}

export type UserId = string;

export type { User as UserType };

export type { UserId } from "./types";

export type { User as ImportedUser } from "./types";

export { type User, type UserId };

export { type User as UserType2 };
