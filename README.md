# Web3Q Deployer

## Installation
```
npm install w3q-deployer
```

## Usage

### Deploy Command
```
w3q-deploy <directory/file> <domain/address> --privateKey <private-key> --network <testnet/galileo>
```

##### Example
```
w3q-deploy dist home --privateKey 0x32... --network galileo
```
```
w3q-deploy index.html 0x1825...2388 --privateKey 0x32... --network testnet
```

### Create FlatDirectory Command
```
w3q-deploy --create --privateKey <private-key> --network <testnet/galileo>

// output: contract address 
```

##### Example
```
w3q-deploy --create --privateKey 0x32... --network galileo
```

### Set FlatDirectory Default Entrance
```
w3q-deploy --default --address <domain/address> --file <fileName> --privateKey <private-key> --network <testnet/galileo>

```

##### Example
```
w3q-deploy --default --address home --file index.html --privateKey 0x32... --network testnet
```


### Support Eip3770 Address
```
mainnet 
    w3q:address

galileo
    w3q-g:address
```

##### Example
```
mainnet
    w3q-deploy dist w3q:home --privateKey 0x32...

galileo
    w3q-deploy dist w3q-g:0x1825...2388 --privateKey 0x32...
```

### Repo
[Github Repo](https://github.com/QuarkChain/w3q-deployer)
