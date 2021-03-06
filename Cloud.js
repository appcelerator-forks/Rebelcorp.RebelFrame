var Alloy = require('alloy'),
	_ = Alloy._,
	Backbone = Alloy.Backbone;

var Cloud = (function() {

	// constructor
	var cls = function(config) {
		_.extend(this, {
			/**
			 * @property {Ti.Network.HttpClient} httpClient The internal httpClient used to perform the request
			 */
			httpClient: null,

			onSuccess: null,
			onError: null,

			/**
			 * Constructor
			 *
			 * @param {Object} config Class configuration
			 */
			construct: function(config) {
				this.onSuccess = config.success;
				this.onError = config.error;

				var clientConfig = {
					onload: _.partial(onSuccess, this),
					onerror: _.partial(onError, this),
					ondatastream: config.progress,
					onsendstream: config.progress,
					onreadystatechange: config.stateChange,
					timeout: config.timeout || 10000
				};

				// Create http client
				this.httpClient = Ti.Network.createHTTPClient(clientConfig);

				// make sure we have a data object
				config.data = config.data || {};

				// Prepare the data (if required)
				var url = config.url,
					method = config.method || 'GET',
					data, query;

				if (method == 'GET' || method == 'DELETE') {
					query = toQueryString(config.data);

					if (query)
						url = url + (url.indexOf('?') > 0 ? '&' : '?') + query;
				} else
					data = config.data || {};

				// Add base Url if url does not start with http
				if(url.substr(0, 4) !== 'http')
					url = Alloy.CFG.baseUrl + url;

				Ti.API.debug(method + ': ' + url);
				// Ti.API.info(data);

				// Open connection
				this.httpClient.open(method, url);

				// Set headers after opening connection
				for (var key in config.headers) {
					this.httpClient.setRequestHeader(key, config.headers[key]);
				}

				if(config.json) {
					this.httpClient.setRequestHeader('Content-Type', 'application/json');

					if(data)
						data = JSON.stringify(data);
				}

				Ti.API.debug(config.headers);

				this.httpClient.send(data);
			},

			/**
			 * Remove this object from memory gracefully
			 */
			destruct: function() {
				if (this.httpClient) {
					this.httpClient.abort();
					this.httpClient = null;
				}
			}
		});

		// Call construct on object initialization
		this.construct(config);
	};

	function onSuccess(req, result) {
		var response;

		if (result.success) {
			try {
				response = JSON.parse(this.responseText);
			} catch (e) {
				Ti.API.error('Tried to parse response, but it was not valid json.');
				Ti.API.error(this.responseText);
				response = this.responseText;
			}
		}

		// Call callback
		if (req.onSuccess)
			req.onSuccess(response);
	}

	function onError(req, result) {
		var response;

		try {
			response = JSON.parse(this.responseText);
		} catch (e) {
			Ti.API.error('Tried to parse response, but it was not valid json.');
			Ti.API.error(this.responseText);
			response = this.responseText;
		}

		Ti.API.info(response);

		// Call callback
		if (req.onError)
			req.onError(response);
	}

	/**
	 * Converts the supplied object into a query string
	 * @private
	 *
	 * @param {Object} data The object to convert
	 * @return {String} The generated query string
	 */
	function toQueryString(data) {
		var query = [],
			queryString = '',
			key;

		if (data) {
			for (key in data) {
				if (data.hasOwnProperty(key))
					query.push(Ti.Network.encodeURIComponent(key) + '=' + Ti.Network.encodeURIComponent(data[key]));
			}

			if (query.length)
				queryString = query.join('&');
		}

		return queryString;
	}

	return cls;
})();

module.exports = Cloud;
