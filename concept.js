const __xmods = Object.create(null);

const __require = (source) => {
  if (typeof __xmods[source] === "function") {
    return __xmods[source]();
  }
  if (source in __xmods) {
    return __xmods[source].exports;
  }
  return import(source);
};

const __xmod = (source, callback) => {
  if (!(source in __xmods)) {
    __xmods[source] = () => {
      const module = { exports: {} };
      callback(module, module.exports);
      __xmods[source] = module;
      return module.exports;
    };
  }

  return () => __require(source);
};

const require_react = __xmod("react", (module, exports) => {
  const dom = require_react_dom();
  console.log("dom", dom);
});

const require_react_dom = __xmod("react-dom", (module, exports) => {
  exports.name = "React dom";
});

const require_app = __xmod("app", (module, exports) => {
  const React = require_react();
  const ReactDOM = require_react_dom();
});

const app = __require("app");
const Name = app.name;
export { Name };
export default app;
