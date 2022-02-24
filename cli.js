#!/usr/bin/env node
const args = require('minimist')(
  process.argv.slice(2),
  {
    string: ['_', 'privateKey']
  }
);
const { create, deploy } = require("./index");

if (args.create) {
  create(args.privateKey);
} else {
  deploy(args._[0], args._[1], args._[2]);
}
