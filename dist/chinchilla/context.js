"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
const Promise = require("bluebird");
const config_1 = require("./config");
const cache_1 = require("./cache");
const tools_1 = require("./tools");
class ContextAction {
    constructor(values = {}) {
        lodash_1.each(values, (value, key) => {
            this[key] = value;
        });
    }
}
exports.ContextAction = ContextAction;
class ContextMemberAction extends ContextAction {
}
exports.ContextMemberAction = ContextMemberAction;
class ContextCollectionAction extends ContextAction {
}
exports.ContextCollectionAction = ContextCollectionAction;
class Context {
    static get(contextUrl) {
        let key = lodash_1.first(contextUrl.split('?'));
        let cachedContext;
        if (cachedContext = cache_1.Cache.runtime.get(key)) {
            return cachedContext;
        }
        let dataPromise;
        let cachedData;
        if (!tools_1.Tools.isNode && (cachedData = cache_1.Cache.storage.get(key))) {
            dataPromise = Promise.resolve(cachedData);
        }
        else {
            dataPromise = new Promise((resolve, reject) => {
                var req = tools_1.Tools.req
                    .get(contextUrl)
                    .query({ t: config_1.Config.timestamp });
                if (config_1.Config.getSessionId()) {
                    req = req.set('Session-Id', config_1.Config.getSessionId());
                }
                if (config_1.Config.getAffiliationId()) {
                    req = req.set('Affiliation-Id', config_1.Config.getAffiliationId());
                }
                if (config_1.Config.getRoleId()) {
                    req = req.set('Role-Id', config_1.Config.getRoleId());
                }
                if (config_1.Config.getFlavours()) {
                    req = req.set('Mpx-Flavours', config_1.Config.getFlavours());
                }
                req
                    .end((err, res) => {
                    if (err) {
                        var error = tools_1.Tools.errorResult(err, res);
                        if (config_1.Config.errorInterceptor) {
                            // if error interceptor returns true, then abort (don't resolve nor reject)
                            if (config_1.Config.errorInterceptor(error))
                                return;
                        }
                        return reject(error);
                    }
                    return resolve(res.body);
                });
            });
        }
        if (!tools_1.Tools.isNode) {
            dataPromise.then((data) => {
                return cache_1.Cache.storage.set(key, data);
            });
        }
        cachedContext = new Context(dataPromise);
        cache_1.Cache.runtime.set(key, cachedContext);
        return cachedContext;
    }
    constructor(dataPromise) {
        this.ready = dataPromise.then((data) => {
            this.data = data;
            lodash_1.each(this.properties, function (property, name) {
                property.isAssociation = property.type && /^(http|https)\:/.test(property.type);
            });
            return this;
        });
    }
    get context() {
        return this.data && this.data['@context'] || {};
    }
    get id() {
        return this.context['@id'];
    }
    get properties() {
        return this.context.properties || {};
    }
    get constants() {
        return this.context.constants || {};
    }
    property(name) {
        return this.properties[name];
    }
    constant(name) {
        return this.constants[name];
    }
    association(name) {
        var property = this.property(name);
        return property.isAssociation && property;
    }
    memberAction(name) {
        var action = this.context && this.context.member_actions && this.context.member_actions[name];
        if (!action) {
            console.log(`requested non-existing member action ${name}`);
            return;
        }
        return new ContextMemberAction(action);
    }
    collectionAction(name) {
        var action = this.context && this.context.collection_actions && this.context.collection_actions[name];
        if (!action) {
            console.log(`requested non-existing collection action ${name}`);
            return;
        }
        return new ContextCollectionAction(action);
    }
}
exports.Context = Context;
