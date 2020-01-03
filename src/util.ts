import { CharacterCodes, KeywordSyntaxKind, SyntaxKind, textToKeyword } from './types';

export function assert(expression: boolean, msg?: string) {
    if (expression) return;
    throw new Error(msg);
}

export function isDigit(ch: number): boolean {
    return ch >= CharacterCodes._0 && ch <= CharacterCodes._9;
}

export function isLineBreak(ch: number): boolean {
    return ch === CharacterCodes.lineFeed ||
        ch === CharacterCodes.carriageReturn;
}

export function isOctalDigit(ch: number): boolean {
    return ch >= CharacterCodes._0 && ch <= CharacterCodes._7;
}
export function isHexDigit(ch: number): boolean {
    return ch >= CharacterCodes._0 && ch <= CharacterCodes._9
        || ch >= CharacterCodes.a && ch <= CharacterCodes.f
        || ch >= CharacterCodes.A && ch <= CharacterCodes.F;
}
export function isBinaryDigit(ch: number): boolean {
    return ch === CharacterCodes._0 || ch === CharacterCodes._1;
}

export function isIdentifierStart(ch: number): boolean {
    return ch >= CharacterCodes.A && ch <= CharacterCodes.Z
        || ch >= CharacterCodes.a && ch <= CharacterCodes.z
        || ch === CharacterCodes.$ || ch === CharacterCodes._;
}
export function isIdentifierPart(ch: number): boolean {
    return ch >= CharacterCodes.A && ch <= CharacterCodes.Z
        || ch >= CharacterCodes.a && ch <= CharacterCodes.z
        || ch >= CharacterCodes._0 && ch <= CharacterCodes._9
        || ch === CharacterCodes.$ || ch === CharacterCodes._;
}

export function checkReservedWord(tokenValue: string): SyntaxKind.Identifier | KeywordSyntaxKind {
    const ch = tokenValue.charCodeAt(0);
    if (ch >= CharacterCodes.a && ch <= CharacterCodes.z) {
        const keyword = textToKeyword[tokenValue];
        if (keyword !== undefined) {
            return keyword;
        }
    }
    return SyntaxKind.Identifier;
}
