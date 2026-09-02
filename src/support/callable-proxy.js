'use strict'

module.exports = function CallableProxy(target, handler) {
  var proxy = function () {
    return handler.apply(target, this, Array.prototype.slice.call(arguments))
  }

  Object.keys(target).forEach(function (key) {
    proxy[key] = target[key]
  })
  proxy.prototype = target.prototype

  return proxy
}
