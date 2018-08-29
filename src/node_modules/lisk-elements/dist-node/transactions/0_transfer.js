'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _constants = require('./constants');

var _utils = require('./utils');

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
var createAsset = function createAsset(data) {
	if (data && data.length > 0) {
		if (data.length > _constants.BYTESIZES.DATA) {
			throw new Error('Transaction data field cannot exceed 64 bytes.');
		}
		if (data !== data.toString('utf8')) throw new Error('Invalid encoding in transaction data. Data must be utf-8 encoded.');
		return { data: data };
	}
	return {};
};

var transfer = function transfer(_ref) {
	var amount = _ref.amount,
	    recipientId = _ref.recipientId,
	    recipientPublicKey = _ref.recipientPublicKey,
	    data = _ref.data;

	var _getAddressAndPublicK = (0, _utils.getAddressAndPublicKeyFromRecipientData)({
		recipientId: recipientId,
		recipientPublicKey: recipientPublicKey
	}),
	    address = _getAddressAndPublicK.address,
	    publicKey = _getAddressAndPublicK.publicKey;

	var transaction = {
		type: 0,
		amount: amount.toString(),
		fee: _constants.TRANSFER_FEE.toString(),
		recipientId: address,
		recipientPublicKey: publicKey,
		asset: createAsset(data)
	};

	return transaction;
};

exports.default = (0, _utils.wrapTransactionCreator)(transfer);