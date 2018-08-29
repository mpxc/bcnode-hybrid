'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _crypto = require('crypto');

var _crypto2 = _interopRequireDefault(_crypto);

var _convert = require('./convert');

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
var cryptoHashSha256 = function cryptoHashSha256(data) {
	var hash = _crypto2.default.createHash('sha256');
	hash.update(data);
	return hash.digest();
};

var hash = function hash(data, format) {
	if (Buffer.isBuffer(data)) {
		return cryptoHashSha256(data);
	}

	if (typeof data === 'string') {
		if (!['utf8', 'hex'].includes(format)) {
			throw new Error('Unsupported string format. Currently only `hex` and `utf8` are supported.');
		}
		var encoded = format === 'utf8' ? Buffer.from(data, 'utf8') : (0, _convert.hexToBuffer)(data);
		return cryptoHashSha256(encoded);
	}

	throw new Error('Unsupported data format. Currently only Buffers or `hex` and `utf8` strings are supported.');
};

exports.default = hash;