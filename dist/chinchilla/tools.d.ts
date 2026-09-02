import { Config } from './config';
export declare class Tools {
    static get isNode(): boolean;
    static get req(): any;
    static handleError(err: any, res: any, config: Config): (boolean | Error)[];
}
