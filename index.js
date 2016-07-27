/* global fetch, Request */
require('isomorphic-fetch')

function Client (options) {
  var self = this

  if (!options.url) throw new Error('Missing url parameter')

  self.options = options
  self.url = options.url

  // Request instance that is used for `fetch`ing
  self.request = new Request(self.url, {
    method: 'POST'
  })
  self.request.headers.set('content-type', 'application/json')
  // Ability to override default Request
  if (options.request) self.request = options.request

  // A stack of registered listeners
  self.listeners = []
}

// to reduce file size
var proto = Client.prototype

/**
 * Send a query and get a Promise
 * @param   {String}   query
 * @param   {Object}   variables
 * @param   {Function} beforeRequest hook
 * @returns {Promise}
 */
proto.query = function (query, variables, beforeRequest) {
  var self = this

  self.request.body = JSON.stringify({
    query: query,
    variables: variables
  })

  var result = beforeRequest && beforeRequest(self.request)

  var results = self.trigger('request', self.request)
  results.push(result)

  // The 'request' or `beforeRequest` hooks may redefine response when
  // returning something
  for (var i = results.length; i--;) {
    if (typeof results[i] !== 'undefined') {
      self.trigger('data', results[i])
      return Promise.resolve(results[i])
    }
  }

  return self.fetch(self.request)
}

/**
 * For making requests
 * @param   {Object} req
 * @returns Promise
 */
proto.fetch = function (req) {
  var self = this

  return fetch(req).then(function (res) {
    self.trigger('response', res)
    return res.json()
  }).then(function (data) {
    self.trigger('data', data)
    return data
  })
}

/**
 * Register a listener.
 * @param   {String}   eventName - 'request', 'response', 'data'
 * @param   {Function} callback
 * @returns Client instance
 */
proto.on = function (eventName, callback) {
  var allowedNames = ['request', 'response', 'data']

  if (~allowedNames.indexOf(eventName)) {
    this.listeners.push([ eventName, callback ])
  }

  return this
}

/**
 * Trigger an event.
 * @param   {String} eventName - 'request', 'response', 'data'
 * @param   {mixed}  ...args
 * @returns {Array}  array of results received from each listener respectively
 */
proto.trigger = function (eventName) {
  var args = Array.prototype.slice.call(arguments, 1)
  var listeners = this.listeners
  var results = []

  for (var i = 0; i < listeners.length; i++) {
    if (listeners[i][0] === eventName) {
      results.push(listeners[i][1].apply(this, args))
    }
  }

  return results
}

module.exports = function (options) {
  return new Client(options)
}

module.exports.Client = Client
