/// <reference path="../typings/promise.d.ts" />
/// <reference path="../typings/uriTemplate.d.ts" />
declare var _: any;
declare var Cookies: any;
declare module Chinchilla {
    class Config {
        static endpoints: {};
        static timestamp: number;
        static domain: string;
        static sessionId: string;
        static sessionKey: string;
        static addEndpoint(name: string, url: string): void;
        static setCookieDomain(domain: string): void;
        static setSessionId(id: string): void;
        static getSessionId(): string;
        static clearSessionId(): void;
    }
}
declare var _: any;
declare var request: any;
declare module Chinchilla {
    class ContextAction {
        resource: string;
        response: string;
        template: string;
        expects: Object;
        mappings: Object[];
        constructor(values?: {});
    }
    class ContextMemberAction extends ContextAction {
    }
    class ContextCollectionAction extends ContextAction {
    }
    interface ContextProperty {
        collection: boolean;
        exportable: boolean;
        readable: boolean;
        writable: boolean;
        isAssociation: boolean;
        type: string;
        required?: boolean;
        validations?: any[];
    }
    class Context {
        static cache: {};
        ready: Promise<Context>;
        data: any;
        context: any;
        id: string;
        properties: any;
        constants: any;
        constructor(contextUrl: string);
        property(name: string): ContextProperty;
        constant(name: string): any;
        association(name: string): ContextProperty;
        memberAction(name: string): ContextMemberAction;
        collectionAction(name: string): ContextCollectionAction;
    }
}
declare var _: any;
declare module Chinchilla {
    class Result {
        headers: any;
        data: any;
        objects: any[];
        success(result: any): void;
        object: any;
    }
}
declare var _: any;
declare var request: any;
declare module Chinchilla {
    class Action {
        ready: Promise<Result>;
        params: Object;
        body: Object;
        uriTmpl: UriTemplate;
        result: Result;
        constructor(uri: string, params?: {}, body?: {});
        private cleanupBody();
    }
}
declare var _: any;
declare module Chinchilla {
    class Extractor {
        static extractMemberParams(context: Context, obj: any): Object;
        static extractCollectionParams(context: Context, obj: any): Object;
        static uriParams(action: ContextAction, params?: {}): Object;
        private static extractParams(contextAction, obj);
        private static extractValues(contextAction, object);
        private static extractArrayValues(contextAction, objects);
    }
}
declare var _: any;
declare module Chinchilla {
    class Association {
        subject: Subject;
        name: string;
        ready: Promise<Context>;
        associationData: any;
        habtm: boolean;
        context: Context;
        associationProperty: ContextProperty;
        cache: Object;
        static cache: {};
        constructor(subject: Subject, name: string);
        static get(subject: Subject, name: string): any;
        getDataFor(object: Object): any;
        private fillCache(result);
        private associationParams();
        private readAssociationData();
    }
}
declare var _: any;
declare module Chinchilla {
    class Subject {
        objects: any[];
        contextUrl: string;
        id: string;
        _context: Context;
        constructor(objects: any);
        memberAction(name: string, inputParams: any): Promise<Context>;
        collectionAction(name: string, inputParams: any): Promise<Context>;
        association(name: string): Association;
        context: Context;
        object: Object;
        extractedParams: Object;
        private addObjects(objects);
        private moveAssociationReferences(object);
        private initAssociationGetters(object);
    }
}
