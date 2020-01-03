import chalk from 'chalk';
import fs from 'fs-extra';
import yargs from 'yargs';
import { Scanner, SyntaxKind, TokenFlags } from './index';
import { Parser } from './syntactic';

const argv = yargs.argv;

switch (argv._[0]) {
    case 'lex':
        doLexAnalysisOverFiles(argv._.slice(1));
        break;
    case 'syntax':
        doSyntaxAnalysisOverFiles(argv._.slice(1), !!argv.pos);
        break;
    default:
        printHelp();
}

function printHelp() {
    console.log(`
Usage: tsgnc <command> [options]

Commands:
    lex <filepath>,<filepath>,...                   Do lexical analysis for the given files.
    syntax <filepath>,<filepath>,... [--pos]        Do syntax analysis for the given files.
                                                    Add --pos flag to output position of each node.
`
    );
}

function doSyntaxAnalysisOverFiles(args: string[], addPos: boolean) {
    if (!args.length) {
        console.error('Error: File paths expected.');
        printHelp();
    }

    const filepaths = args.join('').split(',');
    const parser = Parser;

    function walk(node: any) {
        if (typeof (node as any).kind !== 'undefined') {
            (node as any).kind = SyntaxKind[(node as any).kind];
        }
        if ((node as any).flags === 0) {
            delete node.flags;
        }

        if (!addPos && typeof node.pos === 'number') {
            delete node.pos;
        }
        if (!addPos && typeof node.end === 'number') {
            delete node.end;
        }
        if (Array.isArray(node)) {
            for (const item of node) {
                if (typeof item === 'object') walk(item);
            }
        } else {
            for (const k of Object.keys(node)) {
                if (k === 'parent') {
                    delete node.parent;
                    continue;
                }
                const item = node[k];
                if (typeof item === 'object') walk(item);
            }
        }
    }

    for (const filepath of filepaths) {
        try {
            console.log(chalk.blue('Parsing `' + filepath + '`...'));
            const fileName = filepath.split('/').pop()!;
            const programSource = fs.readFileSync(filepath, 'utf8');

            const sourceFile = Parser.parseSourceFile(fileName, programSource);

            walk(sourceFile);
            const fileDir = filepath.substr(0, filepath.length - fileName.length);

            console.log(chalk.blue('Outputting `' + filepath + '.ast`...'));
            fs.writeJSONSync(fileDir + fileName + '.ast', sourceFile, { spaces: 3 });
        } catch (e) {
            console.error(e.message);
        }
    }
    console.log('done');
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
