'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.decryptPassphraseWithPassword = exports.encryptPassphraseWithPassword = exports.decryptMessageWithPassphrase = exports.encryptMessageWithPassphrase = undefined;

var _crypto = require('crypto');

var _crypto2 = _interopRequireDefault(_crypto);

var _tweetnacl = require('tweetnacl');

var _tweetnacl2 = _interopRequireDefault(_tweetnacl);

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
var PBKDF2_ITERATIONS = 1e6;
var PBKDF2_KEYLEN = 32;
var PBKDF2_HASH_FUNCTION = 'sha256';
var ENCRYPTION_VERSION = '1';

var encryptMessageWithPassphrase = exports.encryptMessageWithPassphrase = function encryptMessageWithPassphrase(message, passphrase, recipientPublicKey) {
	var _getPrivateAndPublicK = (0, _keys.getPrivateAndPublicKeyBytesFromPassphrase)(passphrase),
	    senderPrivateKeyBytes = _getPrivateAndPublicK.privateKey;

	var convertedPrivateKey = (0, _convert.convertPrivateKeyEd2Curve)(senderPrivateKeyBytes);
	var recipientPublicKeyBytes = (0, _convert.hexToBuffer)(recipientPublicKey);
	var convertedPublicKey = (0, _convert.convertPublicKeyEd2Curve)(recipientPublicKeyBytes);
	var messageInBytes = Buffer.from(message, 'utf8');

	var nonce = _tweetnacl2.default.randomBytes(24);
	var cipherBytes = _tweetnacl2.default.box(messageInBytes, nonce, convertedPublicKey, convertedPrivateKey);

	var nonceHex = (0, _convert.bufferToHex)(nonce);
	var encryptedMessage = (0, _convert.bufferToHex)(cipherBytes);

	return {
		nonce: nonceHex,
		encryptedMessage: encryptedMessage
	};
};

var decryptMessageWithPassphrase = exports.decryptMessageWithPassphrase = function decryptMessageWithPassphrase(cipherHex, nonce, passphrase, senderPublicKey) {
	var _getPrivateAndPublicK2 = (0, _keys.getPrivateAndPublicKeyBytesFromPassphrase)(passphrase),
	    recipientPrivateKeyBytes = _getPrivateAndPublicK2.privateKey;

	var convertedPrivateKey = (0, _convert.convertPrivateKeyEd2Curve)(recipientPrivateKeyBytes);
	var senderPublicKeyBytes = (0, _convert.hexToBuffer)(senderPublicKey);
	var convertedPublicKey = (0, _convert.convertPublicKeyEd2Curve)(senderPublicKeyBytes);
	var cipherBytes = (0, _convert.hexToBuffer)(cipherHex);
	var nonceBytes = (0, _convert.hexToBuffer)(nonce);

	try {
		var decoded = _tweetnacl2.default.box.open(cipherBytes, nonceBytes, convertedPublicKey, convertedPrivateKey);
		return Buffer.from(decoded).toString();
	} catch (error) {
		if (error.message.match(/bad nonce size/)) {
			throw new Error('Expected 24-byte nonce but got length 1.');
		}
		throw new Error('Something went wrong during decryption. Is this the full encrypted message?');
	}
};

var getKeyFromPassword = function getKeyFromPassword(password, salt, iterations) {
	return _crypto2.default.pbkdf2Sync(password, salt, iterations, PBKDF2_KEYLEN, PBKDF2_HASH_FUNCTION);
};

var encryptAES256GCMWithPassword = function encryptAES256GCMWithPassword(plainText, password) {
	var iterations = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : PBKDF2_ITERATIONS;

	var iv = _crypto2.default.randomBytes(12);
	var salt = _crypto2.default.randomBytes(16);
	var key = getKeyFromPassword(password, salt, iterations);

	var cipher = _crypto2.default.createCipheriv('aes-256-gcm', key, iv);
	var firstBlock = cipher.update(plainText, 'utf8');
	var encrypted = Buffer.concat([firstBlock, cipher.final()]);
	var tag = cipher.getAuthTag();

	return {
		iterations: iterations,
		cipherText: encrypted.toString('hex'),
		iv: iv.toString('hex'),
		salt: salt.toString('hex'),
		tag: tag.toString('hex'),
		version: ENCRYPTION_VERSION
	};
};

var getTagBuffer = function getTagBuffer(tag) {
	var tagBuffer = (0, _convert.hexToBuffer)(tag);
	if (tagBuffer.length !== 16) {
		throw new Error('Tag must be 16 bytes.');
	}
	return tagBuffer;
};

var decryptAES256GCMWithPassword = function decryptAES256GCMWithPassword(_ref, password) {
	var _ref$iterations = _ref.iterations,
	    iterations = _ref$iterations === undefined ? PBKDF2_ITERATIONS : _ref$iterations,
	    cipherText = _ref.cipherText,
	    iv = _ref.iv,
	    salt = _ref.salt,
	    tag = _ref.tag;

	var tagBuffer = getTagBuffer(tag);
	var key = getKeyFromPassword(password, (0, _convert.hexToBuffer)(salt), iterations);

	var decipher = _crypto2.default.createDecipheriv('aes-256-gcm', key, (0, _convert.hexToBuffer)(iv));
	decipher.setAuthTag(tagBuffer);
	var firstBlock = decipher.update((0, _convert.hexToBuffer)(cipherText));
	var decrypted = Buffer.concat([firstBlock, decipher.final()]);

	return decrypted.toString();
};

var encryptPassphraseWithPassword = exports.encryptPassphraseWithPassword = encryptAES256GCMWithPassword;

var decryptPassphraseWithPassword = exports.decryptPassphraseWithPassword = decryptAES256GCMWithPassword;