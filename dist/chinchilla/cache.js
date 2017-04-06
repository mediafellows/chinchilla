"use strict";
const lodash_1 = require("lodash");
class Cache {
    static generateKey(type) {
        var hash = Math.random().toString(36).substr(2, 9);
        return `${type}-${hash}`;
    }
    static add(key, obj) {
        Cache.cache[key] = obj;
        Cache.cacheOrder.push(key);
        Cache.capCache();
    }
    static get(key) {
        return Cache.cache[key];
    }
    static clear() {
        Cache.cache = {};
        Cache.cacheOrder = [];
    }
    static capCache() {
        var sliced = Cache.sliceCache(Cache.cacheOrder, Cache.cacheSize);
        lodash_1.each(sliced.remove, (key) => {
            if (lodash_1.isFunction(Cache.cache[key]['destroy']))
                Cache.cache[key].destroy();
            delete Cache.cache[key];
        });
        Cache.cacheOrder = sliced.remain;
    }
    static sliceCache(arr, size) {
        if (arr.length <= size)
            return { remove: [], remain: arr };
        var remain = arr.slice(size * -1);
        return {
            remain: remain,
            remove: lodash_1.difference(arr, remain)
        };
    }
}
Cache.cacheSize = 250;
Cache.cacheOrder = [];
Cache.cache = {};
exports.Cache = Cache;