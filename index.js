const core = require('@actions/core');
const HDWalletProvider = require('@truffle/hdwallet-provider');
const Web3 = require('web3');


const registryABI = require('./registry.json');
const resolverABI = require('./resolver.json');
const { namehash } = require('./namehash');

const registry = '0xD1E5b0FF1287aA9f9A268759062E4Ab08b9Dacbe';
const ipfsKey = 'ipfs.html.value';

const mnemonic = core.getInput('mnemonic');
const rpc = core.getInput('rpc');
const name = core.getInput('crypto-domain');
const contentHash = core.getInput('hash');
const dryrun = (core.getInput('dryRun') === 'true');
const verbose = (core.getInput('verbose') === 'true');

const provider = new HDWalletProvider(mnemonic, rpc);
const web3 = new Web3(provider);
const registryContract = new web3.eth.Contract(registryABI, registry);

const getResolver = (tokenId) => {
    return registryContract.methods.resolverOf(tokenId)
        .call({ from: provider.addresses[0] });
}

const getResolverContract = async (tokenId) => {
    let resolver;
    try {
        resolver = await getResolver(tokenId);
    } catch (error) {
        if (verbose) {
            console.error(error);
        }
        throw new Error('Resolver not found');
    }

    return new web3.eth.Contract(resolverABI, resolver);
}

let current;
try {

    if (verbose) {
        console.log('Getting content...')
    }

    const tokenId = namehash(name);
    const resolverContract = getResolverContract(tokenId);

    current =  resolverContract.methods.get(ipfsKey, tokenId)
        .call({ from: provider.addresses[0] });
    if (current.hash === contentHash) {
        console.log(`Content hash is up to date. [${current.hash}]`);
        return;
    }
} catch (error) {
    core.warning(error);
}

const tokenId = namehash(name);
const resolverContract = getResolverContract(tokenId);

if (dryrun) {
    return;
}

const result = resolverContract.methods.set(ipfsKey, contentHash, tokenId)
    .send({ from: provider.addresses[0] });

if (verbose) {
    console.log(`Tx hash ${result}`);
}