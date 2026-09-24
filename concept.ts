type Module = {
  exports: Record<string, any>;
};

type Callback = (module: Module, exports: any) => void;

const __require = (callback: Callback | string): Record<string, any> => {
  const module = {
    exports: {},
  };
  if (typeof callback === "string") {
    return import(callback);
  }
  callback(module, module.exports);
  return module.exports;
};

export const require_react = __require((module, exports) => {});

export const require_react_dom = __require((module, exports) => {});

const require_app = __require((module, exports) => {
  const { useState } = require_react;
  const ReactDOM = require_react_dom;
  const dynamic = __require("next/dynamic");
});
