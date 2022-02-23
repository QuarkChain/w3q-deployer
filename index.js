const fs = require('fs');
const { ethers } = require("ethers");
const provider = new ethers.providers.JsonRpcProvider("https://testnet.web3q.io:8545");
const wnsAbi = [
  "function pointerOf(bytes memory name) public view returns (address)",
];
const fileAbi = [
  "function write(bytes memory filename, bytes memory data) public payable"
];
const wnsContract = new ethers.Contract("0x5095135E861845dee965141fEA9061F38C85c699", wnsAbi, provider);
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
      console.log(tx.hash);

    } catch(err) {
      console.error(err.reason);
    }
  });
};

const deploy = async (path, domain, key) => {
  const wallet = new ethers.Wallet(key, provider);
  const name = '0x' + Buffer.from(domain, 'utf8').toString('hex');
  const pointer = await wnsContract.pointerOf(name);
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

module.exports.deploy = deploy;
