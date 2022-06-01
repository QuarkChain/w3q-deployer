# Web3Q Deployer

## Installation
```
npm install w3q-deployer
```

## Usage

### Support Eip3770 Address
```
mainnet 
    w3q:<domain/address>

galileo
    w3q-g:<domain/address>

ethereum
    eth:<domain/address>

rinkeby
    rin:<domain/address>
```

##### Example
```
mainnet
    w3q:home.w3q

galileo
    w3q-g:0x1825...2388

ethereum
    eth:ens.eth

rinkeby
    rin:0x1825...2388
```


### Deploy Command
```
w3q-deploy <directory/file> <domain/address> --privateKey <private-key>
```

##### Example
```
w3q-deploy dist w3q-g:home.w3q --privateKey 0x32...

w3q-deploy index.html eth:0x1825...2388 --privateKey 0x32...
```



### Create FlatDirectory Command
```
w3q-deploy --create --privateKey <private-key>

// output: contract address 
```

##### Example
```
w3q-deploy --create --privateKey 0x32...
```



### Set FlatDirectory Default Entrance
```
w3q-deploy --default --address <domain/address> --file <fileName> --privateKey <private-key>

```

##### Example
```
w3q-deploy --default --address w3q-g:home.w3q --file index.html --privateKey 0x32...
```


### Repo
[Github Repo](https://github.com/QuarkChain/w3q-deployer)
