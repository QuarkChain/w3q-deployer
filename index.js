const fs = require('fs');
const { ethers } = require("ethers");
const { normalize } = require('eth-ens-namehash');
const sha3 = require('js-sha3').keccak_256;
const JTPool = require('./JTPool');
const Web3 = require('web3');

var color = require('colors-cli/safe')
var error = color.red.bold;
var notice = color.blue;

const wnsAbi = [
  "function pointerOf(bytes memory name) public view returns (address)",
  "function resolver(bytes32 node) public view returns (address)",
];
const resolverAbi = [
  "function webHandler(bytes32 node) external view returns (address)",
];
const fileAbi = [
  "function write(bytes memory filename, bytes memory data) public payable",
  "function writeChunk(bytes memory name, uint256 chunkId, bytes memory data) public payable",
  "function files(bytes memory filename) public view returns (bytes memory)",
  "function setDefault(bytes memory _defaultFile) public",
  "function refund() public",
  "function remove(bytes memory name) external returns (uint256)",
  "function countChunks(bytes memory name) external view returns (uint256)",
  "function getChunkHash(bytes memory name, uint256 chunkId) public view returns (bytes32)"
];
const factoryAbi = [
  "event FlatDirectoryCreated(address)",
  "function create() public returns (address)"
];

const MAINNET_NETWORK = "mainnet";
const TESTNET_NETWORK = "testnet";
const DEVNET_NETWORK = "devnet";
const GALILEO_NETWORK = "galileo";

const MAINNET_CHAIN_ID = 333;
const TESTNET_CHAIN_ID = 3333;
const DEVNET_CHAIN_ID = 1337;
const GALILEO_CHAIN_ID = 3334;

const PROVIDER_URLS = {
  [MAINNET_CHAIN_ID]: '',
  [TESTNET_CHAIN_ID]: 'https://testnet.web3q.io:8545',
  [DEVNET_CHAIN_ID]: 'http://localhost:8545',
  [GALILEO_CHAIN_ID]: 'https://galileo.web3q.io:8545',
}
const W3NS_ADDRESS = {
  [MAINNET_CHAIN_ID]: '',
  [TESTNET_CHAIN_ID]: '0x5095135E861845dee965141fEA9061F38C85c699',
  [DEVNET_CHAIN_ID]: '',
  [GALILEO_CHAIN_ID]: '0xD379B91ac6a93AF106802EB076d16A54E3519CED',
}
const FACTORY_ADDRESS = {
  [MAINNET_CHAIN_ID]: '',
  [TESTNET_CHAIN_ID]: '0x7906895532c9Fc4D423f3d5E78672CAd3EB44F91',
  [DEVNET_CHAIN_ID]: '',
  [GALILEO_CHAIN_ID]: '0x67384A0B6e13CeA90150Bf958F2B13929C429CC5',
}

const REMOVE_FAIL = -1;
const REMOVE_NORMAL = 0;
const REMOVE_SUCCESS = 1;

const STORAGE_SLOT_CODE1 = "0x6080604052348015600f57600080fd5b506004361060325760003560e01c80632b68b9c61460375780638da5cb5b14603f575b600080fd5b603d6081565b005b60657f000000000000000000000000";
const STORAGE_SLOT_CODE2 = "81565b6040516001600160a01b03909116815260200160405180910390f35b336001600160a01b037f000000000000000000000000";
const STORAGE_SLOT_CODE3 = "161460ed5760405162461bcd60e51b815260206004820152600e60248201526d3737ba10333937b69037bbb732b960911b604482015260640160405180910390fd5b33fffea2646970667358221220fc66c9afb7cb2f6209ae28167cf26c6c06f86a82cbe3c56de99027979389a1be64736f6c63430008070033";

let web3;
let slotHeader;

let pools;
let failPool;
let totalCost, totalFileCount, totalFileSize;
let nonce;

function namehash(inputName) {
  let node = ''
  for (let i = 0; i < 32; i++) {
    node += '00'
  }

  if (inputName) {
    const labels = inputName.split('.');
    for (let i = labels.length - 1; i >= 0; i--) {
      let normalisedLabel = normalize(labels[i])
      let labelSha = sha3(normalisedLabel)
      node = sha3(Buffer.from(node + labelSha, 'hex'))
    }
  }

  return '0x' + node
}

function getNetWorkId(network) {
  let chainId = GALILEO_CHAIN_ID;
  if (network === MAINNET_NETWORK) {
    chainId = MAINNET_CHAIN_ID;
  } else if (network === TESTNET_NETWORK) {
    chainId = TESTNET_CHAIN_ID;
  } else if (network == DEVNET_NETWORK) {
    chainId = DEVNET_CHAIN_ID;
  }
  return chainId;
}

async function getWebHandler(domain, network, chainId, provider) {
  const ethAddrReg = /^0x[0-9a-fA-F]{40}$/;
  let webHandler;
  if (ethAddrReg.test(domain)) {
    webHandler = domain;
  } else if (network === TESTNET_NETWORK) {
    const name = '0x' + Buffer.from(domain, 'utf8').toString('hex');
    const wnsContract = new ethers.Contract(W3NS_ADDRESS[chainId], wnsAbi, provider);
    webHandler = await wnsContract.pointerOf(name);
  } else {
    const nameHash = namehash(domain + ".w3q");
    const wnsContract = new ethers.Contract(W3NS_ADDRESS[chainId], wnsAbi, provider);
    const resolver = await wnsContract.resolver(nameHash);
    const resolverContract = new ethers.Contract(resolver, resolverAbi, provider);
    webHandler = await resolverContract.webHandler(nameHash);
  }
  return webHandler;
}

const recursiveUpload = (path, basePath) => {
  const files = fs.readdirSync(path);
  for (let file of files) {
    const fileStat = fs.statSync(`${path}/${file}`);
    if (fileStat.isDirectory()) {
      recursiveUpload(`${path}/${file}`, `${basePath}${file}/`);
    } else {
      pools.push({path: `${path}/${file}`, name: `${basePath}${file}`, size: fileStat.size});
    }
  }
};

const uploadFile = async (provider, file, fileName, fileSize, fileContract) => {
  const clearState = await clearOldFile(provider, fileName, fileSize, fileContract);
  if (clearState === REMOVE_FAIL) {
    failPool.push(fileName);
    return;
  }

  const hexName = '0x' + Buffer.from(fileName, 'ascii').toString('hex');
  const content = fs.readFileSync(file);
  // Data need to be sliced if file > 475K
  if (fileSize > 475 * 1024) {
    const chunkSize = Math.ceil(fileSize / (475 * 1024));
    const chunks = bufferChunk(content, chunkSize);
    fileSize = fileSize / chunkSize;
    for (const index in chunks) {
      const chunk = chunks[index];

      let cost = 0;
      if (fileSize > 24 * 1024 - 326) {
        cost = Math.floor((fileSize + 326) / 1024 / 24);
      }

      const hexData = '0x' + chunk.toString('hex');
      if (clearState === REMOVE_NORMAL) {
        const slotLocalHash = '0x' + sha3(chunk);
        const contentBytecode = slotHeader + chunk.toString('hex');
        const localHash = web3.utils.keccak256(contentBytecode);
        const hash = await fileContract.getChunkHash(hexName, index);
        if (localHash === hash || slotLocalHash === hash) {
          console.log(`File ${fileName} chunkId: ${index}: The data is not changed.`);
          continue;
        }
      }

      // file is remove or change
      const estimatedGas = await fileContract.estimateGas.writeChunk(hexName, index, hexData, {
        value: ethers.utils.parseEther(cost.toString())
      });
      const tx = await fileContract.writeChunk(hexName, index, hexData, {
        nonce: nonce++,
        gasLimit: estimatedGas.mul(6).div(5).toString(),
        value: ethers.utils.parseEther(cost.toString())
      });
      console.log(`${fileName}, chunkId: ${index}`);
      console.log(`Transaction Id: ${tx.hash}`);
      let txReceipt;
      while (!txReceipt) {
        txReceipt = await isTransactionMined(provider, tx.hash);
        await sleep(5000);
      }
      if (txReceipt.status) {
        console.log(`File ${fileName} chunkId: ${index} uploaded!`);
        totalCost += cost;
        totalFileCount++;
        totalFileSize += fileSize / 1024;
      } else {
        failPool.push(fileName + "_chunkId:" + index);
      }
    }
  } else {
    let cost = 0;
    if (fileSize > 24 * 1024 - 326) {
      cost = Math.floor((fileSize + 326) / 1024 / 24);
    }

    const hexData = '0x' + content.toString('hex');
    if (clearState === REMOVE_NORMAL) {
      const slotLocalHash = '0x' + sha3(content);
      const contentBytecode = slotHeader + content.toString('hex');
      const localHash = web3.utils.keccak256(contentBytecode);
      const hash = await fileContract.getChunkHash(hexName, 0);
      if (slotLocalHash === hash || localHash === hash) {
        console.log(`${fileName}: The data is not changed.`);
        return;
      }
    }

    // file is remove or change
    const estimatedGas = await fileContract.estimateGas.write(hexName, hexData, {
      value: ethers.utils.parseEther(cost.toString())
    });
    const tx = await fileContract.write(hexName, hexData, {
      nonce: nonce++,
      gasLimit: estimatedGas.mul(6).div(5).toString(),
      value: ethers.utils.parseEther(cost.toString())
    });
    console.log(fileName);
    console.log(`Transaction Id: ${tx.hash}`);
    let txReceipt;
    while (!txReceipt) {
      txReceipt = await isTransactionMined(provider, tx.hash);
      await sleep(5000);
    }
    if (txReceipt.status) {
      console.log(`File ${fileName} uploaded!`);
      totalCost += cost;
      totalFileCount++;
      totalFileSize += fileSize / 1024;
    } else {
      failPool.push(fileName);
    }
  }
};

const clearOldFile = async (provider, fileName, fileSize, fileContract) =>{
  let newChunkSize = 1;
  if (fileSize > 475 * 1024) {
    newChunkSize = Math.ceil(fileSize / (475 * 1024));
  }
  let oldChunkSize = 0;
  const hexName = '0x' + Buffer.from(fileName, 'ascii').toString('hex');
  try {
    oldChunkSize = await fileContract.countChunks(hexName);
  } catch (err) {
    // Don't get old size
    return REMOVE_FAIL;
  }

  if (oldChunkSize > newChunkSize) {
    // remove
    const tx = await fileContract.remove(hexName, {nonce: nonce++});
    console.log(`Remove file: ${fileName}`);
    console.log(`Transaction Id: ${tx.hash}`);
    let txReceipt;
    while (!txReceipt) {
      txReceipt = await isTransactionMined(provider, tx.hash);
      await sleep(5000);
    }
    if (txReceipt.status) {
      console.log(`File ${fileName} removed!`);
      return REMOVE_SUCCESS;
    } else {
      return REMOVE_FAIL;
    }
  }

  return REMOVE_NORMAL;
}

const deploy = async (path, domain, key, network) => {
  const chainId = getNetWorkId(network);
  const provider = new ethers.providers.JsonRpcProvider(PROVIDER_URLS[chainId]);
  const wallet = new ethers.Wallet(key, provider);
  const pointer = await getWebHandler(domain, network, chainId, provider);

  if (parseInt(pointer) > 0) {
    web3 = new Web3(PROVIDER_URLS[chainId]);
    slotHeader = STORAGE_SLOT_CODE1 + pointer.toLowerCase().slice(2) + STORAGE_SLOT_CODE2 + pointer.toLowerCase().slice(2) + STORAGE_SLOT_CODE3;
    nonce = await wallet.getTransactionCount("pending");
    const fileContract = new ethers.Contract(pointer, fileAbi, wallet);
    const fileStat = fs.statSync(path);
    if (fileStat.isFile()) {
      try {
        await uploadFile(provider, path, path, fileStat.size, fileContract);
      } catch (e){
        console.error(`ERROR: ${path} uploaded failed.`);
      }
      return;
    }

    pools = [];
    failPool = [];
    totalCost = 0;
    totalFileCount = 0;
    totalFileSize = 0;
    recursiveUpload(path, '');
    const pool = new JTPool(20);
    for(let file of pools){
      pool.addTask(async function (callback) {
        try {
          await uploadFile(provider, file.path, file.name, file.size, fileContract);
        } catch (e){
          failPool.push(file.name);
        }
        callback();
      });
    }
    pool.finish(function (){
      // console error
      if(failPool.length > 0){
        console.log("-----------------------------------");
        console.log("--------------Fail-----------------");
        console.log("-----------------------------------");
        for(const file of failPool){
          console.log(error(`ERROR: ${file} uploaded failed.`));
        }
      }

      console.log();
      console.log(notice(`Total Cost: ${totalCost} W3Q.`));
      console.log(notice(`Total File Count: ${totalFileCount}`));
      console.log(notice(`Total File Size: ${totalFileSize} KB`));
    });
    pool.start();
  } else {
    console.log(error(`ERROR: ${domain}.w3q doesn't exist`));
  }
};

const isTransactionMined = async (provider, transactionHash) => {
  const txReceipt = await provider.getTransactionReceipt(transactionHash);
  if (txReceipt && txReceipt.blockNumber) {
    return txReceipt;
  }
}

const sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const bufferChunk = (buffer, chunkSize) => {
  let i = 0;
  let result = [];
  const len = buffer.length;
  const chunkLength = Math.ceil(len / chunkSize);
  while (i < len) {
    result.push(buffer.slice(i, i += chunkLength));
  }

  return result;
}

const createDirectory = async (key, network) => {
  const chainId = getNetWorkId(network);
  const provider = new ethers.providers.JsonRpcProvider(PROVIDER_URLS[chainId]);
  const wallet = new ethers.Wallet(key, provider);
  const factoryContract = new ethers.Contract(FACTORY_ADDRESS[chainId], factoryAbi, wallet);
  const tx = await factoryContract.create();
  console.log(`Transaction: ${tx.hash}`);
  let txReceipt;
  while (!txReceipt) {
    txReceipt = await isTransactionMined(provider, tx.hash);
    await sleep(5000);
  }
  if (txReceipt.status) {
    let iface = new ethers.utils.Interface(factoryAbi);
    let log = iface.parseLog(txReceipt.logs[0]);
    console.log(`FlatDirectory Address: ${log.args[0]}`);
  } else {
    console.error(`ERROR: transaction failed!`);
  }
};

const refund = async (domain, key, network) => {
  const chainId = getNetWorkId(network);
  const provider = new ethers.providers.JsonRpcProvider(PROVIDER_URLS[chainId]);
  const wallet = new ethers.Wallet(key, provider);
  const pointer = await getWebHandler(domain, network, chainId, provider);

  if (parseInt(pointer) > 0) {
    const fileContract = new ethers.Contract(pointer, fileAbi, wallet);
    const tx = await fileContract.refund();
    console.log(`Transaction: ${tx.hash}`);
    let txReceipt;
    while (!txReceipt) {
      txReceipt = await isTransactionMined(provider, tx.hash);
      await sleep(5000);
    }
    if (txReceipt.status) {
      console.log(`Refund succeeds`);
    } else {
      console.error(`ERROR: transaction failed!`);
    }
  } else {
    console.log(`ERROR: ${domain}.w3q doesn't exist`);
  }
};

const setDefault = async (domain, filename, key, network) => {
  const chainId = getNetWorkId(network);
  const provider = new ethers.providers.JsonRpcProvider(PROVIDER_URLS[chainId]);
  const wallet = new ethers.Wallet(key, provider);
  const pointer = await getWebHandler(domain, network, chainId, provider);
  if (parseInt(pointer) > 0) {
    const fileContract = new ethers.Contract(pointer, fileAbi, wallet);
    const defaultFile = '0x' + Buffer.from(filename, 'utf8').toString('hex');
    const tx = await fileContract.setDefault(defaultFile);
    console.log(`Transaction: ${tx.hash}`);
    let txReceipt;
    while (!txReceipt) {
      txReceipt = await isTransactionMined(provider, tx.hash);
      await sleep(5000);
    }
    if (txReceipt.status) {
      console.log(`Set succeeds`);
    } else {
      console.error(`ERROR: transaction failed!`);
    }
  } else {
    console.log(`ERROR: ${domain}.w3q doesn't exist`);
  }
};

module.exports.deploy = deploy;
module.exports.create = createDirectory;
module.exports.refund = refund;
module.exports.setDefault = setDefault;
