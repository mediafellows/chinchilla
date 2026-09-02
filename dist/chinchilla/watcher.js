"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Watcher = void 0;
const lodash_1 = require("lodash");
let actions = [];
let listeners = [];
const next = () => {
    const cb = listeners.pop();
    cb && (0, lodash_1.delay)(cb, 100);
};
exports.Watcher = {
    actions: actions,
    listeners: listeners,
    start: (id) => {
        actions = (0, lodash_1.concat)(actions, id);
    },
    complete: (id) => {
        actions = (0, lodash_1.without)(actions, id);
        if (actions.length === 0)
            next();
    },
    performLater: (cb) => {
        (0, lodash_1.delay)(() => {
            listeners.push(cb);
            if (actions.length === 0)
                next();
        }, 100);
    }
};
