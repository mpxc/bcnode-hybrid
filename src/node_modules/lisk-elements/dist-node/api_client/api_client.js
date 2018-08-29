'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _assign = require('babel-runtime/core-js/object/assign');

var _assign2 = _interopRequireDefault(_assign);

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _liskConstants = require('../lisk-constants');

var _constants = require('./constants');

var constants = _interopRequireWildcard(_constants);

var _resources = require('./resources');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

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
var defaultOptions = {
	bannedNode: [],
	randomizeNode: true
};

var commonHeaders = {
	Accept: 'application/json',
	'Content-Type': 'application/json'
};

var getUserAgent = function getUserAgent() {
	var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
	    _ref$name = _ref.name,
	    name = _ref$name === undefined ? '????' : _ref$name,
	    _ref$version = _ref.version,
	    version = _ref$version === undefined ? '????' : _ref$version,
	    _ref$engine = _ref.engine,
	    engine = _ref$engine === undefined ? '????' : _ref$engine;

	var liskElementsInformation = 'LiskElements/1.0 (+https://github.com/LiskHQ/lisk-elements)';
	var locale = process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || process.env.LANGUAGE;
	var systemInformation = _os2.default.platform() + ' ' + _os2.default.release() + '; ' + _os2.default.arch() + (locale ? '; ' + locale : '');
	return name + '/' + version + ' (' + engine + ') ' + liskElementsInformation + ' ' + systemInformation;
};

var APIClient = function () {
	function APIClient(nodes) {
		var providedOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
		(0, _classCallCheck3.default)(this, APIClient);

		this.initialize(nodes, providedOptions);

		this.accounts = new _resources.AccountsResource(this);
		this.blocks = new _resources.BlocksResource(this);
		this.dapps = new _resources.DappsResource(this);
		this.delegates = new _resources.DelegatesResource(this);
		this.node = new _resources.NodeResource(this);
		this.peers = new _resources.PeersResource(this);
		this.signatures = new _resources.SignaturesResource(this);
		this.transactions = new _resources.TransactionsResource(this);
		this.voters = new _resources.VotersResource(this);
		this.votes = new _resources.VotesResource(this);
	}

	(0, _createClass3.default)(APIClient, [{
		key: 'initialize',
		value: function initialize(nodes) {
			var providedOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

			if (!Array.isArray(nodes) || nodes.length <= 0) {
				throw new Error('APIClient requires nodes for initialization.');
			}

			if ((typeof providedOptions === 'undefined' ? 'undefined' : (0, _typeof3.default)(providedOptions)) !== 'object' || Array.isArray(providedOptions)) {
				throw new Error('APIClient takes an optional object as the second parameter.');
			}

			var options = (0, _assign2.default)({}, defaultOptions, providedOptions);

			this.headers = (0, _assign2.default)({}, commonHeaders, options.nethash ? { nethash: options.nethash } : {}, {
				'User-Agent': getUserAgent(options.client)
			});

			this.nodes = nodes;
			this.bannedNodes = [].concat((0, _toConsumableArray3.default)(options.bannedNodes || []));
			this.currentNode = options.node || this.getNewNode();
			this.randomizeNodes = options.randomizeNodes !== false;
		}
	}, {
		key: 'getNewNode',
		value: function getNewNode() {
			var _this = this;

			var nodes = this.nodes.filter(function (node) {
				return !_this.isBanned(node);
			});

			if (nodes.length === 0) {
				throw new Error('Cannot get new node: all nodes have been banned.');
			}

			var randomIndex = Math.floor(Math.random() * nodes.length);
			return nodes[randomIndex];
		}
	}, {
		key: 'banNode',
		value: function banNode(node) {
			if (!this.isBanned(node)) {
				this.bannedNodes.push(node);
				return true;
			}
			return false;
		}
	}, {
		key: 'banActiveNode',
		value: function banActiveNode() {
			return this.banNode(this.currentNode);
		}
	}, {
		key: 'banActiveNodeAndSelect',
		value: function banActiveNodeAndSelect() {
			var banned = this.banActiveNode();
			if (banned) {
				this.currentNode = this.getNewNode();
			}
			return banned;
		}
	}, {
		key: 'hasAvailableNodes',
		value: function hasAvailableNodes() {
			var _this2 = this;

			return this.nodes.some(function (node) {
				return !_this2.isBanned(node);
			});
		}
	}, {
		key: 'isBanned',
		value: function isBanned(node) {
			return this.bannedNodes.includes(node);
		}
	}], [{
		key: 'createMainnetAPIClient',
		value: function createMainnetAPIClient(options) {
			return new APIClient(constants.MAINNET_NODES, (0, _assign2.default)({}, { nethash: _liskConstants.MAINNET_NETHASH }, options));
		}
	}, {
		key: 'createTestnetAPIClient',
		value: function createTestnetAPIClient(options) {
			return new APIClient(constants.TESTNET_NODES, (0, _assign2.default)({}, { nethash: _liskConstants.TESTNET_NETHASH }, options));
		}
	}, {
		key: 'constants',
		get: function get() {
			return constants;
		}
	}]);
	return APIClient;
}();

exports.default = APIClient;