(function () {
  var module;
  module = angular.module('chinchilla', ['ngCookies']);
  module.provider('$ch', function () {
    var endpoints;
    endpoints = {};
    this.setEndpoint = function (systemId, url) {
      return endpoints[systemId] = url;
    };
    this.$get = [
      'ChContextOperation',
      'ChObjectsOperation',
      function (ChContextOperation, ChObjectsOperation) {
        var fn;
        fn = function (subject) {
          var endpoint;
          if (_.isString(subject)) {
            endpoint = endpoints[subject];
            if (!endpoint) {
              throw new Error('no endpoint url defined for ' + subject);
            }
            return new ChContextOperation(null, { '@context': '' + endpoint + '/context/entry_point' });
          } else {
            return new ChContextOperation(null, subject);
          }
        };
        fn.o = function (objects) {
          return new ChObjectsOperation(objects);
        };
        fn.c = function () {
          var contextUrl, endpoint, model, system;
          if (arguments.length === 2) {
            system = arguments[0], model = arguments[1];
            endpoint = endpoints[system];
            if (!endpoint) {
              throw new Error('no endpoint url defined for ' + system);
            }
            return new ChContextOperation(null, { '@context': '' + endpoint + '/context/' + model });
          } else {
            contextUrl = arguments[0];
            return new ChContextOperation(null, contextUrl);
          }
        };
        return fn;
      }
    ];
    return this;
  });
  module.provider('$chTimestampedUrl', function () {
    var timestamp;
    timestamp = new Date().getTime();
    this.$get = function () {
      return function (url) {
        var uri;
        uri = new URI(url);
        uri.addQuery({ t: timestamp });
        return uri.toString();
      };
    };
    return this;
  });
  module.provider('$chSession', function () {
    var domain, opts;
    domain = null;
    opts = null;
    this.$get = [
      '$cookies',
      '$location',
      function ($cookies, $location) {
        return {
          cookieKey: 'chSessionId',
          domain: function () {
            return domain || (domain = $location.host().split('.').slice(-2).join('.'));
          },
          cookieOpts: function () {
            return opts || (opts = {
              path: '/',
              domain: this.domain(),
              expires: moment().add(1, 'year').toISOString()
            });
          },
          setSessionId: function (id) {
            $cookies.put(this.cookieKey, id, this.cookieOpts());
            return id;
          },
          getSessionId: function () {
            return $cookies.get(this.cookieKey);
          },
          clearSessionId: function () {
            return $cookies.remove(this.cookieKey, { domain: this.domain() });
          }
        };
      }
    ];
    return this;
  });
}.call(this));
(function () {
  var __hasProp = {}.hasOwnProperty, __extends = function (child, parent) {
      for (var key in parent) {
        if (__hasProp.call(parent, key))
          child[key] = parent[key];
      }
      function ctor() {
        this.constructor = child;
      }
      ctor.prototype = parent.prototype;
      child.prototype = new ctor();
      child.__super__ = parent.prototype;
      return child;
    };
  angular.module('chinchilla').factory('ChActionOperation', [
    '$q',
    '$ch',
    '$chSession',
    'ChOperation',
    'ChRequestBuilder',
    'ChLazyLoader',
    function ($q, $ch, $chSession, ChOperation, ChRequestBuilder, ChLazyLoader) {
      var ChActionOperation;
      return ChActionOperation = function (_super) {
        __extends(ChActionOperation, _super);
        function ChActionOperation($parent, $type, $action, $params, $options) {
          var error, success;
          this.$parent = $parent;
          this.$type = $type;
          this.$action = $action;
          this.$params = $params != null ? $params : {};
          this.$options = $options != null ? $options : {};
          ChOperation.init(this);
          this.$subject = null;
          this.$arr = [];
          this.$obj = {};
          this.$graph = [];
          this.$headers = {};
          if (!this.$options['withoutSession']) {
            this.$options['http'] = { headers: { 'Session-Id': $chSession.getSessionId() } };
          }
          success = function (_this) {
            return function () {
              _this.$context = _this.$parent.$context;
              if (!_.isString(_this.$parent.$subject)) {
                _this.$subject = _this.$parent.$subject;
              }
              _this.$associationData = _this.$parent.$associationData;
              _this.$associationProperty = _this.$parent.$associationProperty;
              _this.$associationType = _this.$associationProperty && _this.$associationProperty.collection ? 'collection' : 'member';
              if (_.isNull(_this.$type)) {
                _this.$type = _.isArray(_this.$associationData) || _.isArray(_this.$parent.$subject) ? 'collection' : _.isPlainObject(_this.$associationType) ? 'member' : _this.$associationType;
              }
              return _this._run();
            };
          }(this);
          error = function (_this) {
            return function () {
              return _this.$deferred.reject(_this);
            };
          }(this);
          this.$parent.$promise.then(success, error);
        }
        ChActionOperation.prototype._run = function () {
          var builder, error, flattenedAssociationData, success;
          builder = new ChRequestBuilder(this.$context, this.$subject, this.$type, this.$action, this.$options);
          if (this.$type === 'collection' && _.isArray(this.$associationData) && _.isArray(_.first(this.$associationData))) {
            flattenedAssociationData = _.flatten(this.$associationData);
            builder.extractFrom(flattenedAssociationData, 'member');
          } else if (this.$type === 'member' && _.isArray(this.$associationData)) {
            builder.extractFrom(this.$associationData, 'member');
          } else {
            builder.extractFrom(this.$associationData, this.$associationType);
          }
          builder.extractFrom(this.$subject, this.$type);
          builder.mergeParams(this.$params);
          success = function (_this) {
            return function (response) {
              var data;
              _.merge(_this.$headers, response.headers());
              if (response.data['@type'] === 'graph') {
                _.each(response.data['@graph'], function (member) {
                  return _this.$arr.push(member);
                });
                return _this._buildGraph();
              } else {
                data = response.data && response.data.members || response.data;
                if (_.isArray(data)) {
                  _.each(data, function (member) {
                    return _this.$arr.push(member);
                  });
                } else {
                  _.merge(_this.$obj, data);
                }
                _this._moveAssociations();
                return _this._initLazyLoading();
              }
            };
          }(this);
          error = function (_this) {
            return function (response) {
              _this.$response = response;
              _this.$error = response.data;
              _.merge(_this.$headers, response.headers());
              return _this.$deferred.reject(_this);
            };
          }(this);
          return builder.performRequest().then(success, error);
        };
        ChActionOperation.prototype._objects = function () {
          if (_.isEmpty(this.$obj)) {
            return this.$arr;
          } else {
            return [this.$obj];
          }
        };
        ChActionOperation.prototype._moveAssociations = function () {
          return _.each(this._objects(), function (object) {
            object.$associations || (object.$associations = {});
            return _.each(object, function (value, key) {
              if (key === '$associations') {
                return;
              }
              if (_.isArray(value) && _.isPlainObject(_.first(value)) || _.isPlainObject(value) && value['@id']) {
                object.$associations[key] = _.clone(value);
                return delete object[key];
              }
            });
          });
        };
        ChActionOperation.prototype._initLazyLoading = function () {
          var groups, promises, self;
          self = this;
          groups = _.groupBy(this._objects(), '@context');
          promises = [];
          _.each(groups, function (records, contextUrl) {
            var operation;
            operation = new self.ChObjectsOperation(records);
            operation.$promise.then(function () {
              return new ChLazyLoader(operation, records);
            });
            return promises.push(operation.$promise);
          });
          return $q.all(promises).then(function () {
            return self.$deferred.resolve(self);
          });
        };
        ChActionOperation.prototype._buildGraph = function () {
          if (_.isEmpty(this.$arr)) {
            return;
          }
          this.$graph = [];
          _.each(this.$arr, function (_this) {
            return function (node) {
              var parent;
              if (node.parent_id) {
                if (parent = _.find(_this.$arr, function (x) {
                    return x.id === node.parent_id;
                  })) {
                  node.parent = parent;
                  if (parent.children == null) {
                    parent.children = [];
                  }
                  return parent.children.push(node);
                }
              } else {
                return _this.$graph.push(node);
              }
            };
          }(this));
          return this.$deferred.resolve(this);
        };
        return ChActionOperation;
      }(ChOperation);
    }
  ]);
}.call(this));
(function () {
  angular.module('chinchilla').factory('ChContext', [
    '$log',
    function ($log) {
      var ChContext;
      return ChContext = function () {
        var isAssociation;
        isAssociation = function (property) {
        };
        function ChContext(data) {
          this.data = data != null ? data : {};
          this.context = this.data && this.data['@context'] || {};
          this.properties = this.context.properties || {};
          this.constants = this.context.constants || {};
          _.each(this.properties, function (property, name) {
            property.isAssociation = property.type && /^(http|https)\:/.test(property.type);
            return true;
          });
        }
        ChContext.prototype.property = function (name) {
          return this.properties[name];
        };
        ChContext.prototype.constant = function (name) {
          return this.constants[name];
        };
        ChContext.prototype.association = function (name) {
          var property;
          property = this.properties[name];
          return property.isAssociation && property;
        };
        ChContext.prototype.member_action = function (name) {
          var action, context;
          context = this.data && this.data['@context'];
          action = context && context.member_actions && context.member_actions[name];
          if (!action) {
            $log.warn('requested non-existing member action \'' + name + '\'');
            $log.debug(this.data);
          }
          return action;
        };
        ChContext.prototype.collection_action = function (name) {
          var action, context;
          context = this.data && this.data['@context'];
          action = context && context.collection_actions && context.collection_actions[name];
          if (!action) {
            $log.warn('requested non-existing collection action \'' + name + '\'');
            $log.debug(this.data);
          }
          return action;
        };
        return ChContext;
      }();
    }
  ]);
}.call(this));
(function () {
  var __hasProp = {}.hasOwnProperty, __extends = function (child, parent) {
      for (var key in parent) {
        if (__hasProp.call(parent, key))
          child[key] = parent[key];
      }
      function ctor() {
        this.constructor = child;
      }
      ctor.prototype = parent.prototype;
      child.prototype = new ctor();
      child.__super__ = parent.prototype;
      return child;
    };
  angular.module('chinchilla').factory('ChContextOperation', [
    '$q',
    'ChOperation',
    'ChContextService',
    'ChRequestBuilder',
    'ChUtils',
    function ($q, ChOperation, ChContextService, ChRequestBuilder, ChUtils) {
      var ChContextOperation;
      return ChContextOperation = function (_super) {
        __extends(ChContextOperation, _super);
        function ChContextOperation($parent, $subject) {
          var error, success;
          this.$parent = $parent != null ? $parent : null;
          this.$subject = $subject;
          ChOperation.init(this);
          this.$associationProperty = null;
          this.$associationData = null;
          if (this.$parent) {
            success = function (_this) {
              return function () {
                var assocData;
                if (_.isString(_this.$subject)) {
                  _this.$associationProperty = _this.$parent.$context.association(_this.$subject);
                  _this.$associationData = null;
                  assocData = function (object) {
                    return object && object.$associations && object.$associations[_this.$subject];
                  };
                  if (!_.isEmpty(_this.$parent.$arr)) {
                    _this.$associationData = _.map(_this.$parent.$arr, function (member) {
                      return assocData(member);
                    });
                  } else {
                    _this.$associationData = assocData(_this.$parent.$obj);
                  }
                }
                return _this._run();
              };
            }(this);
            error = function (_this) {
              return function () {
                return _this.$deferred.reject();
              };
            }(this);
            this.$parent.$promise.then(success, error);
          } else {
            this._run();
          }
        }
        ChContextOperation.prototype.$new = function (attrs) {
          var deferred, result;
          if (attrs == null) {
            attrs = {};
          }
          deferred = $q.defer();
          result = {
            $obj: _.extend({}, attrs),
            $deferred: deferred,
            $promise: deferred.promise
          };
          this.$promise.then(function (_this) {
            return function () {
              var action;
              if (_this.$associationData && _this.$associationProperty) {
                action = _this.$associationProperty.collection ? _this.$context.collection_action('query') : _this.$context.member_action('get');
                result.$obj.$params = ChUtils.extractValues(action, _this.$associationData);
              }
              result.$obj['@context'] = _this.$contextUrl;
              return deferred.resolve(result);
            };
          }(this));
          return result;
        };
        ChContextOperation.prototype.$r = function (type, action) {
          var deferred, result;
          deferred = $q.defer();
          result = {
            $deferred: deferred,
            $promise: deferred.promise
          };
          this.$promise.then(function (_this) {
            return function () {
              result.$request = new ChRequestBuilder(_this.$context, {}, type, action);
              return deferred.resolve(result);
            };
          }(this));
          return result;
        };
        ChContextOperation.prototype._run = function () {
          var error, success;
          this._findContextUrl(this.$subject);
          success = function (_this) {
            return function (context) {
              _this.$context = context;
              return _this.$deferred.resolve(_this);
            };
          }(this);
          error = function (_this) {
            return function () {
              return _this.$deferred.reject();
            };
          }(this);
          return ChContextService.get(this.$contextUrl).then(success, error);
        };
        return ChContextOperation;
      }(ChOperation);
    }
  ]);
}.call(this));
(function () {
  angular.module('chinchilla').factory('ChContextService', [
    '$q',
    '$http',
    '$chTimestampedUrl',
    'ChContext',
    function ($q, $http, $chTimestampedUrl, ChContext) {
      return {
        contexts: {},
        pendingRequests: {},
        get: function (url) {
          var context, deferred, error, success;
          deferred = $q.defer();
          if (context = this.contexts[url]) {
            deferred.resolve(context);
          } else {
            success = function (_this) {
              return function (response) {
                context = new ChContext(response.data);
                _this.contexts[url] = context;
                return _this._resolvePendingRequests(url, context);
              };
            }(this);
            error = function (_this) {
              return function () {
                return _this._rejectPendingRequests(url);
              };
            }(this);
            if (this.pendingRequests[url]) {
              this._addToPendingRequests(url, deferred);
            } else {
              this._addToPendingRequests(url, deferred);
              $http.get($chTimestampedUrl(url)).then(success, error);
            }
          }
          return deferred.promise;
        },
        _addToPendingRequests: function (url, deferred) {
          var _base;
          (_base = this.pendingRequests)[url] || (_base[url] = []);
          return this.pendingRequests[url].push(deferred);
        },
        _resolvePendingRequests: function (url, context) {
          return _.each(this.pendingRequests[url], function (deferred) {
            return deferred.resolve(context);
          });
        },
        _rejectPendingRequests: function (url) {
          return _.each(this.pendingRequests[url], function (deferred) {
            return deferred.reject();
          });
        }
      };
    }
  ]);
}.call(this));
(function () {
  angular.module('chinchilla').factory('ChLazyAssociation', [
    '$injector',
    '$q',
    function ($injector, $q) {
      var ChLazyAssociation;
      return ChLazyAssociation = function () {
        function ChLazyAssociation($operation, $objects, $name) {
          this.$operation = $operation;
          this.$objects = $objects;
          this.$name = $name;
          this.cache = {};
          this.deferredCache = {};
          this.isCollection = this.$operation.$context.association(this.$name).collection;
          this._initCache();
        }
        ChLazyAssociation.prototype.load = function () {
          this.contextOperation || (this.contextOperation = this.$operation.$(this.$name));
          return this.actionOperation || (this.actionOperation = this.contextOperation.$$('get').$promise.then(this._assign.bind(this)));
        };
        ChLazyAssociation.prototype.retrieve = function (object) {
          this.load();
          return this.cache[object['@id']];
        };
        ChLazyAssociation.prototype.retrievePromise = function (object) {
          return this.retrieveDeferred(object).promise;
        };
        ChLazyAssociation.prototype.retrieveDeferred = function (object) {
          var _base, _name;
          return (_base = this.deferredCache)[_name = object['@id']] || (_base[_name] = $q.defer());
        };
        ChLazyAssociation.prototype._initCache = function () {
          return _.each(this.$objects, function (_this) {
            return function (object) {
              return _this.cache[object['@id']] = _this.isCollection ? [] : {};
            };
          }(this));
        };
        ChLazyAssociation.prototype._assign = function (actionOp) {
          var associationName, backReferences, habtm, parentContextId, results, sortedResults;
          results = _.isEmpty(actionOp.$obj) ? actionOp.$arr : [actionOp.$obj];
          if (this.isCollection) {
            habtm = _.any(this.$objects, function (_this) {
              return function (object) {
                var reference;
                reference = object.$associations && object.$associations[_this.$name];
                if (!reference) {
                  return;
                }
                return _.isArray(reference);
              };
            }(this));
            if (habtm) {
              sortedResults = {};
              _.each(results, function (result) {
                return sortedResults[result['@id']] = result;
              });
              return _.each(this.$objects, function (_this) {
                return function (object) {
                  var references;
                  references = object.$associations && object.$associations[_this.$name];
                  if (!_.isArray(references)) {
                    return;
                  }
                  _.each(references, function (reference) {
                    var result;
                    result = sortedResults[reference['@id']];
                    if (!result) {
                      return;
                    }
                    return _this.cache[object['@id']].push(result);
                  });
                  return _this.retrieveDeferred(object).resolve();
                };
              }(this));
            } else {
              parentContextId = this.$operation.$context.data['@context']['@id'];
              associationName = _.findKey(this.contextOperation.$context.data['@context']['properties'], function (value, key) {
                return value && value.type && value.type === parentContextId;
              });
              associationName || (associationName = _.findKey(this.contextOperation.$context.data['@context']['properties'], function (_this) {
                return function (value, key) {
                  return value && value.inverse_of && value.inverse_of === _this.$name;
                };
              }(this)));
              backReferences = [];
              try {
                _.each(results, function (_this) {
                  return function (result) {
                    var backReference;
                    backReference = result && result.$associations && result.$associations[associationName] && result.$associations[associationName]['@id'];
                    if (!backReference) {
                      throw new Error();
                    }
                    backReferences.push(backReference);
                    return _this.cache[backReference].push(result);
                  };
                }(this));
                return _.each(backReferences, function (_this) {
                  return function (backReference) {
                    return _this.retrieveDeferred({ '@id': backReference }).resolve();
                  };
                }(this));
              } catch (_error) {
                return _.each(this.$objects, function (_this) {
                  return function (object) {
                    return _this.retrieveDeferred(object).reject();
                  };
                }(this));
              }
            }
          } else {
            sortedResults = {};
            _.each(results, function (result) {
              return sortedResults[result['@id']] = result;
            });
            return _.each(this.$objects, function (_this) {
              return function (object) {
                var requestedId, result;
                requestedId = object.$associations && object.$associations[_this.$name] && object.$associations[_this.$name]['@id'];
                if (!requestedId) {
                  return;
                }
                result = sortedResults[requestedId];
                if (!result) {
                  return;
                }
                _this.cache[object['@id']] = result;
                return _this.retrieveDeferred(object).resolve();
              };
            }(this));
          }
        };
        return ChLazyAssociation;
      }();
    }
  ]);
}.call(this));
(function () {
  angular.module('chinchilla').factory('ChLazyLoader', [
    'ChLazyAssociation',
    function (ChLazyAssociation) {
      var ChLazyLoader;
      return ChLazyLoader = function () {
        function ChLazyLoader($operation, $objects) {
          this.$operation = $operation;
          this.$objects = $objects != null ? $objects : [];
          this.$cache = {};
          this._turnLazy();
        }
        ChLazyLoader.prototype._turnLazy = function () {
          var self;
          self = this;
          return _.each(this.$objects, function (object) {
            if (!object.$associations) {
              return;
            }
            return _.each(object.$associations, function (value, key) {
              Object.defineProperty(object, key, {
                get: function () {
                  return self._association(key).retrieve(object);
                }
              });
              return Object.defineProperty(object, '' + key + 'Promise', {
                get: function () {
                  return self._association(key).retrievePromise(object);
                }
              });
            });
          });
        };
        ChLazyLoader.prototype._association = function (name) {
          var _base;
          return (_base = this.$cache)[name] || (_base[name] = new ChLazyAssociation(this.$operation, this.$objects, name));
        };
        return ChLazyLoader;
      }();
    }
  ]);
}.call(this));
(function () {
  var __hasProp = {}.hasOwnProperty, __extends = function (child, parent) {
      for (var key in parent) {
        if (__hasProp.call(parent, key))
          child[key] = parent[key];
      }
      function ctor() {
        this.constructor = child;
      }
      ctor.prototype = parent.prototype;
      child.prototype = new ctor();
      child.__super__ = parent.prototype;
      return child;
    };
  angular.module('chinchilla').factory('ChObjectsOperation', [
    'ChOperation',
    'ChContextService',
    function (ChOperation, ChContextService) {
      var ChObjectsOperation;
      return ChObjectsOperation = function (_super) {
        __extends(ChObjectsOperation, _super);
        function ChObjectsOperation($objects) {
          this.$objects = $objects;
          ChOperation.init(this);
          this.$arr = [];
          this.$obj = {};
          this.$headers = {};
          this.$contextUrl = null;
          if (_.isArray(this.$objects)) {
            this.$arr = this.$objects;
          } else {
            this.$obj = this.$objects;
          }
          this._run();
        }
        ChObjectsOperation.prototype._run = function () {
          var error, success;
          this._findContextUrl(this.$objects);
          success = function (_this) {
            return function (context) {
              _this.$context = context;
              return _this.$deferred.resolve(_this);
            };
          }(this);
          error = function (_this) {
            return function () {
              return _this.$deferred.reject();
            };
          }(this);
          return ChContextService.get(this.$contextUrl).then(success, error);
        };
        return ChObjectsOperation;
      }(ChOperation);
    }
  ]);
}.call(this));
(function () {
  angular.module('chinchilla').factory('ChOperation', [
    '$q',
    '$injector',
    function ($q, $injector) {
      var ChOperation;
      return ChOperation = function () {
        function ChOperation() {
        }
        ChOperation.init = function (instance) {
          instance.$context = null;
          instance.$error = {};
          instance.$deferred = $q.defer();
          instance.$promise = instance.$deferred.promise;
          instance.ChContextOperation = $injector.get('ChContextOperation');
          instance.ChActionOperation = $injector.get('ChActionOperation');
          return instance.ChObjectsOperation = $injector.get('ChObjectsOperation');
        };
        ChOperation.prototype.$ = function (subject) {
          var contextOp;
          return contextOp = new this.ChContextOperation(this, subject);
        };
        ChOperation.prototype.$$ = function (action, params, options) {
          if (params == null) {
            params = {};
          }
          if (options == null) {
            options = {};
          }
          return new this.ChActionOperation(this, null, action, params, options);
        };
        ChOperation.prototype.$c = function (action, params, options) {
          if (params == null) {
            params = {};
          }
          if (options == null) {
            options = {};
          }
          return new this.ChActionOperation(this, 'collection', action, params, options);
        };
        ChOperation.prototype.$m = function (action, params, options) {
          if (params == null) {
            params = {};
          }
          if (options == null) {
            options = {};
          }
          return new this.ChActionOperation(this, 'member', action, params, options);
        };
        ChOperation.prototype._findContextUrl = function (subject) {
          var first;
          this.$contextUrl = null;
          if (_.isString(subject)) {
            this.$contextUrl = this.$associationProperty && this.$associationProperty.type;
            if (!this.$contextUrl) {
              throw new Error('ChContextOperation#_findContextUrl: no association \'' + subject + '\' found');
            }
          } else if (_.isArray(subject)) {
            first = _.first(subject);
            this.$contextUrl = first && first['@context'];
            if (!first || !this.$contextUrl) {
              console.log(this);
              throw new Error('ChContextOperation#_findContextUrl: empty array of objects given or missing context');
            }
          } else if (_.isPlainObject(subject)) {
            this.$contextUrl = subject['@context'];
            if (!this.$contextUrl) {
              console.log(this);
              throw new Error('ChContextOperation#_findContextUrl: missing context');
            }
          } else {
            console.log(this);
            throw new Error('ChContextOperation#_findContextUrl: unsupported subject');
          }
        };
        return ChOperation;
      }();
    }
  ]);
}.call(this));
(function () {
  angular.module('chinchilla').factory('ChRequestBuilder', [
    '$q',
    '$injector',
    '$http',
    '$chTimestampedUrl',
    'ChUtils',
    function ($q, $injector, $http, $chTimestampedUrl, ChUtils) {
      var ChRequestBuilder;
      return ChRequestBuilder = function () {
        function ChRequestBuilder($context, $subject, $type, $actionName, $options) {
          this.$context = $context;
          this.$subject = $subject;
          this.$type = $type;
          this.$actionName = $actionName;
          this.$options = $options != null ? $options : {};
          this.$mergedParams = {};
          this.$action = this.$type === 'collection' ? this.$context.collection_action(this.$actionName) : this.$context.member_action(this.$actionName);
        }
        ChRequestBuilder.prototype.extractFrom = function (source, type) {
          var first, params;
          params = _.isArray(source) && type === 'member' ? this._extractMemberArray(source) : _.isArray(source) && type === 'collection' ? (first = _.first(source), _.has(first, '@context') ? this._extractMemberArray(source) : this._extractCollectionArray(source)) : type === 'collection' ? this._extractCollection(source) : this._extractMember(source);
          this.mergeParams(params);
          return params;
        };
        ChRequestBuilder.prototype.mergeParams = function (params) {
          return _.merge(this.$mergedParams, params || {});
        };
        ChRequestBuilder.prototype.performRequest = function () {
          var data, options;
          data = _.include([
            'POST',
            'PUT',
            'PATCH'
          ], this.$action.method) ? this.data() : null;
          options = _.merge({}, {
            method: this.$action.method,
            url: $chTimestampedUrl(this.buildUrl()),
            data: data
          }, this.$options['http']);
          return $http(options);
        };
        ChRequestBuilder.prototype.buildUrl = function () {
          var uriTmpl;
          uriTmpl = new UriTemplate(this.$action.template);
          return uriTmpl.fillFromObject(this._buildParams());
        };
        ChRequestBuilder.prototype.data = function () {
          var data;
          if (this.$options['raw']) {
            return this._cleanup(this.$subject);
          } else if (_.isArray(this.$subject)) {
            data = {};
            _.each(this.$subject, function (_this) {
              return function (obj) {
                return data[obj.id] = _this._remapAttributes(_this._cleanup(obj));
              };
            }(this));
            return data;
          } else {
            return this._cleanup(this._remapAttributes(this.$subject));
          }
        };
        ChRequestBuilder.prototype._cleanup = function (object) {
          var newObject, self;
          self = this;
          newObject = {};
          _.each(object, function (v, k) {
            var obj, subset;
            if (/^\$/.test(k) || k === 'errors' || k === 'isPristine' || _.isFunction(v)) {
            } else if (_.isArray(v)) {
              if (_.isPlainObject(v[0])) {
                subset = _.map(v, function (x) {
                  return self._cleanup(x);
                });
                return newObject[k] = _.reject(subset, function (x) {
                  return _.isEmpty(x);
                });
              } else {
                return newObject[k] = v;
              }
            } else if (_.isPlainObject(v)) {
              obj = self._cleanup(v);
              if (!_.isEmpty(obj)) {
                return newObject[k] = obj;
              }
            } else {
              return newObject[k] = v;
            }
          });
          return newObject;
        };
        ChRequestBuilder.prototype._remapAttributes = function (object) {
          var self;
          self = this;
          return _.each(object, function (value, key) {
            var values;
            if (_.isString(value) && /(^tags|_ids$)/.test(key)) {
              values = _.select(value.split(','), function (item) {
                return !_.isEmpty(item);
              });
              return object[key] = values;
            } else if (_.isObject(value)) {
              object['' + key + '_attributes'] = value;
              return delete object[key];
            }
          });
        };
        ChRequestBuilder.prototype._buildParams = function () {
          var mappings, result;
          mappings = this.$action.mappings;
          result = {};
          _.each(mappings, function (_this) {
            return function (mapping) {
              var value;
              value = _this.$mergedParams[mapping.source] || _this.$mergedParams[mapping.variable];
              if (!value) {
                return;
              }
              return result[mapping.variable] = value;
            };
          }(this));
          return result;
        };
        ChRequestBuilder.prototype._extractMemberArray = function (source) {
          var action;
          action = this.$context.member_action('get');
          if (_.isEmpty(source) || _.isEmpty(action)) {
            return {};
          }
          return ChUtils.extractArrayValues(action, source);
        };
        ChRequestBuilder.prototype._extractCollectionArray = function (source) {
          var action;
          action = this.$context.collection_action('query');
          if (_.isEmpty(source) || _.isEmpty(action)) {
            return {};
          }
          return ChUtils.extractArrayValues(action, source);
        };
        ChRequestBuilder.prototype._extractCollection = function (source) {
          var action;
          action = this.$context.collection_action('query');
          if (_.isEmpty(source) || _.isEmpty(action)) {
            return {};
          }
          return ChUtils.extractValues(action, source);
        };
        ChRequestBuilder.prototype._extractMember = function (source) {
          var action;
          action = this.$context.member_action('get');
          if (_.isEmpty(source) || _.isEmpty(action)) {
            return {};
          }
          return ChUtils.extractValues(action, source);
        };
        return ChRequestBuilder;
      }();
    }
  ]);
}.call(this));
(function () {
  angular.module('chinchilla').factory('ChUtils', function () {
    var ChUtils;
    return ChUtils = function () {
      function ChUtils() {
      }
      ChUtils.extractValues = function (action, object) {
        var id, mappings, result, template, values;
        id = object && object['@id'];
        if (!id) {
          return {};
        }
        result = {};
        template = new UriTemplate(action.template);
        values = template.fromUri(id);
        if (_.isEmpty(values)) {
          return {};
        }
        mappings = action.mappings;
        _.each(mappings, function (mapping) {
          var value;
          value = values[mapping.variable];
          if (!value) {
            return;
          }
          return result[mapping.source] = value;
        });
        return result;
      };
      ChUtils.extractArrayValues = function (action, objects) {
        var mappings, result, values;
        mappings = action.mappings;
        values = _.map(objects, function (obj) {
          return ChUtils.extractValues(action, obj);
        });
        values = _.compact(values);
        result = {};
        _.each(mappings, function (mapping) {
          result[mapping.source] = [];
          return _.each(values, function (attrs) {
            if (!attrs[mapping.source]) {
              return;
            }
            if (_.include(result[mapping.source], attrs[mapping.source])) {
              return;
            }
            return result[mapping.source].push(attrs[mapping.source]);
          });
        });
        return result;
      };
      return ChUtils;
    }();
  });
}.call(this));