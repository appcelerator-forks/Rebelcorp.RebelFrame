var Alloy = require('alloy'),
	_ = Alloy._,
	Backbone = Alloy.Backbone;

/**
* {String} The status of this app (i.e. loggedout, loggedin, activated)
* @private
*/
var _status;

/**
 * @class Framework
 * @singleton
 *
 * RebelFrame's general functions, defined as singleton
 */
var Framework = module.exports = _.extend({
	/**
	 * @property {String} LOGGEDOUT User has installed App, but not yet loggedin
	 */
	LOGGEDOUT: 'loggedout',
	/**
	 * @property {String} LOGGEDOUT User is loggedin, but has not yet activated
	 */
	LOGGEDIN: 'loggedin',
	/**
	 * @property {String} ACTIVATED User is loggedin, activated and ready to use all the features
	 */
	ACTIVATED: 'activated',

	/**
	 * @property {Number} deviceWidth Width of the device in dip. We need to devide by the logicalDensityFactor on Android to get the dip
	 */
	deviceWidth: OS_IOS ? Ti.Platform.displayCaps.platformWidth : Ti.Platform.displayCaps.platformWidth / Ti.Platform.displayCaps.logicalDensityFactor,

	/**
	 * @property {Number} deviceHeight Height of the device in dip. We need to devide by the logicalDensityFactor on Android to get the dip
	 */
	deviceHeight: OS_IOS ? Ti.Platform.displayCaps.platformHeight : Ti.Platform.displayCaps.platformHeight / Ti.Platform.displayCaps.logicalDensityFactor,

	/**
	 * Sets the status of this app
	 *
	 * @param {String} status The status to set
	 */
	setStatus: function(status) {
		var oldStatus = _status;
		_status = status;

		// Persist new App Status
		Ti.App.Properties.setString(Ti.App.id + '.status', status);

		// Trigger event, so App can route based on new App Status
		Framework.trigger('status', {
			oldStatus: oldStatus,
			newStatus: _status
		});
	},

	/**
	 * Returns the status of this app
	 *
	 * @return {String} The status
	 */
	getStatus: function() {
		// Ti.API.error('stored status', Ti.App.Properties.getString(Ti.App.id + '.status'));

		if (!_status)
			_status = Ti.App.Properties.getString(Ti.App.id + '.status', Framework.LOGGEDOUT);

		// Ti.API.error('returned status', _status);

		return _status;
	},

	/**
	 * Extend Alloy's createController en createWidget functions to call construct function when controller is initialized.
	 */
	extendAlloy: function() {
		// Wrap some Alloy functions, so they call construct and destruct methods.
		var _alloy_createController = Alloy.createController,
			_alloy_createModel = Alloy.createModel,
			_alloy_createCollection = Alloy.createCollection,
			_alloy_createWidget = Alloy.createWidget,
			WM = require('RebelFrame/WindowManager'),
			Context = require('RebelFrame/Context');

		/**
		 * Adds openWin en closeWin functions to Alloy Controllers. This way it is easy to call $.openWin() and $.closeWin and are needed close eventlisteners automatically added and removed.
		 *
		 * @param {Alloy.Controller} controller Controller to add the functions to
		 */
		var addFunctions = function(controller, config) {

			_.extend(controller, {
				/**
				 * Opens the Window. Also adds a `clse` eventListener, to clean up the controller when the Window is closed.
				 *
				 * @param  {Ti.UI.Window} [win] Window to open. If not provided, the Controller's top level view is used.
				 */
				openWin: function(win) {
					win = win || controller.getView();

					// When Controller is 'root' Window and should show hamburger, make it so
					if (!_.isUndefined(config.showSideMenu))
						win.showSideMenu = config.showSideMenu;
					// When Controller is opened from the XML of a TabGroup, do nothing
					else if (!_.isUndefined(config.tabGroupRoot))
						return;

					function onOpenWin(evt) {
						this.removeEventListener('open', onOpenWin);

						if(OS_ANDROID) {
							Context.on(win.id, this.activity);
						}

						// If there is a onOpen callback, call it
						if(_.isFunction(config.onOpen))
							config.onOpen(controller);
					}

					/**
					 * Handle `close` event of Window. Removes eventlistener and calls both RebelFrame's destruct as Alloy's destroy functions.
					 *
					 * @param  {Object} evt Event details
					 */
					function onCloseWin(evt) {
						this.removeEventListener('close', onCloseWin);

						if(OS_ANDROID)
							Context.off(win.activity);

						// If there is a destruct function, call it.
						if (_.isFunction(controller.destruct)) {
							Ti.API.debug('destruct() called');
							controller.destruct.call(controller, evt);
						} else
							Ti.API.warn('destruct() NOT called');

						// Call Aloy's own destroy function
						controller.destroy.call(controller, evt);

						// If there is a onClose callback, call it
						if(_.isFunction(config.onClose))
							config.onClose(controller);

						// Cleanup possible panning:
						if(OS_IOS)
							evt.source.keyboardPanning = false;
					}

					win.addEventListener('open', onOpenWin);

					win.addEventListener('close', onCloseWin);

					// Open the window
					WM.openWin(win);

				},

				/**
				 * Close the Window
				 *
				 * @param  {Ti.UI.Window} [win] Window to close. If not provided, the Controller's top level view is used.
				 */
				closeWin: function(win) {
					win = win || controller.getView();

					WM.closeWin(win);
				}
			});
		};

		/**
		 * Call original Alloy.createController function and then construct is it exists. Also track this new screen in Google Analytics
		 *
		 * @param  {String} name Controller name
		 * @param  {Object} config Controller configuration
		 *
		 * @return {Alloy.controller} Created controller, extended with RebelFrame fucntions
		 */
		Alloy.createController = function(name, config) {
			config = config || {};

			// Create controller using Alloy's original function
			var controller = _alloy_createController(name, config);

			// Add custom RebelFrame functions to controller
			addFunctions(controller, config);

			// Call constructor, if exists
			if (controller.construct)
				controller.construct.call(controller, config || {});

			// Track screen
			// if (name !== 'index')
			// 	require('RebelFrame/Tracker').trackScreen(name);

			return controller;
		};

		/**
		 * Call original Alloy.createWidget function and then construct is it exists. Also track this new screen in Google Analytics
		 *
		 * @param  {String} name Controller name
		 * @param  {Object} config Controller configuration
		 *
		 * @return {Alloy.controller} Created controller, extended with RebelFrame fucntions
		 */
		Alloy.createWidget = function(name, controller, config) {
			config = config || {};

			// Create controller using Alloy's original function
			var widget = _alloy_createWidget(name, controller, config);

			// Also support name, config as arguments, leaving out controller, but do this only after calling the original method.
			// Copied from Alloy.js definition
			if ("undefined" != typeof controller && null !== controller && _.isObject(controller) && !_.isString(controller)) {
				config = controller;
			}

			// Add custom RebelFrame functions to controller
			addFunctions(widget, config);

			// Call constructor, if exists
			if (widget.construct)
				widget.construct.call(widget, config || {});

			return widget;
		};
	},

	/**
	 * Scan the contents of the supplied object
	 *
	 * For debugging purposes only
	 *
	 * @param {Object} obj The object to scan
	 * @private
	 */
	scan: function(obj) {
		var key, type;

		Ti.API.error('Contents of object:');
		for (key in obj) {
			type = typeof(obj[key]);
			if (type != 'object' && type != 'function')
				Ti.API.error(' - ' + key + ': ' + type + ' (' + obj[key] + ')');
			else
				Ti.API.error(' - ' + key + ': ' + type);
		}
	},

	iosVersion: function(asArray) {
        if(!OS_IOS)
            return false;

        var version = Ti.Platform.version.split(".");

        if(asArray)
            return version;

        var asFloat = parseInt(version[0]);

        if(version[1])
            asFloat += parseInt(version[1])/10;

        if(version[2])
            asFloat += parseInt(version[2])/100;

        return asFloat;
    }
}, Backbone.Events);

// Create some basic globals that can be used in TSS
Alloy.Globals.deviceHeight = Framework.deviceHeight;
Alloy.Globals.screenHeight = Framework.deviceHeight - (OS_IOS ? 64 : 72);
Alloy.Globals.screenWidth = Framework.deviceWidth;
