import chalk from 'chalk';
import fs from 'fs-extra';
import yargs from 'yargs';
import { Scanner, SyntaxKind, TokenFlags } from './index';
import { Parser } from './syntactic';

const filepath = './tests/http.tsn';

function walk(node: any) {
    if (typeof (node as any).kind !== 'undefined') {
        (node as any).kind = SyntaxKind[(node as any).kind];
    }
    if ((node as any).flags === 0) {
        delete node.flags;
    }

    if (typeof node.pos === 'number') {
        delete node.pos;
    }
    if (typeof node.end === 'number') {
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
