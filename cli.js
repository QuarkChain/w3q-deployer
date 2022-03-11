#!/usr/bin/env node
const args = require('minimist')(
  process.argv.slice(2),
  {
    string: ['_', 'address', 'privateKey']
  }
);
const { create, refund, deploy, setDefault } = require("./index");

if (args.create) {
  create(args.privateKey);
} else if(args.refund) {
  refund(args.address, args.privateKey);
} else if(args.default) {
  setDefault(args.address, args.file, args.privateKey);
} else {
  if (args.privateKey) {
    deploy(args._[0], args._[1], args.privateKey);
  } else {
    deploy(args._[0], args._[1], args._[2]);
  }
}
