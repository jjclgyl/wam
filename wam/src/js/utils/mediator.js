/**
 * 
 */
var mediator = (function() {
	'use strict';

	/**
	 * Available channels in the context
	 * 
	 * @var {object}
	 */
	var channels = {},

	/**
	 * Subscribe a callback to a channel.
	 * 
	 * @param {string}
	 *            channel the name of the channel to subscribe to
	 * @param {function}
	 *            fn the callback to add
	 * @return {object} the mediator itself
	 */
	subscribe = function(channel, fn) {
		if (!channels[channel])
			channels[channel] = [];
		channels[channel].push({
			context : this,
			callback : fn
		});
		return this;
	},

	/**
	 * Subscribe to a channel
	 * 
	 * @param {string}
	 *            channel the name of the channel to subscribe on.
	 * @param {function}
	 *            subscription the callback function
	 * @param {object}
	 *            context the context of the call
	 * @param {boolean}
	 *            once indicate if w have to fire the event more than once.
	 * @return {object} the mediator itself
	 */
	_subscribe = function(channel, subscription, context, once) {
		if (!channels[channel])
			channels[channel] = [];
		channels[channel].push({
			fn : subscription,
			context : context || this,
			once : once || false
		});
		return this;
	},

	/**
	 * Trigger all callback for a channel
	 * 
	 * @param {string}
	 *            channel the name of the channel to publish
	 */
	publish = function(channel) {
		if (!mediator.channels[channel])
			return false;
		var args = Array.prototype.slice.call(arguments, 1);
		for (var i = 0, l = channels[channel].length; i < l; i++) {
			var subscription = channels[channel][i];
			subscription.callback.apply(subscription.context, args);
		}
		return this;
	},

	/**
	 * Trigger all callback for a channel
	 * 
	 * @param channel
	 * @param [] Extra parameters to pass to handler
	 */
	_publish = function(channel) {
		if (!channels[channel])
			return;

		var args = [].slice.call(arguments, 1), 
			subscription;

		for (var i = 0; i < channels[channel].length; i++) {
			subscription = channels[channel][i];
			subscription.fn.apply(subscription.context, args);
			if (subscription.once) {
				unsubscribe(channel, subscription.fn, subscription.context);
				i--;
			}
		}
	},
	
	/**
	 * Cancel subscription
	 * 
	 * @param channel
	 * @param fn
	 * @param context
	 */
	_unsubscribe = function(channel, fn, context) {
		if (!channels[channel])
			return;

		var subscription;
		for (var i = 0; i < channels[channel].length; i++) {
			subscription = channels[channel][i];
			if (subscription.fn === fn && subscription.context === context) {
				channels[channel].splice(i, 1);
				i--;
			}
		}
	},
	/**
	 * Subscribing to one event only
	 *
	 * @param channel
	 * @param subscription
	 * @param context
	 */
	_subscribeOnce = function (channel, subscription, context) {
		_subscribe(channel, subscription, context, true);
	},
	
	/**
	 *  Install the mediation stack on a specific element.
	 *  
	 *  @param {object} target the element to arm mediation stack on
	 *  @return {object} the element itself
	 */
	installTo = function(target) {
		target.subscribe = _subscribe;
		target.publish = _publish;
		target.unsubscribe = _unsubscribe;
		target.subscribeOnce = _subscribeOnce;
		return target;
	};

	/*return {
		channels : channels,
		publish : publish,
		subscribe : subscribe,
		installTo : function(obj) {
			obj.subscribe = subscribe;
			obj.publish = publish;
		}
	};*/
	return {
		channels: channels,
		publish: _publish,
		subscribe: _subscribe,
		unsubscribe: _unsubscribe,
		subscribeOnce: _subscribeOnce,
		installTo : installTo
	};

}());