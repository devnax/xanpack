const __xpack = {
  __module: Object.create(null),
  __cache: Object.create(null),

  module(id, factory) {
    __xpack.__module[id] = factory;
    __xpack.require(id);
  },
  import: (id) => {
    if (__xpack.__cache[id]) {
      return __xpack.__cache[id].exports;
    }

    const module = {
      exports: {},
    };

    __xpack.__cache[id] = module;
    __xpack.__module[id](module, module.exports);

    return module.exports;
  },
  importAsync: () => {},
};

__xpack.module("react", (module, exports) => {
  // React module
});

__xpack.module("react-dom", (module, exports) => {
  const React = __xpack.require("react");

  // react-dom module
});

__xpack.module("./App.tsx", (module, exports) => {
  const __xpack_require_react = __xpack.import("react");
  const __xpack_require_react_dom = __xpack.import("react-dom");
  const React = __xpack_require_react;
  const useState = __xpack_require_react.useState;
  const ReactDOM = __xpack_require_react_dom;

  const call = async () => {
    const mod = await __xpack.importAsync("./module.js");
  };

  const App = () => {
    const [count, setCount] = useState(0);
    return React.createElement("div", null, "Hello, world! Count: ", count);
  };

  ReactDOM.render(React.createElement(App), document.getElementById("root"));
});
