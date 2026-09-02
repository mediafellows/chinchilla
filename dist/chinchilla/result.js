"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Result = void 0;
const lodash_1 = require("lodash");
const subject_1 = require("./subject");
class Result {
    constructor() {
        this.objects = [];
    }
    success(result, config, options) {
        this.headers = result.headers;
        this.body = result.body;
        this.options = options || {};
        if (result.body) {
            this.type = result.body['@type'];
            this.aggregations = result.body['aggregations'];
        }
        switch (this.type) {
            case 'graph':
                var members = result.body['@graph'];
                if (!members)
                    return;
                new subject_1.Subject(members, config);
                (0, lodash_1.each)(members, (node) => {
                    if (node.parent_id) {
                        // this is a child
                        var parent = (0, lodash_1.find)(members, (x) => {
                            return x.id === node.parent_id;
                        });
                        if (parent) {
                            if (!parent.children)
                                parent.children = [];
                            parent.children.push(node);
                        }
                        return true; // continue loop
                    }
                    else {
                        // root
                        this.objects.push(node);
                    }
                });
                break;
            case 'collection':
            case 'search_collection':
                this.pagination = {};
                (0, lodash_1.each)(Result.paginationProps, (prop) => {
                    if (result.body[prop]) {
                        this.pagination[prop.substr(1)] = result.body[prop];
                    }
                });
                (0, lodash_1.each)(result.body.members, (member) => {
                    this.objects.push(member);
                });
                if (this.options.rawResult)
                    break;
                var byContext = (0, lodash_1.groupBy)(this.objects, '@context');
                // creates new Subject for each group ob objects that share the same @context
                (0, lodash_1.each)(byContext, (objects) => {
                    new subject_1.Subject(objects, config);
                });
                break;
            default:
                this.objects = (0, lodash_1.isArray)(result.body) ? result.body : [result.body];
                if (result.body && !this.options.rawResult)
                    new subject_1.Subject(this.object, config);
                break;
        }
    }
    get object() {
        return (0, lodash_1.first)(this.objects);
    }
}
exports.Result = Result;
Result.paginationProps = ['@total_count', '@total_pages', '@current_page'];
