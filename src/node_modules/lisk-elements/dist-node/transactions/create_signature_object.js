'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _cryptography = require('../cryptography');

var _cryptography2 = _interopRequireDefault(_cryptography);

var _utils = require('./utils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*
 * Copyright © 2018 Lisk Foundation
 *
 * See the LICENSE file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with the Lisk Foundation,
 * no part of this software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE file.
 *
 * Removal or modification of this copyright notice is prohibited.
 *
 */
var createSignatureObject = function createSignatureObject(transaction, passphrase) {
  if (!(0, _utils.verifyTransaction)(transaction)) {
    throw new Error('Invalid transaction.');
  }

  var _cryptography$getPriv = _cryptography2.default.getPrivateAndPublicKeyFromPassphrase(passphrase),
      publicKey = _cryptography$getPriv.publicKey;

  return {
    transactionId: transaction.id,
    publicKey: publicKey,
    signature: (0, _utils.multiSignTransaction)(transaction, passphrase)
  };
};

exports.default = createSignatureObject;