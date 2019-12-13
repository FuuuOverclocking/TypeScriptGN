import chalk from 'chalk';
import fs from 'fs-extra';
import yargs from 'yargs';
import { Scanner, SyntaxKind, TokenFlags } from './index';

const argv = yargs.argv;

switch (argv._[0]) {
    case 'lex':
        doLexAnalysisOverFiles(argv._.slice(1));
        break;
    default:
        printHelp();
}

function printHelp() {
    console.log(`
Usage: tsgnc <command> [options]

Commands:
    lex <filepath>,<filepath>,...           Do lexical analysis for the given files
`
    );
}

function doLexAnalysisOverFiles(args: string[]) {
    if (!args.length) {
        console.error('Error: File paths expected.');
        printHelp();
    }

    const filepaths = args.join('').split(',');
    const scanner = Scanner.getScanner();

    for (const filepath of filepaths) {
        try {
            const programSource = fs.readFileSync(filepath, 'utf8');

            scanner.resetText(programSource);
            scanner.setTextRange(/* start */ 0);

            let token; let tokenFlags;
            console.log(chalk.cyan(filepath));
            while (true) {
                token = scanner.scan();
                tokenFlags = scanner.tokenFlags;

                let message = '    ' + SyntaxKind[token];

                if (token === SyntaxKind.NumericLiteral
                    || token === SyntaxKind.StringLiteral) {
                    message += ', value="' + chalk.yellow(scanner.tokenValue) + '"';
                } else if (token === SyntaxKind.Identifier) {
                    message += '[' + chalk.blue(scanner.tokenValue) + ']';
                }

                if (tokenFlags !== TokenFlags.None) {
                    message += ', with flags=' + chalk.red(tokenFlags.toString(2));
                }

                console.log(message);

                if (token === SyntaxKind.EndOfFileToken) {
                    break;
                }
            }

        } catch (e) {
            console.error(e.message);
        }
    }
}
