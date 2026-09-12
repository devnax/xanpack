

// ==================== ESM IMPORTS ====================

import React from "react" 
/* 
  const require_react = __xpack.import("react")
  const React = require_react.default */

import * as React from "react";
/* 
  const require_react = __xpack.import("react")
  const React = require_react 
*/

import { useState } from "react";
/* 
  const require_react = __xpack.import("react")
  const {useState} = require_react 
*/

import { useState, useEffect } from "react";
/* 
  const require_react = __xpack.import("react")
  const {useState, useEffect} = require_react 
*/


import { useState as state } from "react";
/* 
  const require_react = __xpack.import("react")
  const {useState as state } = require_react 
*/

import React, { useState, useEffect as effect } from "react";
/* 
  const require_react = __xpack.import("react")
  const { default as React, useState, useEffect as effect } = require_react 
*/

import "react";
/* 
  __xpack.import("react")
*/

const React = await import("react");
/* 
  const require_react = await __xpack.importAsync("react")
  const { default as React } = require_react 
*/

import("react").then((React) => {});
/* 
   await __xpack.importAsync("react").then((React) => {});
*/

const module = await import(path);
/* 
  const module = await __xpack.importAsync(path)
*/


// ==================== COMMONJS REQUIRE ====================

const React = require("react");
/* 
  const React = __xpack.import("react")
*/

const foo = require("./foo");
/* 
  const foo = __xpack.import("./foo")
*/

const { useState } = require("react");
/* 
  const {useState} = __xpack.import("react")
*/

const { useState, useEffect } = require("react");
/* 
  const {useState, useEffect} = __xpack.import("react")
*/

const { useState: state } = require("react");
/* 
  const {useState: state} = __xpack.import("react")
*/

const React = require("react").default;
/* 
  const React = __xpack.import("react").default
*/

const useState = require("react").useState;
/* 
  const useState = __xpack.import("react").useState
*/

const foo = require("pkg").foo.bar;
/* 
  const foo = __xpack.import("pkg").foo.bar
*/

require("some-package");
/* 
  __xpack.import("some-package")
*/


const module = condition ? require("react") : null;
/* 
  const module = condition ? __xpack.import("react") : null
*/


function load() {
  return require("react");
}

/* 
function load() {
  return __xpack.importAsync("react")
}
*/


if (condition) {
  const React = require("react");
}
/* 
if (condition) {
  const React = __xpack.importAsync("react")
}
*/

try {
  require("optional-package");
} catch {}

/* 
try {
  await __xpack.importAsync("optional-package");
} catch {}
*/

const module = require(name);
/* 
  const module = __xpack.import(name)
*/


const module = require(`./${name}`);
/* 
  const module = __xpack.import(`./${name}`)
*/

const foo = require("./foo")();
/* 
  const foo = (__xpack.importAsync(`./foo`).then(m => m))()
*/

const foo = new (require("./foo"))();
/* 
  const foo = new (__xpack.import(`./foo`))()
*/

const foo = [require("./a"), require("./b")];
/* 
  const foo = [__xpack.import(`./a`), __xpack.import(`./b`)]
*/

const foo = {
  react: require("react"),
};



const foo = require("foo") || require("bar");


// ==================== ESM EXPORTS ====================

export const foo = 1;
/* 
  exports.foo = 1
*/

export let foo = 1;
/* 
  exports.foo = 1
*/

export var foo = 1;
/* 
  exports.foo = 1
*/

export function foo() {}
/* 
  exports.foo = function () {}
*/

export class Foo {}
/* 
  exports.Foo = class Foo {}
*/

const foo = 1;
export { foo };
/* 
  exports.foo = foo
*/

const foo = 1;
export { foo as bar };
/* 
  exports.bar = foo
*/

export default foo;
/* 
  exports.default = foo
*/

export default function foo() {}
/* 
  exports.default = function foo() {}
*/

export default class Foo {}
/* 
  exports.default = class Foo {}
*/

export { foo } from "./foo";
/* 
  const {foo} = __xpack.import(`./foo`)
  exports.foo = foo
*/

export { foo as bar } from "./foo";
/* 
  const {foo} = __xpack.import(`./foo`)
  exports.bar = foo
*/

export * from "./foo";
/* 
  const foo = __xpack.import(`./foo`)
  exports = {...exports, ...foo}
*/

export * as foo from "./foo";
/* 
  const foo = __xpack.import(`./foo`)
  exports.foo = foo
*/


// ==================== COMMONJS EXPORTS ====================

module.exports = foo;

module.exports = {
  foo,
  bar,
};

exports.foo = foo;

exports.foo = function () {};

module.exports.foo = foo;

module.exports.foo = function () {};

module.exports.foo.bar = value;

exports.foo.bar = value;

module.exports = require("./foo");

exports = module.exports = foo;

