import { Scanner, SyntaxKind, TokenFlags } from 'compiler';
import fs from 'fs-extra';

const scanner = Scanner.getScanner();

// This file itself is exactly the test case
const programSource = fs.readFileSync('./tests/cases/test-myself.ts', 'utf8');

scanner.resetText(programSource);
scanner.setTextRange(/* start */ 0);

let token; let tokenFlags;
while (true) {
    token = scanner.scan();
    tokenFlags = scanner.tokenFlags;

    let message = SyntaxKind[token];

    if (token === SyntaxKind.NumericLiteral
        || token === SyntaxKind.StringLiteral) {
        message += ', value="' + scanner.tokenValue + '"';
    } else if (token === SyntaxKind.Identifier) {
        message += '[' + scanner.tokenValue + ']';
    }

    if (tokenFlags !== TokenFlags.None) {
        message += ', with flags=' + tokenFlags.toString(2);
    }

    console.log(message);

    if (token === SyntaxKind.EndOfFileToken) {
        break;
    }
}

// some meaningless expression for test
0b1100011 + 0xaff231d < -3210.1234567e+123;
(f => f(+f || 'done'))(console.log);
