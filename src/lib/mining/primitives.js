'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getExpFactorDiff = getExpFactorDiff;
exports.getDiff = getDiff;
exports.createMerkleRoot = createMerkleRoot;
exports.split = split;
exports.dist = dist;
exports.distance = distance;
exports.distanceFromCache = distanceFromCache;
exports.mine = mine;
exports.getParentShareDiff = getParentShareDiff;
exports.getMinimumDifficulty = getMinimumDifficulty;
exports.getNewPreExpDifficulty = getNewPreExpDifficulty;
exports.prepareWork = prepareWork;
exports.getNewBlockCount = getNewBlockCount;
exports.getChildBlockDiff = getChildBlockDiff;
exports.getUniqueHashes = getUniqueHashes;
exports.getUniqueBlocks = getUniqueBlocks;
exports.prepareNewBlock = prepareNewBlock;


const { inspect } = require('util'); /**
                                      * Copyright (c) 2017-present, blockcollider.org developers, All rights reserved.
                                      *
                                      * This source code is licensed under the MIT license found in the
                                      * LICENSE file in the root directory of this source tree.
                                      *
                                      * TODO: Fix flow issues
                                      * 
                                      */

/**
 *    DOCUMENT IN FOUR PARTS
 *
 *      PART 1: Difficulty of the next block [COMPLETE]
 *
 *      PART 2: Mining a block hash [COMPLETE]
 *
 *      PART 3: Blockchain header proofs [IN PROGRESS]
 *
 *      PART 4: Create Block Collider Block Hash  [COMPLETE]
 *
 */

const similarity = require('compute-cosine-similarity');
const BN = require('bn.js');
const Random = require('random-js');
const {
  call,
  compose,
  difference,
  flip,
  groupBy,
  invoker,
  join,
  last,
  map,
  // $FlowFixMe - missing in ramda flow-typed annotation
  partialRight,
  reduce,
  repeat,
  reverse,
  splitEvery,
  toPairs,
  zip,
  zipWith
} = require('ramda');

const { blake2bl } = require('../utils/crypto');
const { concatAll } = require('../utils/ramda');
const { Block, BcBlock, BcTransaction, BlockchainHeader, BlockchainHeaders } = require('../protos/core_pb');
const ts = require('../utils/time').default; // ES6 default export
const GENESIS_DATA = require('../bc/genesis.raw');

const MINIMUM_DIFFICULTY = new BN(290112262029012, 16);
// testnet: 11801972029393
const MAX_TIMEOUT_SECONDS = 300;

const logging = require('../logger');
const logger = logging.getLogger(__filename);

/// /////////////////////////////////////////////////////////////////////
/// ////////////////////////
/// ////////////////////////  PART 1  - Dificulty of the next block
/// ////////////////////////
/// /////////////////////////////////////////////////////////////////////

/**
 * Determines the singularity height and difficulty
 *
 * @param calculatedDifficulty
 * @param parentBlockHeight
 * @returns a
 */
function getExpFactorDiff(calculatedDifficulty, parentBlockHeight) {
  const big1 = new BN(1, 16);
  const big2 = new BN(2, 16);
  const expDiffPeriod = new BN(66000000, 16);

  // periodCount = (parentBlockHeight + 1) / 66000000
  let periodCount = new BN(parentBlockHeight).add(big1);
  periodCount = periodCount.div(expDiffPeriod);

  // if (periodCount > 2)
  if (periodCount.gt(big2) === true) {
    // return calculatedDifficulty + (2 ^ (periodCount - 2))
    let y = periodCount.sub(big2);
    y = big2.pow(y);
    calculatedDifficulty = calculatedDifficulty.add(y);
    return calculatedDifficulty;
  }
  return calculatedDifficulty;
}

/**
 * FUNCTION: getDiff(t)
 *   Gets the difficulty of a given blockchain without singularity calculation
 *
 * @param currentBlockTime
 * @param previousBlockTime
 * @param previousDifficulty
 * @param minimalDifficulty
 * @param newBlockCount
 * @returns
 */
function getDiff(currentBlockTime, previousBlockTime, previousDifficulty, minimalDifficulty, newBlockCount) {
  // https://github.com/ethereum/EIPs/blob/master/EIPS/eip-2.md

  let bigMinimalDifficulty = new BN(minimalDifficulty, 16);

  logger.debug('number of new blocks: ' + newBlockCount);

  const bigPreviousBlockTime = new BN(previousBlockTime);
  const bigPreviousDifficulty = new BN(previousDifficulty);
  const bigCurentBlockTime = new BN(currentBlockTime);
  const bigMinus99 = new BN(-99);
  const big1 = new BN(1);
  const big0 = new BN(0);
  const bigTargetTimeWindow = new BN(8);
  let elapsedTime = bigCurentBlockTime.sub(bigPreviousBlockTime);

  // elapsedTime + ((elapsedTime - 4) * newBlocks)
  const elapsedTimeBonus = elapsedTime.add(elapsedTime.sub(new BN(5)).mul(new BN(newBlockCount)));

  if (elapsedTimeBonus.gt(big0)) {
    elapsedTime = elapsedTimeBonus;
  }

  // x = 1 - floor(x / handicap)
  let x = big1.sub(elapsedTime.div(bigTargetTimeWindow)); // div floors by default
  let y;

  // x < -99 ? -99 : x
  if (x.lt(bigMinus99)) {
    x = bigMinus99;
  }

  // y = bigPreviousDifficulty -> SPECTRUM: 10062600 // AT: 1615520 // BT: (32 * 16) + 20 = 532
  y = bigPreviousDifficulty.div(new BN(532));
  // x = x * y
  x = x.mul(y);
  // x = x + previousDifficulty
  x = x.add(bigPreviousDifficulty);

  // x < minimalDifficulty
  if (x.lt(bigMinimalDifficulty)) {
    return bigMinimalDifficulty;
  }

  return x;
}

function createMerkleRoot(list, prev) {
  if (list.length > 0) {
    if (prev !== undefined) {
      // $FlowFixMe
      prev = blake2bl(prev + list.shift());
    } else {
      prev = blake2bl(list.shift());
    }
    return createMerkleRoot(list, prev);
  }
  // $FlowFixMe
  return prev;
}

/// /////////////////////////////////////////////////////////////////////
/// ////////////////////////
/// ////////////////////////  PART 2 - Mining a Block
/// ////////////////////////
/// /////////////////////////////////////////////////////////////////////

/**
 * The Blake2BL hash of the proof of a block
 */
// const blockProofs = [
//   '9b80fc5cba6238801d745ca139ec639924d27ed004c22609d6d9409f1221b8ce', // BTC
//   '781ff33f4d7d36b3f599d8125fd74ed37e2a1564ddc3f06fb22e1b0bf668a4f7', // ETH
//   'e0f0d5bc8d1fd6d98fc6d1487a2d59b5ed406940cbd33f2f5f065a2594ff4c48', // LSK
//   'ef631e3582896d9eb9c9477fb09bf8d189afd9bae8f5a577c2107fd0760b022e', // WAV
//   'e2d5d4f3536cdfa49953fb4a96aa3b4a64fd40c157f1b3c69fb84b3e1693feb0', // NEO
//   '1f591769bc88e2307d207fc4ee5d519cd3c03e365fa16bf5f63f449b46d6cdef' // EMB (Block Collider)
// ]

/**
 *  Converts characters of string into ASCII codes
 *
 * @returns {Number|Array}
 */
function split(t) {
  return t.split('').map(function (an) {
    return an.charCodeAt(0);
  });
}

/**
 * Converts cosine similary to cos distance
 */
function dist(x, y, clbk) {
  let s;
  if (arguments.length > 2) {
    s = similarity(x, y, clbk);
  } else {
    s = similarity(x, y);
  }
  return s !== null ? 1 - s : s;
}

/**
 * Returns summed distances between two strings broken into of 8 bits
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} cosine distance between two strings
 */
function distance(a, b) {
  const aChunks = reverse(splitEvery(32, split(a)));
  const bChunks = splitEvery(32, split(b));
  const chunks = zip(aChunks, bChunks);

  const value = chunks.reduce(function (all, [a, b]) {
    return all + dist(b, a);
  }, 0);

  // TODO this is the previous implementation - because of
  // ac.pop() we need to reverse(aChunks) to produce same number
  // is that correct or just side-effect?
  // const value = bc.reduce(function (all, bd, i) {
  //   return all + dist(bd, ac.pop())
  // }, 0)
  return Math.floor(value * 1000000000000000); // TODO: Move to safe MATH
}

// this is an implementation of distance that
// allows us to not recalculate the split() and reverse()
// of a every time, since it's constant
function distanceFromCache(aChunks, b) {
  // const aChunks = reverse(splitEvery(32, split(a)))
  const bChunks = split(b);

  const bchunkslength = Math.ceil(bChunks.length / 32);
  let value = 0;
  const len = Math.min(aChunks.length, bchunkslength);
  for (var i = 0; i < len; i++) {
    const theend = Math.min(32 * (i + 1), bChunks.length);
    // logger.info('aChunks: '+aChunks[i]+' '+aChunks[i].length)
    value += dist(bChunks.slice(32 * i, theend), aChunks[i]);
  }

  // const chunks = zip(aChunks, bChunks)
  // const value = chunks.reduce(function (all, [a, b]) {
  //  return all + dist(b, a)
  // }, 0)

  // TODO this is the previous implementation - because of
  // ac.pop() we need to reverse(aChunks) to produce same number
  // is that correct or just side-effect?
  // const value = bc.reduce(function (all, bd, i) {
  //   return all + dist(bd, ac.pop())
  // }, 0)
  return Math.floor(value * 1000000000000000); // TODO: Move to safe MATH
}

/**
 * Finds the mean of the distances from a provided set of hashed header proofs
 *
 * @param {number} currentTimestamp current time reference
 * @param {string} work reference to find distance > `threshold`
 * @param {string} miner Public address to which NRG award for mining the block and transactions will be credited to
 * @param {string} merkleRoot Mekle root of the BC block being mined
 * @param {number} threshold threshold for the result to be valid
 * @param {function} difficultyCalculator function for recalculating difficulty at given timestamp
 * @returns {Object} result containing found `nonce` and `distance` where distance is > `threshold` provided as parameter
 */
// $FlowFixMe will never return anything else then a mining result
function mine(currentTimestamp, work, miner, merkleRoot, threshold, difficultyCalculator) {
  let difficulty = threshold;
  let difficultyBN = new BN(difficulty);
  let result;
  const tsStart = ts.now();
  const maxCalculationEnd = tsStart + MAX_TIMEOUT_SECONDS * 1000;
  let currentLoopTimestamp = currentTimestamp;

  const workChunks = reverse(splitEvery(32, split(work)));

  let iterations = 0;
  let res = null;
  let nowms = 0;
  let now = 0;
  let nonce = String(Math.abs(Random.engines.nativeMath())); // random string
  while (true) {
    iterations += 1;

    // TODO optimize not to count each single loop
    nowms = ts.now();
    now = nowms / 1000 << 0;
    if (maxCalculationEnd < nowms) {
      break;
    }

    if (new BN(result).gt(difficultyBN) === true) {
      res = {
        distance: result.toString(),
        nonce,
        timestamp: currentLoopTimestamp,
        difficulty,
        // NOTE: Following fields are for debug purposes only
        iterations,
        timeDiff: nowms - tsStart
      };
      break;
    }

    // recalculate difficulty each second
    if (difficultyCalculator && currentLoopTimestamp < now) {
      currentLoopTimestamp = now;
      difficulty = difficultyCalculator(now);
      difficultyBN = new BN(difficulty);
      // logger.info(`In timestamp: ${currentLoopTimestamp} recalculated difficulty is: ${difficulty}`)
    }

    nonce = String(Math.abs(Random.engines.nativeMath())); // random string
    const nonceHash = blake2bl(nonce);
    result = distanceFromCache(workChunks, blake2bl(miner + merkleRoot + nonceHash + currentLoopTimestamp));
  }

  logger.info('mining took ' + iterations + ' iterations in ' + res.timeDiff + ' ms!');

  return res;
}

/// /////////////////////////////////////////////////////////////////////
/// ////////////////////////
/// ////////////////////////  PART 3 - Blockchain Header Proofs
/// ////////////////////////
/// /////////////////////////////////////////////////////////////////////

/*
 * It will look like this:
 *
 *      function createBlockProof(blockchainFingerprint, rawBlock, callback)
 *
 * Where the fingerprint for Ethereum is "bbe5c469c469cec1f8c0b01de640df724f3d9053c23b19c6ed1bc6ee0faf5160"
 * as seen in bcnode/src/utils/templates/blockchain_fingerprints.json
 *
 */
const toHexBuffer = partialRight(invoker(2, 'from'), ['hex', Buffer]);
const hash = invoker(0, 'getHash');
const merkleRoot = invoker(0, 'getMerkleRoot');

/**
 * Computes hash form a rovered block header as blake2bl(hash + mekleRoot)
 * @param {BlockchainHeader|Block} block to hash
 * @return {string} hash of the block
 */
const blockHash = compose(blake2bl, join(''), zipWith(call, [hash, merkleRoot]), flip(repeat)(2));

const getChildrenBlocksHashes = exports.getChildrenBlocksHashes = map(blockHash);

// TODO should maintain sort (btc -> eth -> lsk -> neo -> wav)
const blockchainMapToList = exports.blockchainMapToList = headersMap => {
  return Object.keys(headersMap.toObject()).map(listName => {
    const getMethodName = `get${listName[0].toUpperCase()}${listName.slice(1)}`;
    return headersMap[getMethodName]();
  }).reduce((acc, curr) => {
    return acc.concat(curr);
  }, []);
};

const getChildrenRootHash = exports.getChildrenRootHash = reduce((all, blockHash) => {
  return all.xor(new BN(toHexBuffer(blockHash)));
}, new BN(0));

function getParentShareDiff(parentDifficulty, childChainCount) {
  return new BN(parentDifficulty).div(new BN(childChainCount));
}

function getMinimumDifficulty(childChainCount) {
  // Standard deviation 100M cycles divided by the number of chains
  return MINIMUM_DIFFICULTY.div(new BN(childChainCount));
}

// TODO rename arguments to better describe data
function getNewPreExpDifficulty(currentTimestamp, lastPreviousBlock, newBlockCount) {
  const preExpDiff = getDiff(currentTimestamp, lastPreviousBlock.getTimestamp(), lastPreviousBlock.getDifficulty(), MINIMUM_DIFFICULTY, newBlockCount); // Calculate the final pre-singularity difficulty adjustment

  return preExpDiff;
}

/**
 * Return the `work` - string to which the distance is being guessed while mining
 *
 * @param {string} previousBlockHash Hash of last known previously mined BC block
 * @param {BlockchainHeaders} childrenCurrentBlocks Last know rovered blocks from each chain (one of them is the one which triggered mining)
 * @return {string} a hash representing the work
 */
function prepareWork(previousBlockHash, childrenCurrentBlocks) {
  const newChainRoot = getChildrenRootHash(getChildrenBlocksHashes(blockchainMapToList(childrenCurrentBlocks)));
  const work = blake2bl(newChainRoot.xor(new BN(toHexBuffer(previousBlockHash))).toString());

  return work;
}

const copyHeader = (block, confirmations) => {
  const header = new BlockchainHeader();
  header.setBlockchain(block.getBlockchain());
  header.setHash(block.getHash());
  header.setPreviousHash(block.getPreviousHash());
  header.setTimestamp(block.getTimestamp());
  header.setHeight(block.getHeight());
  header.setMerkleRoot(block.getMerkleRoot());
  header.setBlockchainConfirmationsInParentCount(confirmations);
  return header;
};

function prepareChildBlockHeadersMapForGenesis(currentBlockchainHeaders) {
  const newMap = new BlockchainHeaders();
  currentBlockchainHeaders.forEach(header => {
    const blockchainHeader = copyHeader(header, 1);
    const methodNameSet = `set${header.getBlockchain()[0].toUpperCase() + header.getBlockchain().slice(1)}List`; // e.g. setBtcList
    newMap[methodNameSet]([blockchainHeader]);
  });
  return newMap;
}

/**
 * Create a BlockchainHeader{} for new BcBlock, before count new confirmation count for each child block.
 *
 * Assumption here is that confirmation count of all headers from previous block is taken and incrementend by one
 * except for the one which caused the new block being mine - for that case is is reset to 1
 *
 * We're starting from 1 here because it is used for dividing
 *
 * @param {BcBlock} previousBlock Last known previously mined BC block
 * @param {Block} newChildBlock The last rovereed block - this one triggered the mining
 * @param {Block[]} newChildHeaders child headers which were rovered since the previousBlock
 * @return {BlockchainHeader[]} Headers of rovered chains with confirmations count calculated
 */
function prepareChildBlockHeadersMap(previousBlock, newChildBlock, newChildHeaders) {
  const newChildHeadersMap = groupBy(block => block.getBlockchain(), newChildHeaders);

  const keyOrMethodToChain = keyOrMethod => keyOrMethod.replace(/^get|set/, '').replace(/List$/, '').toLowerCase();
  const chainToSet = chain => `set${chain[0].toUpperCase() + chain.slice(1)}List`;
  const chainToGet = chain => `get${chain[0].toUpperCase() + chain.slice(1)}List`;

  logger.debug(`newChildHeadersMap: ${inspect(toPairs(newChildHeadersMap).map(([chain, blocks]) => {
    return 'chain: ' + chain + ' headers ' + inspect(blocks.map(block => copyHeader(block, 1).toObject()));
  }), { depth: 3 })}`);

  const newBlockchainHeaders = new BlockchainHeaders();
  // construct new BlockchainHeaders from newChildHeaders
  toPairs(newChildHeadersMap).forEach(([chain, blocks]) => {
    newBlockchainHeaders[chainToSet(chain)](blocks.map(block => copyHeader(block, 1)));
  });

  // if any list in header is empty take last header from previous block and raise confirmations by 1
  Object.keys(newBlockchainHeaders.toObject()).forEach(listKey => {
    const chain = keyOrMethodToChain(listKey);
    const newlyAssignedBlocks = newBlockchainHeaders[chainToGet(chain)]();
    logger.debug(`headers empty check, with method ${chainToGet(chain)}: ${newlyAssignedBlocks.map(b => b.toObject())}`);
    if (newlyAssignedBlocks.length === 0) {
      const lastHeaderFromPreviousBlock = last(previousBlock.getBlockchainHeaders()[chainToGet(chain)]());
      if (!lastHeaderFromPreviousBlock) {
        throw new Error(`Previous BC block ${previousBlock.getHeight()} does not have any "${chain}" headers`);
      }
      const headerFromPreviousBlock = copyHeader(lastHeaderFromPreviousBlock, lastHeaderFromPreviousBlock.getBlockchainConfirmationsInParentCount() + 1);
      newBlockchainHeaders[chainToSet(chain)]([headerFromPreviousBlock]);
    }
  });

  logger.debug(`prepareChildBlockHeadersMap: previous BC block: ${previousBlock.getHeight()} final headers: ${inspect(Object.values(newBlockchainHeaders.toObject()), { depth: 3 })}`);

  return newBlockchainHeaders;
}

/**
 * How many new child blocks are between previousBlockHeaders and currentBlockHeaders
 */
function getNewBlockCount(previousBlockHeaders, currentBlockHeaders) {
  // $FlowFixMe - protbuf toObject is not typed
  return getChildBlockDiff(previousBlockHeaders, currentBlockHeaders);
  // const headersToHashes = (headers: BlockchainHeaders) => Object.values(currentBlockHeaders.toObject()).reduce((acc, curr) => acc.concat(curr), []).map(headerObj => headerObj.hash)
  // const previousHashes = headersToHashes(previousBlockHeaders)
  // const currentHashes = headersToHashes(currentBlockHeaders)

  // return difference(currentHashes, previousHashes).length
}

/**
 * How many new child blocks are between previousBlockHeaders and currentBlockHeaders
 */
function getChildBlockDiff(previousBlockHeaders, currentBlockHeaders) {
  // $FlowFixMe - protbuf toObject is not typed
  const a = previousBlockHeaders.toObject();
  const b = currentBlockHeaders.toObject();

  return Object.keys(b).reduce((total, key) => {
    const sa = a[key].map(header => {
      return header.hash;
    });
    const sb = b[key].map(header => {
      return header.hash;
    });
    total = total + difference(sa, sb).length;
    return total;
  }, 0);
}

/**
 * How many new child HASHES are between previousBlockHeaders and currentBlockHeaders
 */
function getUniqueHashes(previousBlockHeaders, currentBlockHeaders) {
  // $FlowFixMe - protbuf toObject is not typed
  const headersToHashes = headers => Object.values(previousBlockHeaders.toObject()).reduce((acc, curr) => acc.concat(curr), []).map(headerObj => headerObj.hash);
  const previousHashes = headersToHashes(previousBlockHeaders);
  logger.info('previousHashes: ' + previousHashes);
  const currentHashes = headersToHashes(currentBlockHeaders);
  logger.info('currentHashes: ' + currentHashes);

  return difference(currentHashes, previousHashes);
  // return currentBlockHeaders.filter((b) => {
  //  if (diff.indexOf(b.getHash()) > -1) {
  //    return b
  //  }
  // })
}

/**
 * How many new child blocks are between previousBlockHeaders and currentBlockHeaders
 */
function getUniqueBlocks(previousBlockHeaders, currentBlockHeaders) {
  // $FlowFixMe - protbuf toObject is not typed
  const headersToHashes = headers => Object.values(previousBlockHeaders.toObject()).reduce((acc, curr) => acc.concat(curr), []).map(headerObj => headerObj.hash);
  const previousHashes = headersToHashes(previousBlockHeaders);
  const currentHashes = headersToHashes(currentBlockHeaders);
  const diff = difference(currentHashes, previousHashes);

  const filterToDiff = currentBlockHeaders.filter(b => {
    if (diff.indexOf(b.getHash()) > -1) {
      return b;
    }
  });
  return filterToDiff;
}

/**
 * Used for preparing yet non existant BC block protobuf structure. Use before mining starts.
 *
 * - calculates block difficulty (from previous BC block difficulty and height, rovered chains count, and data in child chains headers) and stores it to structure
 * - stores headers of child chains (those being rovered)
 * - calculates new merkle root, hash and stores it to structure
 * - calculates new block height (previous + 1) and stores it to structure
 *
 * @param {number} currentTimestamp current timestamp reference
 * @param {BcBlock} lastPreviousBlock Last known previously mined BC block
 * @param {Block[]} newChildHeaders Child headers which were rovered since headers in lastPreviousBlock
 * @param {Block} blockWhichTriggeredMining The last rovered block - this one triggered the mining
 * @param {BcTransaction[]} newTransactions Transactions which will be added to newly mined block
 * @param {string} minerAddress Public addres to which NRG award for mining the block and transactions will be credited to
 * @param {BcBlock} unfinishedBlock If miner was running this is the block currently mined
 * @return {BcBlock} Prepared structure of the new BC block, does not contain `nonce` and `distance` which will be filled after successful mining of the block
 */
function prepareNewBlock(currentTimestamp, lastPreviousBlock, newChildHeaders, blockWhichTriggeredMining, newTransactions, minerAddress, unfinishedBlock) {
  let childBlockHeaders;
  if (lastPreviousBlock !== undefined && lastPreviousBlock.getHeight() === GENESIS_DATA.height) {
    childBlockHeaders = prepareChildBlockHeadersMapForGenesis(newChildHeaders);
  } else {
    childBlockHeaders = prepareChildBlockHeadersMap(unfinishedBlock || lastPreviousBlock, blockWhichTriggeredMining, newChildHeaders);
  }
  const blockHashes = getChildrenBlocksHashes(blockchainMapToList(childBlockHeaders));
  const newChainRoot = getChildrenRootHash(blockHashes);
  const newBlockCount = getNewBlockCount(lastPreviousBlock.getBlockchainHeaders(), childBlockHeaders);
  // const newBlockCount = getUniqueBlocks(lastPreviousBlock.getBlockchainHeaders(), childBlockHeaders).length

  const preExpDiff = getNewPreExpDifficulty(currentTimestamp, lastPreviousBlock, newBlockCount);
  const finalDifficulty = getExpFactorDiff(preExpDiff, lastPreviousBlock.getHeight()).toString();

  const newHeight = lastPreviousBlock.getHeight() + 1;
  // blockchains, transactions, miner address, height
  // TODO add EMB data to merkleRoot AT
  const newMerkleRoot = createMerkleRoot(concatAll([blockHashes, newTransactions, [finalDifficulty, minerAddress, newHeight, GENESIS_DATA.version, GENESIS_DATA.schemaVersion, GENESIS_DATA.nrgGrant, GENESIS_DATA.blockchainFingerprintsRoot]]));

  let chainWeight = 0;
  if (new BN(lastPreviousBlock.getHeight()).gt(2) === true) {
    chainWeight = new BN(lastPreviousBlock.getDistance()).sub(new BN(lastPreviousBlock.getDifficulty())).divRound(new BN(4)).toString();
  }

  const newBlock = new BcBlock();
  newBlock.setHash(blake2bl(lastPreviousBlock.getHash() + newMerkleRoot));
  newBlock.setPreviousHash(lastPreviousBlock.getHash());
  newBlock.setVersion(1);
  newBlock.setSchemaVersion(1);
  newBlock.setHeight(newHeight);
  newBlock.setMiner(minerAddress);
  newBlock.setDifficulty(finalDifficulty);
  newBlock.setMerkleRoot(newMerkleRoot);
  newBlock.setChainRoot(blake2bl(newChainRoot.toString()));
  newBlock.setDistance(chainWeight); // is set to proper value after successful mining
  newBlock.setTotalDistance(lastPreviousBlock.getTotalDistance()); // distance from mining solution will be added to this after mining
  newBlock.setNrgGrant(GENESIS_DATA.nrgGrant);
  newBlock.setTargetHash(GENESIS_DATA.targetHash);
  newBlock.setTargetHeight(GENESIS_DATA.targetHeight);
  newBlock.setTargetMiner(GENESIS_DATA.targetMiner);
  newBlock.setTargetSignature(GENESIS_DATA.targetSignature);
  newBlock.setTwn(GENESIS_DATA.twn); // Overline
  newBlock.setTwsList(GENESIS_DATA.twsList); // Overline
  newBlock.setEmblemWeight(GENESIS_DATA.emblemWeight);
  newBlock.setEmblemChainBlockHash(GENESIS_DATA.emblemChainBlockHash);
  newBlock.setEmblemChainFingerprintRoot(GENESIS_DATA.emblemChainFingerprintRoot);
  newBlock.setEmblemChainAddress(GENESIS_DATA.emblemChainAddress);
  newBlock.setTxCount(0);
  newBlock.setTxsList(newTransactions);
  newBlock.setBlockchainHeadersCount(newChildHeaders.length);
  newBlock.setBlockchainFingerprintsRoot(GENESIS_DATA.blockchainFingerprintsRoot);
  newBlock.setTxFeeBase(GENESIS_DATA.txFeeBase);
  newBlock.setTxDistanceSumLimit(GENESIS_DATA.txDistanceSumLimit);
  newBlock.setBlockchainHeaders(childBlockHeaders);

  return [newBlock, currentTimestamp];
}
//# sourceMappingURL=primitives.js.map