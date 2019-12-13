import { assert, isDigit, isLineBreak, isOctalDigit, isBinaryDigit, isHexDigit, isIdentifierStart, isIdentifierPart, checkReservedWord } from './util';
import { CharacterCodes, SyntaxKind, TokenFlags, SyntaxKindMarker } from './lang-types';

interface ScannerLike {
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

    /** Scan next token and move forward. */
    scan(): SyntaxKind;

    setOnError(onError: ErrorCallback | undefined): void;

    /**
     * Invokes the provided callback.  If the callback returns
     * something falsy,    then it restores the scanner to the
     * state it was in immediately prior to invoking the
     * callback.      If the callback returns something truthy,
     * then the scanner state is not rolled back.   The result
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

type ErrorCallback = (message: string, length: number) => void;

/* Global variable as the state of scanner */
let text = '';
let startPos = 0;
let tokenPos = 0;
let pos = 0;
let end = 0; // end position of text
let token: SyntaxKind = SyntaxKind.Unknown;
let tokenValue: string | undefined = undefined;
let tokenFlags: TokenFlags = TokenFlags.None;

/**
 * Stores the current context then invokes the callback.
 * If the callback returns false, the scanner is restored
 * to the state it was in before helper function was called.
 */
function protectContextHelper(
    callback: () => /* should not restore context */ boolean
) {
    const saveEnd = end;
    const savePos = pos;
    const saveStartPos = startPos;
    const saveTokenPos = tokenPos;
    const saveToken = token;
    const saveTokenValue = tokenValue;
    const saveTokenFlags = tokenFlags;

    if (callback()) return;

    end = saveEnd;
    pos = savePos;
    startPos = saveStartPos;
    tokenPos = saveTokenPos;
    token = saveToken;
    tokenValue = saveTokenValue;
    tokenFlags = saveTokenFlags;
}

export class Scanner implements ScannerLike {
    private static _theOnlyInstance: Scanner | undefined;
    static getScanner(): Scanner {
        return Scanner._theOnlyInstance =
            Scanner._theOnlyInstance ?? new Scanner();
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

    /** lazy evaluation */
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
            || token > SyntaxKindMarker.LastReservedWord;
    }
    isReservedWord() {
        return token >= SyntaxKindMarker.FirstReservedWord
            && token <= SyntaxKindMarker.LastReservedWord;
    }

    private onError: ErrorCallback | undefined;
    setOnError(onError: ErrorCallback | undefined) {
        this.onError = onError;
    }


    tryScan<T>(callback: () => T): T {
        let result: T;
        protectContextHelper(() => {
            result = callback();
            return !!result;
        });
        return result!;
    }

    lookAhead<T>(callback: () => T): T {
        let result: T;
        protectContextHelper(() => {
            result = callback();
            return false;
        });
        return result!;
    }

    scanRange<T>(start: number, length: number, callback: () => T): T {
        let result: T;
        protectContextHelper(() => {
            this.setTextRange(start, length);
            result = callback();
            return false;
        });
        return result!;
    }


    private error(message: string, errPos = pos, length?: number) {
        if (this.onError) {
            const oldPos = pos;
            pos = errPos;
            this.onError(message, length || 0);
            pos = oldPos;
        }
    }

    scan(): SyntaxKind {
        startPos = pos;
        tokenFlags = TokenFlags.None;
        while (true) {
            tokenPos = pos;
            if (pos >= end) {
                return token = SyntaxKind.EndOfFileToken;
            }
            let ch = text.codePointAt(pos)!;

            switch (ch) {
                case CharacterCodes.lineFeed:
                case CharacterCodes.carriageReturn:
                    tokenFlags |= TokenFlags.PrecedingLineBreak;
                    pos++;
                    continue;

                case CharacterCodes.tab:
                case CharacterCodes.verticalTab:
                case CharacterCodes.formFeed:
                case CharacterCodes.space:
                    pos++;
                    continue;

                case CharacterCodes.exclamation:
                    if (text.charCodeAt(pos + 1) === CharacterCodes.equals) {
                        if (text.charCodeAt(pos + 2) === CharacterCodes.equals) {
                            return pos += 3, token = SyntaxKind.ExclamationEqualsEqualsToken;
                        }
                        return pos += 2, token = SyntaxKind.ExclamationEqualsToken;
                    }
                    pos++;
                    return token = SyntaxKind.ExclamationToken;
                case CharacterCodes.percent:
                    if (text.charCodeAt(pos + 1) === CharacterCodes.equals) {
                        return pos += 2, token = SyntaxKind.PercentEqualsToken;
                    }
                    pos++;
                    return token = SyntaxKind.PercentToken;
                case CharacterCodes.ampersand:
                    if (text.charCodeAt(pos + 1) === CharacterCodes.ampersand) {
                        return pos += 2, token = SyntaxKind.AmpersandAmpersandToken;
                    }
                    if (text.charCodeAt(pos + 1) === CharacterCodes.equals) {
                        return pos += 2, token = SyntaxKind.AmpersandEqualsToken;
                    }
                    pos++;
                    return token = SyntaxKind.AmpersandToken;
                case CharacterCodes.openParen:
                    pos++;
                    return token = SyntaxKind.OpenParenToken;
                case CharacterCodes.closeParen:
                    pos++;
                    return token = SyntaxKind.CloseParenToken;
                case CharacterCodes.asterisk:
                    if (text.charCodeAt(pos + 1) === CharacterCodes.equals) {
                        return pos += 2, token = SyntaxKind.AsteriskEqualsToken;
                    }
                    if (text.charCodeAt(pos + 1) === CharacterCodes.asterisk) {
                        if (text.charCodeAt(pos + 2) === CharacterCodes.equals) {
                            return pos += 3, token = SyntaxKind.AsteriskAsteriskEqualsToken;
                        }
                        return pos += 2, token = SyntaxKind.AsteriskAsteriskToken;
                    }
                    pos++;
                    return token = SyntaxKind.AsteriskToken;
                case CharacterCodes.plus:
                    if (text.charCodeAt(pos + 1) === CharacterCodes.plus) {
                        return pos += 2, token = SyntaxKind.PlusPlusToken;
                    }
                    if (text.charCodeAt(pos + 1) === CharacterCodes.equals) {
                        return pos += 2, token = SyntaxKind.PlusEqualsToken;
                    }
                    pos++;
                    return token = SyntaxKind.PlusToken;
                case CharacterCodes.comma:
                    pos++;
                    return token = SyntaxKind.CommaToken;
                case CharacterCodes.minus:
                    if (text.charCodeAt(pos + 1) === CharacterCodes.minus) {
                        return pos += 2, token = SyntaxKind.MinusMinusToken;
                    }
                    if (text.charCodeAt(pos + 1) === CharacterCodes.equals) {
                        return pos += 2, token = SyntaxKind.MinusEqualsToken;
                    }
                    if (text.charCodeAt(pos + 1) === CharacterCodes.greaterThan) {
                        return pos += 2, token = SyntaxKind.MinusGreaterThanToken;
                    }
                    pos++;
                    return token = SyntaxKind.MinusToken;
                case CharacterCodes.dot:
                    if (isDigit(text.charCodeAt(pos + 1))) {
                        tokenValue = this.scanNumber();
                        return token = SyntaxKind.NumericLiteral;
                    }
                    if (text.charCodeAt(pos + 1) === CharacterCodes.dot && text.charCodeAt(pos + 2) === CharacterCodes.dot) {
                        return pos += 3, token = SyntaxKind.DotDotDotToken;
                    }
                    pos++;
                    return token = SyntaxKind.DotToken;
                case CharacterCodes.slash:
                    // Single-line comment
                    if (text.charCodeAt(pos + 1) === CharacterCodes.slash) {
                        pos += 2;
                        while (pos < end) {
                            if (isLineBreak(text.charCodeAt(pos))) {
                                break;
                            }
                            pos++;

                        }
                        continue;
                    }
                    // Multi-line comment
                    if (text.charCodeAt(pos + 1) === CharacterCodes.asterisk) {
                        pos += 2;
                        let commentClosed = false;
                        while (pos < end) {
                            const ch = text.charCodeAt(pos);
                            if (ch === CharacterCodes.asterisk && text.charCodeAt(pos + 1) === CharacterCodes.slash) {
                                pos += 2;
                                commentClosed = true;
                                break;
                            }
                            if (isLineBreak(ch)) {
                                tokenFlags |= TokenFlags.PrecedingLineBreak;
                            }
                            pos++;
                        }
                        if (!commentClosed) {
                            this.error('"*/" expected');
                        }
                        continue;
                    }
                    if (text.charCodeAt(pos + 1) === CharacterCodes.equals) {
                        return pos += 2, token = SyntaxKind.SlashEqualsToken;
                    }
                    pos++;
                    return token = SyntaxKind.SlashToken;

                case CharacterCodes.colon:
                    if (text.charCodeAt(pos + 1) === CharacterCodes.equals) {
                        return pos += 2, token = SyntaxKind.ColonToken;
                    }
                    pos++;
                    return token = SyntaxKind.ColonToken;
                case CharacterCodes.semicolon:
                    pos++;
                    return token = SyntaxKind.SemicolonToken;
                case CharacterCodes.lessThan:
                    if (text.charCodeAt(pos + 1) === CharacterCodes.lessThan) {
                        if (text.charCodeAt(pos + 2) === CharacterCodes.equals) {
                            return pos += 3, token = SyntaxKind.LessThanLessThanEqualsToken;
                        }
                        return pos += 2, token = SyntaxKind.LessThanLessThanToken;
                    }
                    if (text.charCodeAt(pos + 1) === CharacterCodes.equals) {
                        return pos += 2, token = SyntaxKind.LessThanEqualsToken;
                    }
                    pos++;
                    return token = SyntaxKind.LessThanToken;
                case CharacterCodes.greaterThan:
                    if (text.charCodeAt(pos + 1) === CharacterCodes.greaterThan) {
                        if (text.charCodeAt(pos + 2) === CharacterCodes.greaterThan) {
                            if (text.charCodeAt(pos + 3) === CharacterCodes.equals) {
                                return pos += 4, token = SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken;
                            }
                            return pos += 3, token = SyntaxKind.GreaterThanGreaterThanGreaterThanToken;
                        }
                        if (text.charCodeAt(pos + 2) === CharacterCodes.equals) {
                            return pos += 3, token = SyntaxKind.GreaterThanGreaterThanEqualsToken;
                        }
                        return pos += 2, token = SyntaxKind.GreaterThanGreaterThanToken;
                    }
                    if (text.charCodeAt(pos + 1) === CharacterCodes.equals) {
                        return pos += 2, token = SyntaxKind.GreaterThanEqualsToken;
                    }
                    pos++;
                    return token = SyntaxKind.GreaterThanToken;
                case CharacterCodes.equals:
                    if (text.charCodeAt(pos + 1) === CharacterCodes.equals) {
                        if (text.charCodeAt(pos + 2) === CharacterCodes.equals) {
                            return pos += 3, token = SyntaxKind.EqualsEqualsEqualsToken;
                        }
                        return pos += 2, token = SyntaxKind.EqualsEqualsToken;
                    }
                    if (text.charCodeAt(pos + 1) === CharacterCodes.greaterThan) {
                        return pos += 2, token = SyntaxKind.EqualsGreaterThanToken;
                    }
                    pos++;
                    return token = SyntaxKind.EqualsToken;
                case CharacterCodes.question:
                    pos++;
                    if (text.charCodeAt(pos) === CharacterCodes.dot && !isDigit(text.charCodeAt(pos + 1))) {
                        pos++;
                        return token = SyntaxKind.QuestionDotToken;
                    }
                    if (text.charCodeAt(pos) === CharacterCodes.question) {
                        pos++;
                        return token = SyntaxKind.QuestionQuestionToken;
                    }
                    return token = SyntaxKind.QuestionToken;
                case CharacterCodes.openBracket:
                    pos++;
                    return token = SyntaxKind.OpenBracketToken;
                case CharacterCodes.closeBracket:
                    pos++;
                    return token = SyntaxKind.CloseBracketToken;
                case CharacterCodes.caret:
                    if (text.charCodeAt(pos + 1) === CharacterCodes.equals) {
                        return pos += 2, token = SyntaxKind.CaretEqualsToken;
                    }
                    pos++;
                    return token = SyntaxKind.CaretToken;
                case CharacterCodes.openBrace:
                    pos++;
                    return token = SyntaxKind.OpenBraceToken;
                case CharacterCodes.bar:
                    if (text.charCodeAt(pos + 1) === CharacterCodes.bar) {
                        return pos += 2, token = SyntaxKind.BarBarToken;
                    }
                    if (text.charCodeAt(pos + 1) === CharacterCodes.equals) {
                        return pos += 2, token = SyntaxKind.BarEqualsToken;
                    }
                    pos++;
                    return token = SyntaxKind.BarToken;
                case CharacterCodes.closeBrace:
                    pos++;
                    return token = SyntaxKind.CloseBraceToken;
                case CharacterCodes.tilde:
                    pos++;
                    return token = SyntaxKind.TildeToken;
                case CharacterCodes.at:
                    pos++;
                    return token = SyntaxKind.AtToken;
                case CharacterCodes.backslash:
                    this.error('Unicode escape is not supported yet');
                    pos++;
                    return token = SyntaxKind.Unknown;

                // String literal
                case CharacterCodes.doubleQuote:
                case CharacterCodes.singleQuote:
                    tokenValue = this.scanString();
                    return token = SyntaxKind.StringLiteral;

                case CharacterCodes._0:
                    if (pos + 2 < end && (text.charCodeAt(pos + 1) === CharacterCodes.X || text.charCodeAt(pos + 1) === CharacterCodes.x)) {
                        pos += 2;
                        tokenValue = this.scanHexDigits();
                        if (!tokenValue) {
                            this.error('Hexadecimal digit expected');
                            tokenValue = '0';
                        }
                        tokenValue = '' + parseInt(tokenValue, 16);
                        tokenFlags |= TokenFlags.HexSpecifier;
                        return token = SyntaxKind.NumericLiteral;
                    }
                    else if (pos + 2 < end && (text.charCodeAt(pos + 1) === CharacterCodes.B || text.charCodeAt(pos + 1) === CharacterCodes.b)) {
                        pos += 2;
                        tokenValue = this.scanBinaryDigits();
                        if (!tokenValue) {
                            this.error('Binary digit expected');
                            tokenValue = '0';
                        }
                        tokenValue = '' + parseInt(tokenValue, 2);
                        tokenFlags |= TokenFlags.BinarySpecifier;
                        return token = SyntaxKind.NumericLiteral;
                    }
                    else if (pos + 2 < end && (text.charCodeAt(pos + 1) === CharacterCodes.O || text.charCodeAt(pos + 1) === CharacterCodes.o)) {
                        pos += 2;
                        tokenValue = this.scanOctalDigits();
                        if (!tokenValue) {
                            this.error('Octal digit expected');
                            tokenValue = '0';
                        }
                        tokenValue = '' + parseInt(tokenValue, 8);
                        tokenFlags |= TokenFlags.OctalSpecifier;
                        return token = SyntaxKind.NumericLiteral;
                    }
                    // Try to parse as an octal
                    if (pos + 1 < end && isOctalDigit(text.charCodeAt(pos + 1))) {
                        tokenValue = this.scanOctalDigits();
                        tokenValue = '' + parseInt(tokenValue, 8);
                        tokenFlags |= TokenFlags.Octal;
                        return token = SyntaxKind.NumericLiteral;
                    }

                // Intentional fall-through
                // Derive from the standard grammar
                case CharacterCodes._1:
                case CharacterCodes._2:
                case CharacterCodes._3:
                case CharacterCodes._4:
                case CharacterCodes._5:
                case CharacterCodes._6:
                case CharacterCodes._7:
                case CharacterCodes._8:
                case CharacterCodes._9:
                    tokenValue = this.scanNumber();
                    return token = SyntaxKind.NumericLiteral;

                default:
                    // Identifier or keyword
                    if (isIdentifierStart(ch)) {
                        pos += 1;
                        while (pos < end && isIdentifierPart(ch = text.codePointAt(pos)!)) {
                            pos += 1;
                        }
                        tokenValue = text.substring(tokenPos, pos);
                        return token = checkReservedWord(tokenValue);
                    }

                    // Cannot parse
                    this.error('Invalid character');
                    pos += 1;
                    return token = SyntaxKind.Unknown;
            }
        }
    }

    private scanString(): string {
        const quote = text.charCodeAt(pos);
        pos++;
        let result = '';
        let start = pos;
        while (true) {
            if (pos >= end) {
                result += text.substring(start, pos);
                this.error('Unterminated string literal');
                break;
            }
            const ch = text.charCodeAt(pos);
            if (ch === quote) {
                result += text.substring(start, pos);
                pos++;
                break;
            }
            if (ch === CharacterCodes.backslash) {
                result += text.substring(start, pos);
                result += this.scanEscapeSequence();
                start = pos;
                continue;
            }
            if (isLineBreak(ch)) {
                result += text.substring(start, pos);
                this.error('Unterminated string literal');
                break;
            }
            pos++;
        }
        return result;
    }

    scanEscapeSequence(): string {
        pos++;
        if (pos >= end) {
            this.error('Unexpected end of text');
            return '';
        }
        const ch = text.charCodeAt(pos);
        pos++;
        switch (ch) {
            case CharacterCodes._0:
                return "\0";
            case CharacterCodes.b:
                return "\b";
            case CharacterCodes.t:
                return "\t";
            case CharacterCodes.n:
                return "\n";
            case CharacterCodes.v:
                return "\v";
            case CharacterCodes.f:
                return "\f";
            case CharacterCodes.r:
                return "\r";
            case CharacterCodes.singleQuote:
                return "\'";
            case CharacterCodes.doubleQuote:
                return "\"";
            default:
                this.error('Expected escape char');
                return '';
        }
    }

    private scanNumber(): string {
        const start = pos;

        const mainFragment = this.scanNumberFragment();

        let decimalFragment: string | undefined;
        let scientificFragment: string | undefined;

        if (text.charCodeAt(pos) === CharacterCodes.dot) {
            pos++;
            decimalFragment = this.scanNumberFragment();
        }
        let end = pos;
        if (text.charCodeAt(pos) === CharacterCodes.E || text.charCodeAt(pos) === CharacterCodes.e) {
            pos++;
            tokenFlags |= TokenFlags.Scientific;
            if (text.charCodeAt(pos) === CharacterCodes.plus
                || text.charCodeAt(pos) === CharacterCodes.minus
            ) {
                pos++;
            }
            const preNumericPart = pos;
            const finalFragment = this.scanNumberFragment();
            if (!finalFragment) {
                this.error('Digit expected');
            } else {
                scientificFragment = text.substring(end, preNumericPart) + finalFragment;
                end = pos;
            }
        }
        const result = text.substring(start, end);

        if (decimalFragment !== undefined || tokenFlags & TokenFlags.Scientific) {
            return '' + +result;
        } else {
            return result;
        }
    }

    // Several short function, runtime will inline them
    private scanNumberFragment(): string {
        let start = pos;
        while (isDigit(text.charCodeAt(pos))) {
            pos++;
        }
        return text.substring(start, pos);
    }

    private scanHexDigits(): string {
        const start = pos;
        while (isHexDigit(text.charCodeAt(pos))) {
            pos++;
        }
        return text.substring(start, pos);
    }

    private scanBinaryDigits(): string {
        const start = pos;
        while (isBinaryDigit(text.charCodeAt(pos))) {
            pos++;
        }
        return text.substring(start, pos);
    }

    private scanOctalDigits(): string {
        const start = pos;
        while (isOctalDigit(text.charCodeAt(pos))) {
            pos++;
        }
        return text.substring(start, pos);
    }
}
