#!/usr/bin/env node
const { deploy } = require("./index");
const [,, ...args] = process.argv;

deploy(args[0], args[1], args[2]);
