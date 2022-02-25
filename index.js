const fs = require('fs');
const { ethers } = require("ethers");
const provider = new ethers.providers.JsonRpcProvider("https://testnet.web3q.io:8545");
const wnsAbi = [
  "function pointerOf(bytes memory name) public view returns (address)",
];
const fileAbi = [
  "function write(bytes memory filename, bytes memory data) public payable",
  "function writeChunk(bytes memory name, uint256 chunkId, bytes memory data) public payable",
  "function readChunk(bytes memory name, uint256 chunkId) public view returns (bytes memory, bool)"
];
const factoryAbi = [
  "event FlatDirectoryCreated(address)",
  "function create() public returns (address)"
];
const WNS_ADDRESS = "0x5095135E861845dee965141fEA9061F38C85c699";
const FACTORY_ADDRESS = "0x7906895532c9Fc4D423f3d5E78672CAd3EB44F91";
const wnsContract = new ethers.Contract(WNS_ADDRESS, wnsAbi, provider);
let nonce;
let wallet;

const recursiveUpload = (path, basePath, fileContract) => {
  fs.readdir(path, (err, files) => {
    files.forEach(file => {
      fs.stat(`${path}/${file}`, (err, fileStat) => {
        if (err) {
          console.log(err);
          return;
        }
        if(fileStat.isFile()) {
          uploadFile(`${path}/${file}`, `${basePath}${file}`, fileStat.size, fileContract);
        }
        if(fileStat.isDirectory()) {
          recursiveUpload(`${path}/${file}`, `${basePath}${file}/`, fileContract);
        }
      });
    });
  });
};

const uploadFile = (file, fileName, fileSize, fileContract) => {
  fs.readFile(file, async function(err, content) {
    if (err) {
      console.log(err);
      return;
    }
    // Data need to be sliced if file > 500K
    if (fileSize > 500 * 1024) {
      const chunkSize = Math.ceil(fileSize / (500 * 1024));
      const chunks = bufferChunk(content, chunkSize);
      fileSize = fileSize / chunkSize;
      chunks.forEach(async (chunk, index) => {
        let cost = 0;
        if(fileSize > 24 * 1024) {
          cost  = fileSize / 1024 / 24;
        }

        const hexName = '0x' + Buffer.from(fileName, 'ascii').toString('hex');
        const hexData = '0x' + chunk.toString('hex');
        const options = {
          nonce: nonce++,
          gasLimit: 30000000,
          value: ethers.utils.parseEther(cost.toString())
        };
        try {
          const tx = await fileContract.writeChunk(hexName, index, hexData, options);
          console.log(`File: ${fileName}, chunkId: ${index}`);
          console.log(`Transaction Id: ${tx.hash}`);
          let txReceipt;
          while(!txReceipt) {
            txReceipt = await isTransactionMined(tx.hash);
            await sleep(5000);
          }
          if (txReceipt.status) {
            console.log(`File ${fileName} chunkId: ${index} uploaded!`);
          } else {
            console.error(`Transaction failed. Please check if the caller is the ower of the contract.`);
          }
        } catch(err) {
          console.error(err.reason);
        }
      });
    } else {
      let cost = 0;
      if(fileSize > 24 * 1024) {
        cost  = fileSize / 1024 / 24;
      }

      const hexName = '0x' + Buffer.from(fileName, 'ascii').toString('hex');
      const hexData = '0x' + content.toString('hex');
      const options = {
        nonce: nonce++,
        gasLimit: 30000000,
        value: ethers.utils.parseEther(cost.toString())
      };
      try {
        const tx = await fileContract.write(hexName, hexData, options);
        console.log(fileName);
        console.log(`Transaction Id: ${tx.hash}`);
        let txReceipt;
        while(!txReceipt) {
          txReceipt = await isTransactionMined(tx.hash);
          await sleep(5000);
        }
        if (txReceipt.status) {
          console.log(`File ${fileName} uploaded!`);
        } else {
          console.error(`Transaction failed. Please check if the caller is the ower of the contract.`);
        }
      } catch(err) {
        console.error(err.reason);
      }
    }
  });
};

const deploy = async (path, domain, key) => {
  const wallet = new ethers.Wallet(key, provider);
  const ethAddrReg = /^0x[0-9a-fA-F]{40}$/;

  let pointer;
  if (ethAddrReg.test(domain)) {
    pointer = domain;
  } else {
    const name = '0x' + Buffer.from(domain, 'utf8').toString('hex');
    pointer = await wnsContract.pointerOf(name);
  }
  if (parseInt(pointer) > 0) {
    nonce = await wallet.getTransactionCount("pending");
    const fileContract = new ethers.Contract(pointer, fileAbi, wallet);
    fs.stat(path, (err, fileStat) => {
      if(fileStat.isDirectory()) {
        recursiveUpload(path, '', fileContract);
      }
      if(fileStat.isFile()) {
        uploadFile(path, path, fileStat.size, fileContract);
      }
    });
  } else {
    console.log(`${domain}.w3q doesn't exist`);
  }
};

const isTransactionMined = async (transactionHash) => {
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

const createDirectory = async (key) => {
  const wallet = new ethers.Wallet(key, provider);
  const factoryContract = new ethers.Contract(FACTORY_ADDRESS, factoryAbi, wallet);
  const tx = await factoryContract.create();
  console.log(`Transaction: ${ tx.hash }`);
  let txReceipt;
  while(!txReceipt) {
    txReceipt = await isTransactionMined(tx.hash);
    await sleep(5000);
  }
  if (txReceipt.status) {
    let iface = new ethers.utils.Interface(factoryAbi);
    let log = iface.parseLog(txReceipt.logs[0]); 
    console.log(`FlatDirectory Address: ${log.args[0]}`);
  } else {
    console.error(`Transaction Failed!`);
  }
};

module.exports.deploy = deploy;
module.exports.create = createDirectory;
