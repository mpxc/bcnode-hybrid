'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.prependMinusToPublicKeys = exports.prependPlusToPublicKeys = exports.convertLSKToBeddows = exports.convertBeddowsToLSK = undefined;

var _browserifyBignum = require('browserify-bignum');

var _browserifyBignum2 = _interopRequireDefault(_browserifyBignum);

var _liskConstants = require('../../lisk-constants');

var _constants = require('../constants');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var getDecimalPlaces = function getDecimalPlaces(amount) {
	return (amount.split('.')[1] || '').length;
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

var isGreaterThanMaxTransactionAmount = function isGreaterThanMaxTransactionAmount(amount) {
	return amount.cmp(_liskConstants.MAX_TRANSACTION_AMOUNT) > 0;
};

var convertBeddowsToLSK = exports.convertBeddowsToLSK = function convertBeddowsToLSK(beddowsAmount) {
	if (typeof beddowsAmount !== 'string') {
		throw new Error('Cannot convert non-string amount');
	}
	if (getDecimalPlaces(beddowsAmount)) {
		throw new Error('Beddows amount should not have decimal points');
	}
	var beddowsAmountBigNum = (0, _browserifyBignum2.default)(beddowsAmount);
	if (isGreaterThanMaxTransactionAmount(beddowsAmountBigNum)) {
		throw new Error('Beddows amount out of range');
	}
	var lskAmountBigNum = beddowsAmountBigNum.div(_constants.FIXED_POINT);
	return lskAmountBigNum.toString(10);
};

var convertLSKToBeddows = exports.convertLSKToBeddows = function convertLSKToBeddows(lskAmount) {
	if (typeof lskAmount !== 'string') {
		throw new Error('Cannot convert non-string amount');
	}
	if (getDecimalPlaces(lskAmount) > 8) {
		throw new Error('LSK amount has too many decimal points');
	}
	var lskAmountBigNum = (0, _browserifyBignum2.default)(lskAmount);
	var beddowsAmountBigNum = lskAmountBigNum.mul(_constants.FIXED_POINT);
	if (isGreaterThanMaxTransactionAmount(beddowsAmountBigNum)) {
		throw new Error('LSK amount out of range');
	}
	return beddowsAmountBigNum.toString();
};

var prependPlusToPublicKeys = exports.prependPlusToPublicKeys = function prependPlusToPublicKeys(publicKeys) {
	return publicKeys.map(function (publicKey) {
		return '+' + publicKey;
	});
};

var prependMinusToPublicKeys = exports.prependMinusToPublicKeys = function prependMinusToPublicKeys(publicKeys) {
	return publicKeys.map(function (publicKey) {
		return '-' + publicKey;
	});
};