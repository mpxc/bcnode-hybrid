'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
/**
 * Copyright (c) 2017-present, blockcollider.org developers, All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

const { inspect } = require('util');
const debug = require('debug')('bcnode:peer:peer');
const pull = require('pull-stream');
const { BcBlock } = require('../../protos/core_pb');
const { isValidBlock, validateBlockSequence } = require('../../bc/validation');

const { PROTOCOL_PREFIX } = require('../protocol/version');

// height, hash

class Peer {

  constructor(bundle, peerId) {
    this._bundle = bundle;
    this._peerId = peerId;
  }

  get bundle() {
    return this._bundle;
  }

  get peerId() {
    return this._peerId;
  }

  getHeaders(from, to) {
    debug(`getHeaders(${from.toString()}, ${to.toString()})`, this.peerId.id.toB58String());

    return new Promise((resolve, reject) => {
      this.bundle.dialProtocol(this.peerId, `${PROTOCOL_PREFIX}/rpc`, (err, conn) => {
        if (err) {
          return reject(err);
        }

        const msg = {
          jsonrpc: '2.0',
          method: 'getHeaders',
          params: [from, to],
          id: 42
        };

        pull(pull.values([JSON.stringify(msg)]), conn);

        pull(conn, pull.collect((err, wireData) => {
          if (err) {
            return reject(err);
          }

          try {
            const blocks = wireData.map(b => BcBlock.deserializeBinary(Uint8Array.from(b).buffer));
            // validate each block separately
            blocks.forEach(block => {
              if (!isValidBlock(block)) {
                const reason = `Block ${block.getHeight()}, h: ${block.getHash()} is not a valid BC block`;
                debug(reason);
                reject(new Error(reason));
              }
            });
            // validate that the block sequence is valid
            if (!validateBlockSequence(blocks)) {
              const reason = `Block sequence not valid`;
              debug(reason);
              reject(new Error(reason));
            }
            resolve(blocks);
          } catch (e) {
            return reject(e);
          }
        }));
      });
    });
  }

  getLatestHeader() {
    debug('getLatestHeader()', this.peerId.id.toB58String());

    return new Promise((resolve, reject) => {
      this.bundle.dialProtocol(this.peerId, `${PROTOCOL_PREFIX}/rpc`, (err, conn) => {
        if (err) {
          return reject(err);
        }

        const msg = {
          jsonrpc: '2.0',
          method: 'getLatestHeader',
          params: [],
          id: 42
        };

        pull(pull.values([JSON.stringify(msg)]), conn);

        pull(conn, pull.collect((err, wireData) => {
          if (err) {
            return reject(err);
          }

          try {
            const result = BcBlock.deserializeBinary(Uint8Array.from(wireData[0]).buffer);
            resolve(result);
          } catch (e) {
            return reject(e);
          }
        }));
      });
    });
  }

  getLatestHeaders(count = 10) {
    debug(`getLatestHeaders(${count})`, this.peerId.id.toB58String());

    return new Promise((resolve, reject) => {
      this.bundle.dialProtocol(this.peerId, `${PROTOCOL_PREFIX}/rpc`, (err, conn) => {
        if (err) {
          return reject(err);
        }

        const msg = {
          jsonrpc: '2.0',
          method: 'getLatestHeaders',
          params: [count],
          id: 42
        };

        pull(pull.values([JSON.stringify(msg)]), conn);

        pull(conn, pull.collect((err, wireData) => {
          if (err) {
            return reject(err);
          }

          try {
            const result = wireData.map(b => BcBlock.deserializeBinary(Uint8Array.from(b).buffer));
            resolve(result);
          } catch (e) {
            return reject(e);
          }
        }));
      });
    });
  }

  getMultiverse() {
    debug(`getMultiverse()`, this.peerId.id.toB58String());

    return new Promise((resolve, reject) => {
      this.bundle.dialProtocol(this.peerId, `${PROTOCOL_PREFIX}/rpc`, (err, conn) => {
        if (err) {
          return reject(err);
        }

        const msg = {
          jsonrpc: '2.0',
          method: 'getMultiverse',
          params: [],
          id: 42
        };

        pull(pull.values([JSON.stringify(msg)]), conn);

        pull(conn, pull.collect((err, wireData) => {
          if (err) {
            return reject(err);
          }

          try {
            const result = wireData.map(b => BcBlock.deserializeBinary(Uint8Array.from(b).buffer));
            resolve(result);
          } catch (e) {
            return reject(e);
          }
        }));
      });
    });
  }

  query(params = {}) {
    debug(`query(${inspect(params)})`, this.peerId.id.toB58String());

    return new Promise((resolve, reject) => {
      const expireRequest = setTimeout(() => {
        return reject(new Error('peer query expired'));
      }, 60 * 1000);

      this.bundle.dialProtocol(this.peerId, `${PROTOCOL_PREFIX}/rpc`, (err, conn) => {
        if (err) {
          return reject(err);
        }

        const msg = {
          jsonrpc: '2.0',
          method: 'query',
          params: [params],
          id: 42
        };

        pull(pull.values([JSON.stringify(msg)]), conn);

        pull(conn, pull.collect((err, wireData) => {
          if (err) {
            return reject(err);
          }

          try {
            const result = wireData.map(b => BcBlock.deserializeBinary(Uint8Array.from(b).buffer));
            clearTimeout(expireRequest);
            resolve(result);
          } catch (e) {
            return reject(e);
          }
        }));
      });
    });
  }
}

exports.Peer = Peer;
exports.default = Peer;
//# sourceMappingURL=peer.js.map