import ParseFile from "../classes/ParseFile";

export type XanpackInput = string | Record<string, any>;
export type Defines = Record<string, string>;

export type XanpackOption = {
  input: XanpackInput;
  define?: Defines;
};

export type XanpackNodes = Map<string, ParseFile>;
