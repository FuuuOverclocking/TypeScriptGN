import { SyntaxKind, TokenFlags } from './types';
import { assert } from './util';

interface ScannerLike {
    getScanner(): Scanner;

    /************ states ************/
    /** text to be lexical analyzed */
    readonly text: string;
    /** start position of whitespace before current token */
    readonly startPos: number;
    /** start position of text of current token */
    readonly tokenPos: number;
    /** end position of text of current token */
    readonly pos: number;
    readonly token: SyntaxKind;
    readonly tokenText: string;
    readonly tokenValue: string | undefined;
    readonly tokenFlags: TokenFlags;
    /********************************/

    setTextRange(start: number, length?: number): void;
    resetText(newText: string): void;
    resetPos(newPos: number): void;

    hasPrecedingLineBreak(): boolean;
    isIdentifier(): boolean;
    isReservedWord(): boolean;
    isUnterminated(): boolean;

    /** Scan next token and move forward. */
    scan(): SyntaxKind;

    setOnError(onError: ErrorCallback | undefined): void;

    /**
     * Invokes the provided callback. If the callback returns
     * something falsy, then it restores the scanner to the
     * state it was in immediately prior to invoking the
     * callback. If the callback returns something truthy,
     * then the scanner state is not rolled back. The result
     * of invoking the callback is returned from this function.
     */
    tryScan<T>(callback: () => T): T;

    /**
     * Invokes the provided callback then unconditionally
     * restores the scanner to the state it was in immediately
     * prior to invoking the callback.  The result of invoking
     * the callback is returned from this function.
     */
    lookAhead<T>(callback: () => T): T;

    /**
     * Invokes the callback with the scanner set to scan the
     * specified range. When the callback returns, the scanner
     * is restored to the state it was in before scanRange was
     * called.
     */
    scanRange<T>(start: number, length: number, callback: () => T): T;
}
type ErrorCallback = (message: any, length: number) => void;

/* Global variable as the state of scanner */
let text = '';
let startPos = 0;
let tokenPos = 0;
let pos = 0;
let end = 0; // end position of text
let token: SyntaxKind = SyntaxKind.Unknown;
let tokenValue: string | undefined = undefined;
let tokenFlags: TokenFlags = TokenFlags.None;

class Scanner implements ScannerLike {
    private static _theOnlyInstance: Scanner | undefined;
    getScanner(): Scanner {
        if (!Scanner._theOnlyInstance) {
            Scanner._theOnlyInstance = new Scanner();
        }
        return Scanner._theOnlyInstance;
    }

    get text() { return text; }
    resetText(newText: string) {
        text = newText ?? '';
        end = newText.length;
        this.resetPos(0);
    }
    setTextRange(start: number, length?: number) {
        end = length === undefined
            ? text.length
            : start + length;
        this.resetPos(start);
    }

    get startPos() { return startPos; }

    get tokenPos() { return tokenPos; }

    get pos() { return pos; }
    resetPos(newPos: number) {
        assert(newPos >= 0);
        pos = startPos = tokenPos = newPos;
        token = SyntaxKind.Unknown;
        tokenValue = undefined;
        tokenFlags = TokenFlags.None;
    }

    get token() { return token; }
    get tokenText() {
        return text.substring(tokenPos, pos);
    }
    get tokenValue() { return tokenValue; }
    get tokenFlags() { return tokenFlags; }

    hasPrecedingLineBreak() {
        return (tokenFlags & TokenFlags.PrecedingLineBreak) !== 0;
    }
    isIdentifier() {
        return token === SyntaxKind.Identifier
            || token > SyntaxKind.LastReservedWord;
    }
    isReservedWord() {
        return token >= SyntaxKind.FirstReservedWord
            && token <= SyntaxKind.LastReservedWord;
    }
    isUnterminated() {
        return (tokenFlags & TokenFlags.Unterminated) !== 0;
    }
}
