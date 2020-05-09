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
const contentType = 'ipfs-ns';
const dryrun = (core.getInput('dryRun') === 'true');
const verbose = (core.getInput('verbose') === 'true');

function CNS(options) {
    const { mnemonic, rpc, name, dryrun, verbose } = options;

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

    this.getContenthash = async () => {
        if (verbose) {
            console.log('Getting content...')
        }

        const tokenId = namehash(name);
        const resolverContract = await getResolverContract(tokenId);

        return resolverContract.methods.get(ipfsKey, tokenId)
            .call({ from: provider.addresses[0] });
    }

    this.setContenthash = async ({ contentHash, contentType }) => {
        if (contentType !== 'ipfs-ns') {
            throw new Error('ContentType is not supported. CNS supports only ipfs-ns');
        }

        const tokenId = namehash(name);
        const resolverContract = await getResolverContract(tokenId);

        if (dryrun) {
            return;
        }

        return resolverContract.methods.set(ipfsKey, contentHash, tokenId)
            .send({ from: provider.addresses[0] });
    }
}

async function update(options) {
    const { name, contentHash, contentType, verbose } = options;
    const updater = await CNS(options);

    let current;
    try {
        current = await updater.getContenthash();
        if (current.hash === contentHash) {
            console.log(`Content hash is up to date. [${current.hash}]`);
            return;
        }
    } catch (error) {
        core.warning(error);
    }

    const result = await updater.setContenthash({ contentType, contentHash })
        .catch((err) => { throw err; });
    if (verbose) {
        console.log(`Tx hash ${result}`);
    }

    return result;
}

update({ mnemonic, rpc, name, contentHash, contentType, dryrun, verbose })