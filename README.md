# Web3Q Deployer

## Usage

## Deploy Command
```
w3q-deploy <directory/file> <domain/address> --privateKey <private-key> --network <testnet/galileo>
```

#### Example
```
w3q-deploy dist home --privateKey 0x32... --network galileo
```
```
w3q-deploy index.html 0x1825198B433EbaA9bbb558F72D1A4F2967322388 --privateKey 0x32... --network testnet
```

## Create FlatDirectory Command
```
w3q-deploy --create --privateKey <private-key> --network <testnet/galileo>

// output: contract address 
```

#### Example
```
w3q-deploy --create --privateKey 0x32... --network galileo
```

## Set FlatDirectory Default Entrance
```
w3q-deploy --default --address <domain/address> --file <fileName> --privateKey <private-key> --network <testnet/galileo>

```

#### Example
```
w3q-deploy --default --address home --file index.html --privateKey 0x32... --network testnet
```

### Repo
[Github Repo](https://github.com/QuarkChain/w3q-deployer)
