/* tslint:disable */
/* eslint-disable */

export class ZcashWatcher {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * `GetTransaction` response body → JSON `Decrypted`.
     */
    decryptTransaction(body: Uint8Array): string;
    constructor(ufvk: string);
    /**
     * `GetBlockRange` response body → JSON `Scan`.
     */
    scanBlockRange(body: Uint8Array): string;
}

export function blockRangeRequest(from: bigint, to: bigint): Uint8Array;

export function latestBlockRequest(): Uint8Array;

/**
 * `GetLatestBlock` response body → JSON `{ height, hash }`.
 */
export function parseLatestBlock(body: Uint8Array): string;

export function transactionRequest(txid: string): Uint8Array;
