#!/usr/bin/env node
const args = require('minimist')(
  process.argv.slice(2),
  {
    string: ['_', 'address', 'privateKey', 'network']
  }
);
const { create, refund, deploy, setDefault } = require("./index");

if (args.create) {
  create(args.privateKey, args.network);
} else if(args.refund) {
  refund(args.address, args.privateKey, args.network);
} else if(args.default) {
  setDefault(args.address, args.file, args.privateKey, args.network);
} else {
  if (args.privateKey) {
    deploy(args._[0], args._[1], args.privateKey, args.network);
  } else {
    deploy(args._[0], args._[1], args._[2], args._[3]);
  }
}
