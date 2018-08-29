'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

const { inspect } = require('util'); /**
                                      * Copyright (c) 2017-present, blockcollider.org developers, All rights reserved.
                                      *
                                      * This source code is licensed under the MIT license found in the
                                      * LICENSE file in the root directory of this source tree.
                                      *
                                      * 
                                      */

const LRUCache = require('lru-cache');
// Depcricated library const lisk = require('lisk-js')
const lisk = require('lisk-elements');

const { Block } = require('../../protos/core_pb');
const logging = require('../../logger');
const { errToString } = require('../../helper/error');
const { RpcClient } = require('../../rpc');
const { blake2b } = require('../../utils/crypto');
const { createUnifiedBlock } = require('../helper');

let skip = [];

// type LiskBlock = { // eslint-disable-line no-undef
//  id: string,
//  height: number,
//  previousBlock: string,
//  transactions: Object[],
//  totalFee: number,
//  payloadHash: string,
//  payloadLength: number,
//  generatorId: string,
//  generatorPublicKey: string,
//  blockSignature: string,
//  confirmations: number,
//  totalForged: number,
//  timestamp: number,
//  version: string
// }

const LSK_GENESIS_DATE = new Date('2016-05-24T17:00:00.000Z');

const getMerkleRoot = block => {
  if (!block.transactions || block.transactions.length === 0) {
    return blake2b(block.blockSignature);
  }

  const txs = block.transactions.map(tx => tx.id);
  return txs.reduce((acc, el) => blake2b(acc + el), '');
};

const getAbsoluteTimestamp = blockTs => {
  return ((LSK_GENESIS_DATE.getTime() / 1000 << 0) + blockTs) * 1000;
};

function _createUnifiedBlock(block) {
  const obj = {
    blockNumber: block.height,
    prevHash: block.previousBlock,
    blockHash: block.id,
    root: getMerkleRoot(block),
    fee: block.totalFee,
    size: block.payloadLength,
    payloadHash: block.payloadHash,
    generator: block.generatorId,
    generatorPublicKey: block.generatorPublicKey,
    blockSignature: block.blockSignature,
    confirmations: block.confirmations,
    totalForged: block.totalForged,
    timestamp: getAbsoluteTimestamp(parseInt(block.timestamp, 10)),
    version: block.version,
    transactions: block.transactions.reduce(function (all, t) {
      all.push({
        txHash: t.id,
        // inputs: t.inputs,
        // outputs: t.outputs,
        marked: false
      });
      return all;
    }, [])
  };

  const msg = new Block();
  msg.setBlockchain('lsk');
  msg.setHash(obj.blockHash);
  msg.setPreviousHash(obj.prevHash);
  msg.setTimestamp(obj.timestamp);
  msg.setHeight(obj.blockNumber);
  msg.setMerkleRoot(obj.root);

  return msg;
}

/**
 * LSK Controller
 */
class Controller {
  /* eslint-enable */

  constructor(config) {
    this._config = config;
    this._logger = logging.getLogger(__filename);
    this._blockCache = new LRUCache({
      max: 200,
      maxAge: 1000 * 60 * 60
    });
    this._otherCache = new LRUCache({ max: 50 });
    // this._liskApi = lisk.api(config.rovers.lsk)
    // randomizeNodes: true
    this._liskApi = lisk.APIClient.createMainnetAPIClient(config.rovers.lsk);
    this._rpc = new RpcClient();
  }
  /* eslint-disable no-undef */


  init() {
    this._logger.debug('initialized');

    process.on('disconnect', () => {
      this._logger.info('Parent exited');
      process.exit();
    });

    process.on('uncaughtException', e => {
      this._logger.error(`Uncaught exception: ${errToString(e)}`);
      process.exit(3);
    });

    const cycle = () => {
      this._logger.info('LSK rover active connection: ' + this._liskApi.hasAvailableNodes());

      return this._liskApi.blocks.get({ limit: 1 }).then(lastBlocks => {
        /* eslint-disable */
        try {
          const lastBlock = lastBlocks.data[0];
          this._logger.debug(`Collected new block with id: ${inspect(lastBlock.id)}`);

          if (!this._blockCache.has(lastBlock.id)) {
            this._blockCache.set(lastBlock.id, true);
            this._logger.debug(`unseen block with id: ${inspect(lastBlock.id)} => using for BC chain`);

            // getTransactionsForBlock(this._liskApi, lastBlock.id).then(transactions => {
            // TODO decide if we want to use block with no transactions, there are such
            lastBlock.transactions = [];
            // if (transactions !== undefined) {

            const unifiedBlock = createUnifiedBlock(lastBlock, _createUnifiedBlock);

            this._logger.debug('LSK Going to call this._rpc.rover.collectBlock()');
            try {
              this._rpc.rover.collectBlock(unifiedBlock, (err, response) => {
                if (err) {
                  this._logger.error(`error while collecting block ${inspect(err)}`);
                  skip = skip.concat(['1', '1']);
                  return;
                }
                this._logger.debug(`Collector Response: ${JSON.stringify(response.toObject(), null, 4)}`);
              });
            } catch (err) {
              skip = skip.concat(['1', '1']);
              this._logger.error(err);
            }
            // } else {
            //  skip.push('1')
            // }
            // })
          }
        } catch (err) {
          skip.push('1');
          this._logger.error(err);
        }
      }).catch(err => {
        skip.push('1');
        this._logger.error(err);
        this._logger.error('connection lsk network error');
      });
    };

    this._logger.debug('tick');
    this._intervalDescriptor = setInterval(() => {
      if (skip.length > 0) {
        this._logger.debug('skip');
        skip.pop();
      } else {
        cycle().then(() => {
          this._logger.debug('tick');
        });
      }
    }, 5600);

    // setInterval(function () {
    //  lisk.api(liskOptions).getPeersList({}, function (error, success, response) {
    //    if (error) {
    //      console.trace(error)
    //    } else {
    //      var t = response.peers.reduce(function (all, a) {
    //        if (all[a.height] == undefined) {
    //          all[a.height] = 1
    //        } else {
    //          all[a.height]++
    //        }
    //        return all
    //      }, {})

    //      var tp = Object.keys(t).sort(function (a, b) {
    //        if (t[a] > t[b]) {
    //          return -1
    //        }
    //        if (t[a] < t[b]) {
    //          return 1
    //        }
    //        return 0
    //      })

    //      log.debug('peer sample: ' + response.peers.length)
    //      log.debug('probable lsk block heigh ' + tp[0])
    //    }
    //  })
    // }, 60000)
  }

  close() {
    this._intervalDescriptor && clearInterval(this._intervalDescriptor);
  }
}
exports.default = Controller;
//# sourceMappingURL=controller.js.map
