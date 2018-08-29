'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.getAddressFromPassphrase = exports.getAddressAndPublicKeyFromPassphrase = exports.getKeys = exports.getPrivateAndPublicKeyFromPassphrase = exports.getPrivateAndPublicKeyBytesFromPassphrase = undefined;

var _tweetnacl = require('tweetnacl');

var _tweetnacl2 = _interopRequireDefault(_tweetnacl);

var _convert = require('./convert');

var _hash = require('./hash');

var _hash2 = _interopRequireDefault(_hash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var getPrivateAndPublicKeyBytesFromPassphrase = exports.getPrivateAndPublicKeyBytesFromPassphrase = function getPrivateAndPublicKeyBytesFromPassphrase(passphrase) {
	var hashed = (0, _hash2.default)(passphrase, 'utf8');

	var _nacl$sign$keyPair$fr = _tweetnacl2.default.sign.keyPair.fromSeed(hashed),
	    publicKey = _nacl$sign$keyPair$fr.publicKey,
	    secretKey = _nacl$sign$keyPair$fr.secretKey;

	return {
		privateKey: secretKey,
		publicKey: publicKey
	};
}; /*
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
var getPrivateAndPublicKeyFromPassphrase = exports.getPrivateAndPublicKeyFromPassphrase = function getPrivateAndPublicKeyFromPassphrase(passphrase) {
	var _getPrivateAndPublicK = getPrivateAndPublicKeyBytesFromPassphrase(passphrase),
	    privateKey = _getPrivateAndPublicK.privateKey,
	    publicKey = _getPrivateAndPublicK.publicKey;

	return {
		privateKey: (0, _convert.bufferToHex)(privateKey),
		publicKey: (0, _convert.bufferToHex)(publicKey)
	};
};

var getKeys = exports.getKeys = getPrivateAndPublicKeyFromPassphrase;

var getAddressAndPublicKeyFromPassphrase = exports.getAddressAndPublicKeyFromPassphrase = function getAddressAndPublicKeyFromPassphrase(passphrase) {
	var _getKeys = getKeys(passphrase),
	    publicKey = _getKeys.publicKey;

	var address = (0, _convert.getAddressFromPublicKey)(publicKey);

	return {
		address: address,
		publicKey: publicKey
	};
};

var getAddressFromPassphrase = exports.getAddressFromPassphrase = function getAddressFromPassphrase(passphrase) {
	var _getKeys2 = getKeys(passphrase),
	    publicKey = _getKeys2.publicKey;

	return (0, _convert.getAddressFromPublicKey)(publicKey);
};