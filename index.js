const core = require('@actions/core');
const HDWalletProvider = require('@truffle/hdwallet-provider');
const Web3 = require('web3');


const registryABI = require('./registry.json');
const resolverABI = require('./resolver.json');
const { namehash } = require('./namehash');

const registry = '0xD1E5b0FF1287aA9f9A268759062E4Ab08b9Dacbe';
const ipfsKey = 'ipfs.html.value';


let verbose = false;

function CNS(options) {
    const { mnemonic, rpc, name, dryrun, verbose } = options;

    const provider = new HDWalletProvider(mnemonic, rpc);
    const web3 = new Web3(provider);
    const registryContract = new web3.eth.Contract(registryABI, registry);

    const getResolver = (tokenId) => {

        if (verbose) {
            console.log('HIT getResolver function')
            console.log('Provider: ' + provider)
        }

        return registryContract.methods.resolverOf(tokenId)
            .call({ from: provider.addresses[0] });
    }

    const getResolverContract = async (tokenId) => {

        if (verbose) {
            console.log('HIT getResolverContract function')
            console.log('TokenId: ' + tokenId)
        }

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

    this.getContentHash = async () => {
        if (verbose) {
            console.log('Getting content...')
            console.log('Name: ' + name)
        }

        const tokenId = namehash(name);
        const resolverContract = await getResolverContract(tokenId);

        if (verbose) {
            console.log('TokenId: ' + tokenId)
            console.log('resolverContract: ' + JSON.stringify(resolverContract))
        }
        return resolverContract.methods.get(ipfsKey, tokenId)
            .call({ from: provider.addresses[0] });
    }

    this.setContentHash = async ({ contentHash, contentType }) => {

        if (verbose) {
            console.log('HIT setContentHash function')
        }
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
    // validate(options);

    const { name, contentHash, contentType, verbose } = options;

    if (verbose) {
        console.log('HIT update function')
    }

    // const factory = (options) => { return new CNS(options) };
    const updater = await new CNS(options);

    let current;
    try {
        current = await updater.getContentHash();

        if (verbose) {
            console.log('Current hash: ' + current)
            console.log('Target hash: ' + contentHash)
        }

        if (current.hash === contentHash) {
            console.log(`Content hash is up to date. [${current.hash}]`);
            return;
        }
    } catch (error) {
        core.warning(error);
    }

    const result = await updater.setContentHash({ contentType, contentHash })
        .catch((err) => { throw err; });
    if (verbose) {
        console.log(`Tx hash ${result}`);
    }

    return result;
}

async function run() {
    verbose = (core.getInput('verbose') === 'true');

    if (verbose) {
        console.log('HIT run function')
    }

    try {
        const mnemonic = core.getInput('mnemonic');
        const rpc = core.getInput('rpc');
        const name = core.getInput('crypto-domain');
        const contentHash = core.getInput('hash');
        const contentType = 'ipfs-ns';
        const dryrun = (core.getInput('dryRun') === 'true');

        await update({ mnemonic, rpc, name, contentHash, contentType, dryrun, verbose })
            .catch(error => { throw error });

        if (verbose) {
            // Get the JSON webhook payload for the event that triggered the workflow
            const payload = JSON.stringify(github.context.payload, undefined, 2);
            console.log(`The event payload: ${payload}`);
        }
    } catch (error) {
        core.setFailed(error.message);
        throw error;
    }
}

run()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));