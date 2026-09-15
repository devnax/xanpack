import React, { useState } from "react";
import JsxRuntime from "react/jsx-runtime";
// import ReactDOM from "react-dom";
// import { createRoot } from "react-dom/client";
// import multiply from "./code/multiply";

// export * as u from "./code/multiply";

export const App = () => {
  // const [count, setCount] = useState(0);
  return <div>Hello World {count}</div>;
};
export const re = () => {
  if (true) {
    const im = import(`./code/${name}`);
    return im;
  }
};

function test() {
  return multiply(2, 3);
}
