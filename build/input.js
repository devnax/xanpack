
const __xpack = {
  __module: Object.create(null),
  __cache: Object.create(null),

  module(id, factory) {
    __xpack.__module[id] = factory;
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

const require__Volumes_Work Space_devnax_xanpack_example_input = __mod((module, exports) => {
    import multiply from "./code/multiply";
    export * as u from "./code/multiply";
    console.log(multiply(1, 2));
    require("./code/multiply");
    export const re = () => {
    	return require(`./code/${name}`);
    };
});
    
const require__Volumes_Work Space_devnax_xanpack_example_code_multiply = __mod((module, exports) => {
    export const multiply = (a, b) => {
    	return a * b;
    };
    export default multiply;
});
    
    __xpack.import("/example/input.tsx");
        