'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.verifyData = exports.signData = exports.signDataWithPassphrase = exports.signDataWithPrivateKey = exports.signAndPrintMessage = exports.printSignedMessage = exports.verifyMessageWithTwoPublicKeys = exports.signMessageWithTwoPassphrases = exports.verifyMessageWithPublicKey = exports.signMessageWithPassphrase = exports.digestMessage = undefined;

var _tweetnacl = require('tweetnacl');

var _tweetnacl2 = _interopRequireDefault(_tweetnacl);

var _varuintBitcoin = require('varuint-bitcoin');

var _liskConstants = require('../lisk-constants');

var _hash = require('./hash');

var _hash2 = _interopRequireDefault(_hash);

var _convert = require('./convert');

var _keys = require('./keys');

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
var createHeader = function createHeader(text) {
	return '-----' + text + '-----';
};
var signedMessageHeader = createHeader('BEGIN LISK SIGNED MESSAGE');
var messageHeader = createHeader('MESSAGE');
var publicKeyHeader = createHeader('PUBLIC KEY');
var secondPublicKeyHeader = createHeader('SECOND PUBLIC KEY');
var signatureHeader = createHeader('SIGNATURE');
var secondSignatureHeader = createHeader('SECOND SIGNATURE');
var signatureFooter = createHeader('END LISK SIGNED MESSAGE');

var SIGNED_MESSAGE_PREFIX_BYTES = Buffer.from(_liskConstants.SIGNED_MESSAGE_PREFIX, 'utf8');
var SIGNED_MESSAGE_PREFIX_LENGTH = (0, _varuintBitcoin.encode)(_liskConstants.SIGNED_MESSAGE_PREFIX.length);

var digestMessage = exports.digestMessage = function digestMessage(message) {
	var msgBytes = Buffer.from(message, 'utf8');
	var msgLenBytes = (0, _varuintBitcoin.encode)(message.length);
	var dataBytes = Buffer.concat([SIGNED_MESSAGE_PREFIX_LENGTH, SIGNED_MESSAGE_PREFIX_BYTES, msgLenBytes, msgBytes]);
	return (0, _hash2.default)((0, _hash2.default)(dataBytes));
};

var signMessageWithPassphrase = exports.signMessageWithPassphrase = function signMessageWithPassphrase(message, passphrase) {
	var msgBytes = digestMessage(message);

	var _getPrivateAndPublicK = (0, _keys.getPrivateAndPublicKeyBytesFromPassphrase)(passphrase),
	    privateKey = _getPrivateAndPublicK.privateKey,
	    publicKey = _getPrivateAndPublicK.publicKey;

	var signature = _tweetnacl2.default.sign.detached(msgBytes, privateKey);

	return {
		message: message,
		publicKey: (0, _convert.bufferToHex)(publicKey),
		signature: (0, _convert.bufferToHex)(signature)
	};
};

var verifyMessageWithPublicKey = exports.verifyMessageWithPublicKey = function verifyMessageWithPublicKey(_ref) {
	var message = _ref.message,
	    signature = _ref.signature,
	    publicKey = _ref.publicKey;

	var msgBytes = digestMessage(message);
	var signatureBytes = (0, _convert.hexToBuffer)(signature);
	var publicKeyBytes = (0, _convert.hexToBuffer)(publicKey);

	if (publicKeyBytes.length !== _tweetnacl2.default.sign.publicKeyLength) {
		throw new Error('Invalid publicKey, expected 32-byte publicKey');
	}

	if (signatureBytes.length !== _tweetnacl2.default.sign.signatureLength) {
		throw new Error('Invalid signature length, expected 64-byte signature');
	}

	return _tweetnacl2.default.sign.detached.verify(msgBytes, signatureBytes, publicKeyBytes);
};

var signMessageWithTwoPassphrases = exports.signMessageWithTwoPassphrases = function signMessageWithTwoPassphrases(message, passphrase, secondPassphrase) {
	var msgBytes = digestMessage(message);
	var keypairBytes = (0, _keys.getPrivateAndPublicKeyBytesFromPassphrase)(passphrase);
	var secondKeypairBytes = (0, _keys.getPrivateAndPublicKeyBytesFromPassphrase)(secondPassphrase);

	var signature = _tweetnacl2.default.sign.detached(msgBytes, keypairBytes.privateKey);
	var secondSignature = _tweetnacl2.default.sign.detached(msgBytes, secondKeypairBytes.privateKey);

	return {
		message: message,
		publicKey: (0, _convert.bufferToHex)(keypairBytes.publicKey),
		secondPublicKey: (0, _convert.bufferToHex)(secondKeypairBytes.publicKey),
		signature: (0, _convert.bufferToHex)(signature),
		secondSignature: (0, _convert.bufferToHex)(secondSignature)
	};
};

var verifyMessageWithTwoPublicKeys = exports.verifyMessageWithTwoPublicKeys = function verifyMessageWithTwoPublicKeys(_ref2) {
	var message = _ref2.message,
	    signature = _ref2.signature,
	    secondSignature = _ref2.secondSignature,
	    publicKey = _ref2.publicKey,
	    secondPublicKey = _ref2.secondPublicKey;

	var messageBytes = digestMessage(message);
	var signatureBytes = (0, _convert.hexToBuffer)(signature);
	var secondSignatureBytes = (0, _convert.hexToBuffer)(secondSignature);
	var publicKeyBytes = (0, _convert.hexToBuffer)(publicKey);
	var secondPublicKeyBytes = (0, _convert.hexToBuffer)(secondPublicKey);

	if (signatureBytes.length !== _tweetnacl2.default.sign.signatureLength) {
		throw new Error('Invalid first signature length, expected 64-byte signature');
	}

	if (secondSignatureBytes.length !== _tweetnacl2.default.sign.signatureLength) {
		throw new Error('Invalid second signature length, expected 64-byte signature');
	}

	if (publicKeyBytes.length !== _tweetnacl2.default.sign.publicKeyLength) {
		throw new Error('Invalid first publicKey, expected 32-byte publicKey');
	}

	if (secondPublicKeyBytes.length !== _tweetnacl2.default.sign.publicKeyLength) {
		throw new Error('Invalid second publicKey, expected 32-byte publicKey');
	}

	var verifyFirstSignature = function verifyFirstSignature() {
		return _tweetnacl2.default.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
	};
	var verifySecondSignature = function verifySecondSignature() {
		return _tweetnacl2.default.sign.detached.verify(messageBytes, secondSignatureBytes, secondPublicKeyBytes);
	};

	return verifyFirstSignature() && verifySecondSignature();
};

var printSignedMessage = exports.printSignedMessage = function printSignedMessage(_ref3) {
	var message = _ref3.message,
	    signature = _ref3.signature,
	    publicKey = _ref3.publicKey,
	    secondSignature = _ref3.secondSignature,
	    secondPublicKey = _ref3.secondPublicKey;
	return [signedMessageHeader, messageHeader, message, publicKeyHeader, publicKey, secondPublicKey ? secondPublicKeyHeader : null, secondPublicKey, signatureHeader, signature, secondSignature ? secondSignatureHeader : null, secondSignature, signatureFooter].filter(Boolean).join('\n');
};

var signAndPrintMessage = exports.signAndPrintMessage = function signAndPrintMessage(message, passphrase, secondPassphrase) {
	var signedMessage = secondPassphrase ? signMessageWithTwoPassphrases(message, passphrase, secondPassphrase) : signMessageWithPassphrase(message, passphrase);

	return printSignedMessage(signedMessage);
};

var signDataWithPrivateKey = exports.signDataWithPrivateKey = function signDataWithPrivateKey(data, privateKey) {
	var signature = _tweetnacl2.default.sign.detached(data, privateKey);
	return (0, _convert.bufferToHex)(signature);
};

var signDataWithPassphrase = exports.signDataWithPassphrase = function signDataWithPassphrase(data, passphrase) {
	var _getPrivateAndPublicK2 = (0, _keys.getPrivateAndPublicKeyBytesFromPassphrase)(passphrase),
	    privateKey = _getPrivateAndPublicK2.privateKey;

	return signDataWithPrivateKey(data, privateKey);
};

var signData = exports.signData = signDataWithPassphrase;

var verifyData = exports.verifyData = function verifyData(data, signature, publicKey) {
	return _tweetnacl2.default.sign.detached.verify(data, (0, _convert.hexToBuffer)(signature), (0, _convert.hexToBuffer)(publicKey));
};