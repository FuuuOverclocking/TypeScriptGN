import chalk from 'chalk';
import * as lang from './types';
import {
    Expression, Node, NodeList, NodeFlags,
    ParsingContext, SourceFile, Statement, SyntaxKind,
    SyntaxKindMarker, Token
} from './types';
import { Scanner } from './lexical';
import { assert } from './util';

export namespace Parser {
    const scanner = Scanner.getScanner();

    const NodeInitializer: new (kind: SyntaxKind, pos?: number, end?: number) => Node =
        function (this: Node, kind: SyntaxKind, pos: number, end: number) {
            this.pos = pos;
            this.end = end;
            this.kind = kind;
            this.flags = NodeFlags.None;
            this.parent = undefined!;
        } as any;

    function finishNode<T extends Node>(node: T, end?: number): T {
        node.end = end === undefined ? scanner.startPos : end;
        if (contextFlags) {
            node.flags |= contextFlags;
        }
        return node;
    }

    /** root node of parsing tree */
    let sourceFile: SourceFile;
    /** current token */
    let token: SyntaxKind;
    let sourceText: string;
    let nodeCount: number;
    let contextFlags: NodeFlags;

    let parsingContext: ParsingContext;

    export function parseSourceFile(
        fileName: string,
        sourceText: string
    ): SourceFile {
        initializeState(sourceText);
        const result = parseSourceFileWorker(fileName);
        clearState();
        return result;
    }

    function initializeState(_sourceText: string) {
        sourceText = _sourceText;

        parsingContext = 0;
        nodeCount = 0;

        contextFlags = NodeFlags.None;

        scanner.resetText(sourceText);
        scanner.setOnError(scanError);
    }

    function clearState() {
        scanner.resetText('');
        scanner.setOnError(undefined);

        sourceFile = undefined!;
        sourceText = undefined!;
    }

    function scanError(message: string, length: number) {
        console.log(chalk.red(
            message + ' (SourceFile = ' + sourceFile.fileName + ', start = ' + scanner.pos +
            ', length = ' + length + ')'
        ));
    }


    function parseSourceFileWorker(fileName: string): SourceFile {
        sourceFile = initializeSourceFile(fileName);
        sourceFile.flags = NodeFlags.None;

        // let `token` point to the first token of the source code
        nextToken();

        sourceFile.statements = parseList(ParsingContext.SourceElements, parseStatement);
        assert(token === SyntaxKind.EndOfFileToken);

        sourceFile.nodeCount = nodeCount;

        return sourceFile;
    }


    function initializeSourceFile(fileName: string): SourceFile {
        const sourceFile = <SourceFile>new NodeInitializer(SyntaxKind.SourceFile, /*pos*/ 0, /* end */ sourceText.length);
        nodeCount++;

        sourceFile.text = sourceText;
        sourceFile.fileName = fileName;

        return sourceFile;
    }

    function error(msg: string) {
        console.error(chalk.red(msg));
        console.error(chalk.red(
            'File name:' + sourceFile.fileName + '\n' +
            'Position:' + scanner.tokenPos
        ));
    }

    function protectContextHelper<T>(callback: () => T, alwaysRestore: boolean) {
        const saveToken = token;
        const saveContextFlags = contextFlags;

        const result = alwaysRestore
            ? scanner.lookAhead(callback)
            : scanner.tryScan(callback);

        assert(saveContextFlags === contextFlags);

        if (!result || alwaysRestore) {
            token = saveToken;
        }

        return result;
    }

    /** Invokes the provided callback then unconditionally restores the parser to the state it
     * was in immediately prior to invoking the callback.  The result of invoking the callback
     * is returned from this function.
     */
    function lookAhead<T>(callback: () => T): T {
        return protectContextHelper(callback, true);
    }

    /** Invokes the provided callback.  If the callback returns something falsy, then it restores
     * the parser to the state it was in immediately prior to invoking the callback.  If the
     * callback returns something truthy, then the parser state is not rolled back.  The result
     * of invoking the callback is returned from this function.
     */
    function tryParse<T>(callback: () => T): T {
        return protectContextHelper(callback, false);
    }


    function nextToken() {
        return token = scanner.scan();
    }

    function createNode(kind: SyntaxKind, pos?: number): Node {
        nodeCount++;
        const p = pos! >= 0 ? pos! : scanner.startPos;
        return new NodeInitializer(kind, p, p);
    }
    function parseExpected(kind: SyntaxKind): boolean | undefined {
        if (token === kind) {
            nextToken();
            return true;
        }

        error('Unexpected ' + SyntaxKind[token] + ', expected ' + SyntaxKind[kind]);
    }
    function parseOptional(kind: SyntaxKind): boolean {
        if (token === kind) {
            nextToken();
            return true;
        }
        return false;
    }
    function parseExpectedToken<TKind extends SyntaxKind>(t: TKind): Token<TKind> | undefined {
        if (token === t) {
            return parseTokenNode<Token<TKind>>();
        }

        error('Unexpected ' + SyntaxKind[t] + ', expected ' + SyntaxKind[t]);
    }
    function parseOptionalToken<TKind extends SyntaxKind>(t: TKind): Token<TKind> | undefined {
        if (token === t) {
            return parseTokenNode<Token<TKind>>();
        }
        return undefined;
    }
    function parseTokenNode<T extends Node>(): T {
        const node = <T>createNode(token);
        nextToken();
        return finishNode(node);
    }

    function createNodeList<T extends Node>(elements: T[], pos: number, end?: number): NodeList<T> {
        const array = <NodeList<T> & T[]>elements;
        array.pos = pos;
        array.end = end === undefined ? scanner.startPos : end;
        return array;
    }

    function parseList<T extends Node>(kind: ParsingContext, parseElement: () => T): NodeList<T> {
        const saveParsingContext = parsingContext;
        parsingContext |= 1 << kind;
        const list = [];
        const listPos = scanner.startPos;

        while (!isListTerminator(kind)) {
            const element = parseElement();
            list.push(element);
        }

        parsingContext = saveParsingContext;
        return createNodeList(list, listPos);
    }

    function parseDelimitedList<T extends Node>(
        kind: ParsingContext,
        parseElement: () => T,
    ) {
        const saveParsingContext = parsingContext;
        parsingContext |= 1 << kind;
        const list = [];
        const listPos = scanner.startPos;
        let commaStart = -1; // Meaning the previous token was not a comma

        while (!isListTerminator(kind)) {
            const element = parseElement();
            list.push(element);

            commaStart = scanner.tokenPos;
            if (parseOptional(SyntaxKind.CommaToken)) {
                continue;
            }

            commaStart = -1; // Back to the state where the last token was not a comma
            if (isListTerminator(kind)) {
                break;
            } else {
                error('Comma expected.');
            }
        }

        parsingContext = saveParsingContext;
        const result = createNodeList(list, listPos);

        if (commaStart >= 0) {
            result.hasTrailingDelimiter = true;
        }
        return result;
    }

    function isListTerminator(kind: ParsingContext): boolean {
        if (token === SyntaxKind.EndOfFileToken) {
            return true;
        }

        switch (kind) {
            case ParsingContext.BlockStatements:
            case ParsingContext.SwitchClauses:
            case ParsingContext.ObjectLiteralMembers:
            case ParsingContext.NodeBlock:
                return token === SyntaxKind.CloseBraceToken;
            case ParsingContext.SwitchClauseStatements:
                return token === SyntaxKind.CloseBraceToken ||
                    token === SyntaxKind.CaseKeyword ||
                    token === SyntaxKind.DefaultKeyword;
            case ParsingContext.ArrayLiteralMembers:
                return token === SyntaxKind.CloseBracketToken;
            case ParsingContext.Parameters:
            case ParsingContext.ArgumentExpressions:
                return token === SyntaxKind.CloseParenToken;
            case ParsingContext.VariableDeclarations:
                return token === SyntaxKind.SemicolonToken ||
                    token === SyntaxKind.OpenBraceToken /* using const a = file() {} */;
            default:
                // case ParsingContext.SourceElements:
                return false;
        }
    }

    function parseStatement(): Statement {
        switch (token) {
            case SyntaxKind.SemicolonToken:
                return parseEmptyStatement();
            case SyntaxKind.OpenBraceToken:
                return parseBlock();
            case SyntaxKind.ContinueKeyword:
                return parseBreakOrContinueStatement(SyntaxKind.ContinueStatement);
            case SyntaxKind.BreakKeyword:
                return parseBreakOrContinueStatement(SyntaxKind.BreakStatement);
            case SyntaxKind.FallThroughKeyword:
                return parseFallThroughStatement();
            case SyntaxKind.ReturnKeyword:
                return parseReturnStatement();
            case SyntaxKind.DebuggerKeyword:
                return parseDebuggerStatement();
            case SyntaxKind.IfKeyword:
                return parseIfStatement();
            case SyntaxKind.ForKeyword:
                return parseForOrForInOrForOfStatement();
            case SyntaxKind.SwitchKeyword:
                return parseSwitchStatement();
            case SyntaxKind.TryKeyword:
                return parseTryStatement();
            case SyntaxKind.UsingKeyword:
                return parseUsingStatement();

            case SyntaxKind.AtToken:
                return parseDeclaration();

            case SyntaxKind.ImportKeyword: // import.meta, import('jquery').then(...)
            case SyntaxKind.ExportKeyword:
            case SyntaxKind.VarKeyword:
            case SyntaxKind.LetKeyword:
            case SyntaxKind.ConstKeyword:
            case SyntaxKind.AbstractKeyword: // abstract class ..., or as an identifier
            case SyntaxKind.ClassKeyword:
            case SyntaxKind.AsyncKeyword: // async funtion ..., or as an identifier
            case SyntaxKind.FunctionKeyword:
            case SyntaxKind.NodeKeyword: // node nd {...} subnet {...}, or id
            case SyntaxKind.SubnetKeyword:
            case SyntaxKind.InterfaceKeyword: // interface TypeA {...}, or id
            case SyntaxKind.TypeKeyword: // type TypeA = ..., or id
            case SyntaxKind.EnumKeyword:
            case SyntaxKind.NamespaceKeyword: // namespace NS {...}, or id
                if (isStartOfDeclaration()) {
                    return parseDeclaration();
                }
                break;
        }
        return parseExpressionOrLabeledStatement();
    }

    function parseIdentifier() {
        if (!scanner.isIdentifier()) {
            error('Identifier expected, but got ' + SyntaxKind[token]);
            const node = <lang.Identifier>createNode(SyntaxKind.Identifier);
            node.text = '';
            return finishNode(node);
        }

        const node = <lang.Identifier>createNode(SyntaxKind.Identifier);

        node.text = scanner.tokenValue!;

        if (token !== SyntaxKind.Identifier) {
            node.originalKeywordKind = token;
        }
        nextToken();
        return finishNode(node);
    }
    function parseSemicolon() {
        return parseExpected(SyntaxKind.SemicolonToken);
    }

    function parseEmptyStatement() {
        const node = <lang.EmptyStatement>createNode(SyntaxKind.EmptyStatement);
        parseExpected(SyntaxKind.SemicolonToken);
        return finishNode(node);
    }

    function parseBlock() {
        const node = <lang.Block>createNode(SyntaxKind.Block);

        parseExpected(SyntaxKind.OpenBraceToken);
        node.statements = parseList(ParsingContext.BlockStatements, parseStatement);
        parseExpected(SyntaxKind.CloseBraceToken);

        return finishNode(node);
    }

    function parseExpressionOrLabeledStatement(): lang.ExpressionStatement | lang.LabeledStatement {
        // Avoiding having to do the lookahead for a labeled statement by just trying to parse
        // out an expression, seeing if it is identifier and then seeing if it is followed by
        // a colon.
        const node = <lang.ExpressionStatement | lang.LabeledStatement>createNode(SyntaxKind.Unknown);
        const expression = parseExpression();
        if (expression.kind === SyntaxKind.Identifier && parseOptional(SyntaxKind.ColonToken)) {
            node.kind = SyntaxKind.LabeledStatement;
            (<lang.LabeledStatement>node).label = <lang.Identifier>expression;
            (<lang.LabeledStatement>node).statement = parseStatement();
        } else {
            node.kind = SyntaxKind.ExpressionStatement;
            (<lang.ExpressionStatement>node).expression = expression;
            parseSemicolon();
        }
        return finishNode(node);
    }

    function parseBreakOrContinueStatement(
        kind: SyntaxKind.ContinueStatement | SyntaxKind.BreakStatement
    ) {
        const node = <lang.BreakStatement | lang.ContinueStatement>createNode(kind);

        parseExpected(
            kind === SyntaxKind.BreakStatement
                ? SyntaxKind.BreakKeyword
                : SyntaxKind.ContinueKeyword
        );
        if (token !== SyntaxKind.SemicolonToken) {
            node.label = parseIdentifier();
        }

        parseExpected(SyntaxKind.SemicolonToken);
        return finishNode(node);
    }

    function parseFallThroughStatement() {
        const node = <lang.FallthroughStatement>createNode(SyntaxKind.FallThroughStatement);
        parseExpected(SyntaxKind.FallThroughKeyword);
        parseSemicolon();
        return finishNode(node);
    }

    function parseReturnStatement() {
        const node = <lang.ReturnStatement>createNode(SyntaxKind.ReturnStatement);
        parseExpected(SyntaxKind.ReturnKeyword);
        if (token !== SyntaxKind.SemicolonToken) {
            node.expression = parseExpression();
        }
        parseSemicolon();
        return finishNode(node);
    }

    function parseDebuggerStatement() {
        const node = <lang.DebuggerStatement>createNode(SyntaxKind.DebuggerStatement);
        parseExpected(SyntaxKind.DebuggerKeyword);
        parseSemicolon();
        return finishNode(node);
    }

    function isCurrentTokenVLC() {
        return token === SyntaxKind.VarKeyword ||
            token === SyntaxKind.LetKeyword ||
            token === SyntaxKind.ConstKeyword;
    }

    function parseIfStatement() {
        const node = <lang.IfStatement>createNode(SyntaxKind.IfStatement);
        parseExpected(SyntaxKind.IfKeyword);
        const walrus: lang.VariableDeclaration | false = tryParseWalrusDeclaration();
        const variableDeclaration = walrus || isCurrentTokenVLC() && parseVariableDeclarationWithoutModifiers();
        if (variableDeclaration) {
            node.variableDeclaration = variableDeclaration;
        }
        node.expression = parseExpression();
        node.thenBlock = parseBlock();

        let elifClauseList: lang.ElifClause[] | undefined;
        let elifClausesPos = scanner.startPos;
        while (true) {
            if (token !== SyntaxKind.ElifKeyword) break;
            elifClauseList = elifClauseList || [];

            const elifClause = <lang.ElifClause>createNode(SyntaxKind.ElifClause);

            nextToken();

            const _walrus: lang.VariableDeclaration | false = tryParseWalrusDeclaration();
            const _variableDeclaration = _walrus || isCurrentTokenVLC() && parseVariableDeclarationWithoutModifiers();
            if (_variableDeclaration) {
                elifClause.variableDeclaration = _variableDeclaration;
            }

            elifClause.expression = parseExpression();
            elifClause.thenBlock = parseBlock();
            elifClauseList.push(elifClause);
        }
        node.elifClauses = elifClauseList && createNodeList(elifClauseList, elifClausesPos);
        node.elseBlock = parseOptional(SyntaxKind.ElseKeyword)
            ? parseBlock()
            : undefined;
        return finishNode(node);
    }

    function parseForOrForInOrForOfStatement() {
        const pos = scanner.startPos;
        parseExpected(SyntaxKind.ForKeyword);

        if (token === SyntaxKind.OpenBraceToken) {
            // for { ... }
            const node = <lang.ForStatement>createNode(SyntaxKind.ForStatement, pos);
            node.block = parseBlock();
            return finishNode(node);
        } else if (isCurrentTokenVLC() && lookAhead(() => {
            nextToken();
            if (!scanner.isIdentifier()) return false;
            nextToken();
            return token === SyntaxKind.InKeyword || token === SyntaxKind.OfKeyword;
        })) {
            // for-in, for-of
            const node = <lang.ForInStatement | lang.ForOfStatement>createNode(SyntaxKind.Unknown, pos);
            node.vlc = token as SyntaxKind.VarKeyword | SyntaxKind.LetKeyword | SyntaxKind.ConstKeyword;
            node.identifier = parseIdentifier();

            if (token === SyntaxKind.InKeyword) {
                node.kind = SyntaxKind.ForInStatement;
                nextToken();
                node.expression = parseExpression();
            } else {
                node.kind = SyntaxKind.ForOfStatement;
                nextToken();
                node.expression = parseConnectExp();
            }
            node.block = parseBlock();
            return finishNode(node);
        } else {
            // for Expression { ... }
            // for abc; efg; hij { ... }
            const node = <lang.ForStatement>createNode(SyntaxKind.ForStatement, pos);
            const walrus: lang.VariableDeclaration | false = tryParseWalrusDeclaration();
            const variableDeclaration: lang.VariableDeclaration | false =
                walrus || (isCurrentTokenVLC() && parseVariableDeclarationWithoutModifiers());

            if (token !== SyntaxKind.SemicolonToken) {
                node.initializer = variableDeclaration || parseExpression();
            }

            if (variableDeclaration) {
                // There must be a second element
                node.condition = parseExpression();
                parseSemicolon();
                if ((token as SyntaxKind) !== SyntaxKind.OpenBraceToken) {
                    node.incrementor = parseExpression();
                }
            } else {
                // There may be a second element, if so, now token = ;
                if (parseOptional(SyntaxKind.SemicolonToken)) {
                    node.condition = parseExpression();
                    parseSemicolon();
                    if ((token as SyntaxKind) !== SyntaxKind.OpenBraceToken) {
                        node.incrementor = parseExpression();
                    }
                } else {
                    // Unary
                    node.condition = node.initializer as lang.Expression;
                    node.initializer = undefined;
                }
            }
            node.block = parseBlock();
            return finishNode(node);
        }
    }

    function parseSwitchStatement(): lang.SwitchStatement {
        const node = createNode(SyntaxKind.SwitchStatement) as lang.SwitchStatement;

        parseExpected(SyntaxKind.SwitchKeyword);

        const walrus: lang.VariableDeclaration | false = tryParseWalrusDeclaration();
        const variableDeclaration = walrus || isCurrentTokenVLC() && parseVariableDeclarationWithoutModifiers();
        if (variableDeclaration) {
            node.variableDeclaration = variableDeclaration;
        }

        node.expression = parseExpression();
        const caseBlock = createNode(SyntaxKind.CaseBlock) as lang.CaseBlock;
        parseExpected(SyntaxKind.OpenBraceToken);
        caseBlock.clauses = parseList(ParsingContext.SwitchClauses, parseCaseOrDefaultClause);
        parseExpected(SyntaxKind.CloseBraceToken);
        node.caseBlock = finishNode(caseBlock);

        return finishNode(node);
    }

    function parseCaseOrDefaultClause() {
        return token === SyntaxKind.CaseKeyword ? parseCaseClause() : parseDefaultClause();
    }

    function parseCaseClause(): lang.CaseClause {
        const node = <lang.CaseClause>createNode(SyntaxKind.CaseClause);
        parseExpected(SyntaxKind.CaseKeyword);
        node.expression = parseExpression();
        parseExpected(SyntaxKind.ColonToken);
        node.statements = parseList(ParsingContext.SwitchClauseStatements, parseStatement);
        return finishNode(node);
    }

    function parseDefaultClause(): lang.DefaultClause {
        const node = <lang.DefaultClause>createNode(SyntaxKind.DefaultClause);
        parseExpected(SyntaxKind.DefaultKeyword);
        parseExpected(SyntaxKind.ColonToken);
        node.statements = parseList(ParsingContext.SwitchClauseStatements, parseStatement);
        return finishNode(node);
    }

    function parseTryStatement(): lang.TryStatement {
        const node = <lang.TryStatement>createNode(SyntaxKind.TryStatement);
        parseExpected(SyntaxKind.TryKeyword);
        node.tryBlock = parseBlock();
        node.catchClause = token === SyntaxKind.CatchKeyword
            ? parseCatchClause()
            : undefined;

        if (!node.catchClause || token === SyntaxKind.FinallyKeyword) {
            parseExpected(SyntaxKind.FinallyKeyword);
            node.finallyBlock = parseBlock();
        }

        return finishNode(node);
    }

    function parseCatchClause(): lang.CatchClause {
        const result = <lang.CatchClause>createNode(SyntaxKind.CatchClause);
        parseExpected(SyntaxKind.CatchKeyword);

        if (token !== SyntaxKind.OpenBraceToken) {
            result.identifier = parseIdentifier();
        }

        result.block = parseBlock();
        return finishNode(result);
    }

    function parseUsingStatement(): lang.UsingStatement {
        const node = <lang.UsingStatement>createNode(SyntaxKind.UsingStatement);

        parseExpected(SyntaxKind.UsingKeyword);

        const targetListPos = scanner.startPos;
        const targetList = [] as lang.UsingTarget[];

        while (true) {
            if (token === SyntaxKind.OpenBraceToken) break;

            if (scanner.isIdentifier()) {
                const walrus = tryParseWalrusDeclaration(/*notParseSemicolon*/ true);
                if (walrus) {
                    targetList.push(walrus);
                } else {
                    targetList.push(parseIdentifier());
                }
            } else {
                targetList.push(parseVariableDeclarationWithoutModifiers({ notParseSemicolon: true }));
            }

            if (!parseOptional(SyntaxKind.SemicolonToken)) break;
        }
        node.usingTargets = createNodeList(targetList, targetListPos);
        node.block = parseBlock();

        return finishNode(node);
    }

    function tryParseWalrusDeclaration(notParseSemicolon = false): lang.VariableDeclaration | false {
        if (!scanner.isIdentifier()) return false;
        if (lookAhead(() => {
            nextToken();
            return token !== SyntaxKind.ColonEqualsToken;
        })) {
            return false;
        }

        const node = <lang.VariableDeclaration>createNode(SyntaxKind.VariableDeclaration);
        node.isWalrus = true;
        const pos = scanner.startPos;

        const binding = <lang.VariableBinding>createNode(SyntaxKind.VariableBinding);
        binding.parent = node;
        binding.name = parseIdentifier();
        parseExpected(SyntaxKind.ColonEqualsToken);
        binding.initializer = parseConnectExp();
        finishNode(binding);

        node.declarations = createNodeList([binding], pos);
        if (!notParseSemicolon) parseSemicolon();
        return finishNode(node);
    }


    function parseExpression(): Expression {
        let expr: Expression = parseConnectExp();
        while (parseOptionalToken(SyntaxKind.CommaToken)) {
            const left = expr as lang.ConnectExp;
            expr = <lang.CommaExpression>createNode(SyntaxKind.CommaExpression, expr.pos);
            (expr as lang.CommaExpression).left = left;
            (expr as lang.CommaExpression).right = parseConnectExp();
            finishNode(expr);
        }
        return expr;
    }
    function parseConnectExp(): lang.ConnectExp {
        let expr: lang.ConnectExp = parseAssignExp();
        while (parseOptionalToken(SyntaxKind.MinusGreaterThanToken)) {
            const left = expr as lang.AssignExp;
            expr = <lang.ConnectionExpression>createNode(SyntaxKind.ConnectionExpression, expr.pos);
            (expr as lang.ConnectionExpression).left = left;
            (expr as lang.ConnectionExpression).right = parseAssignExp();
            finishNode(expr);
        }
        return expr;
    }

    function parseAssignExp(): lang.AssignExp {
        if (token === SyntaxKind.YieldKeyword) {
            return parseYieldExpression();
        }

        if (token === SyntaxKind.AsyncKeyword && lookAhead(() =>
            nextToken()
            && token !== SyntaxKind.FunctionKeyword
            && token !== SyntaxKind.NodeKeyword
            && token !== SyntaxKind.SubnetKeyword) ||
            scanner.isIdentifier() && lookAhead(() => nextToken() === SyntaxKind.EqualsGreaterThanToken) ||
            token === SyntaxKind.LessThanToken && lookAhead(isStartOfArrowFunctionWithCallSignature) ||
            lookAhead(isStartOfParenthesizedArrowFunction)
        ) {
            return parseArrowFunction();
        }

        const expr: lang.BinaryExp = parseBinaryExp(0);

        if (isLeftHandExp(expr) && isAssignOp(reScanGreaterToken())) {
            return makeAssignmentExpression(expr, parseTokenNode(), parseAssignExp());
        }

        return parseConditionalExpRest(expr);
    }

    function makeAssignmentExpression(
        left: lang.LeftHandExp,
        operatorToken: Token<lang.AssignmentOperator>,
        right: lang.AssignExp,
    ) {
        const node = <lang.AssignmentExpression>createNode(SyntaxKind.AssignmentExpression);
        node.left = left;
        node.operatorToken = operatorToken;
        node.right = right;
        return finishNode(node);
    }

    function parseConditionalExpRest(expr: lang.BinaryExp): lang.ConditionalExp {
        if (!parseOptional(SyntaxKind.QuestionToken)) {
            return expr;
        }
        const node = <lang.ConditionalExpression>createNode(
            SyntaxKind.ConditionalExpression,
            expr.pos
        );
        node.condition = expr;
        node.whenTrue = parseAssignExp();
        parseExpected(SyntaxKind.ColonToken);
        node.whenFalse = parseAssignExp();
        return finishNode(node);
    }

    function parseYieldExpression() {
        const node = <lang.YieldExpression>createNode(SyntaxKind.YieldExpression);
        nextToken();
        if (token === SyntaxKind.AsteriskToken) {
            nextToken();
            node.hasAsterisk = true;
        } else {
            node.hasAsterisk = false;
        }

        if (isStartOfExpression()) {
            node.expression = parseAssignExp();
        }
        return finishNode(node);
    }

    function isStartOfExpression(): boolean {
        if (isStartOfLeftHandExp()) return true;

        switch (token) {
            case SyntaxKind.PlusPlusToken:
            case SyntaxKind.MinusMinusToken:
            case SyntaxKind.DeleteKeyword:
            case SyntaxKind.VoidKeyword:
            case SyntaxKind.TypeOfKeyword:
            case SyntaxKind.AwaitKeyword:
            case SyntaxKind.PlusToken:
            case SyntaxKind.MinusToken:
            case SyntaxKind.TildeToken:
            case SyntaxKind.ExclamationToken:
            case SyntaxKind.LessThanToken:
            case SyntaxKind.YieldKeyword:
            case SyntaxKind.AsyncKeyword:
                return true;

            default:
                return scanner.isIdentifier();
        }
    }

    function isStartOfLeftHandExp(): boolean {
        switch (token) {
            case SyntaxKind.ThisKeyword:
            case SyntaxKind.SuperKeyword:
            case SyntaxKind.NullKeyword:
            case SyntaxKind.TrueKeyword:
            case SyntaxKind.FalseKeyword:
            case SyntaxKind.NumericLiteral:
            case SyntaxKind.StringLiteral:
            case SyntaxKind.OpenParenToken:
            case SyntaxKind.OpenBracketToken:
            case SyntaxKind.OpenBraceToken:
            case SyntaxKind.FunctionKeyword:
            case SyntaxKind.ClassKeyword:
            case SyntaxKind.NodeKeyword:
            case SyntaxKind.SubnetKeyword:
            case SyntaxKind.NewKeyword:
            // case SyntaxKind.SlashToken:
            // case SyntaxKind.SlashEqualsToken:
            case SyntaxKind.Identifier:
                return true;
            case SyntaxKind.ImportKeyword:
                return lookAhead(nextTokenIsOpenParenOrDot);
            default:
                return scanner.isIdentifier();
        }
    }

    function nextTokenIsOpenParenOrDot() {
        switch (nextToken()) {
            case SyntaxKind.OpenParenToken:
            case SyntaxKind.DotToken:
                return true;
        }
        return false;
    }

    function parseArrowFunction(): lang.ArrowFunction {
        const node = <lang.ArrowFunction>createNode(SyntaxKind.ArrowFunction);
        node.isAsync = parseOptional(SyntaxKind.AsyncKeyword);

        if (scanner.isIdentifier()) {
            const singleParameter = <lang.Parameter>createNode(SyntaxKind.Parameter);
            singleParameter.name = parseIdentifier();
            finishNode(singleParameter);

            node.parameters = createNodeList([singleParameter], singleParameter.pos);
        } else {
            addCallSignature(node);
        }

        let equalsGreaterThanToken = parseExpectedToken(SyntaxKind.EqualsGreaterThanToken);
        if (!equalsGreaterThanToken) {
            error('expected =>');
            equalsGreaterThanToken = <lang.Token<SyntaxKind.EqualsGreaterThanToken>>createNode(SyntaxKind.EqualsGreaterThanToken);
            finishNode(equalsGreaterThanToken);
        }
        node.equalsGreaterThanToken = equalsGreaterThanToken;

        if (token === SyntaxKind.OpenBraceToken) {
            node.body = parseBlock();
        } else {
            node.body = parseConnectExp();
        }
        return finishNode(node);
    }

    function addCallSignature(node: lang.CallSignature): void {
        if (token === SyntaxKind.LessThanToken) {
            node.typeParameters = parseTypeParameters();
        }
        parseExpected(SyntaxKind.OpenParenToken);

        node.parameters = parseDelimitedList(ParsingContext.Parameters, parseParameter);

        parseExpected(SyntaxKind.CloseParenToken);

        if (parseOptional(SyntaxKind.ColonToken)) {
            node.type = parseType();
        }
    }

    function parseParameter(): lang.Parameter {
        const node = <lang.Parameter>createNode(SyntaxKind.Parameter);
        if (token === SyntaxKind.ThisKeyword) {
            const idThis = <lang.Identifier>createNode(SyntaxKind.Identifier);
            idThis.text = scanner.tokenValue!;
            idThis.originalKeywordKind = token;
            nextToken();
            node.name = finishNode(idThis);
        } else {
            node.name = parseIdentifier();
        }

        node.questionToken = parseOptionalToken(SyntaxKind.QuestionToken);
        if (parseOptional(SyntaxKind.ColonToken)) {
            node.type = parseType();
        }

        if (parseOptional(SyntaxKind.EqualsToken)) {
            node.initializer = parseConnectExp();
        }
        return finishNode(node);
    }

    function isStartOfParenthesizedArrowFunction(): boolean {
        if ((token as any) !== SyntaxKind.OpenParenToken) return false;

        let paren = 1;
        while (true) {
            switch (nextToken()) {
                case SyntaxKind.OpenParenToken:
                    paren++;
                    break;
                case SyntaxKind.CloseParenToken:
                    paren--;
                    break;
                case SyntaxKind.EndOfFileToken:
                    error('Unmatched parentheses');
                    return false;
                default:
                    continue;
            }
            if (paren === 0) {
                nextToken();
                break;
            }
        }
        if (token === SyntaxKind.ColonToken && canBeType(nextToken()) && nextToken() === SyntaxKind.EqualsGreaterThanToken ||
            token === SyntaxKind.EqualsGreaterThanToken) {
            return true;
        } else {
            return false;
        }
    }

    function isStartOfArrowFunctionWithCallSignature(): boolean {
        if (!parseOptional(SyntaxKind.LessThanToken)) return false;
        let angleBracket = 1;
        while (true) {
            switch (nextToken()) {
                case SyntaxKind.LessThanToken:
                    angleBracket++;
                    break;
                case SyntaxKind.GreaterThanToken:
                    angleBracket--;
                    break;
                case SyntaxKind.EndOfFileToken:
                    error('Unmatched angle bracket');
                    return false;
                default:
                    continue;
            }
            if (angleBracket === 0) {
                nextToken();
                break;
            }
        }
        if (isStartOfParenthesizedArrowFunction()) {
            return true;
        } else {
            return false;
        }
    }

    function isLeftHandExp(node: Node): node is lang.LeftHandExp {
        switch (node.kind) {
            case SyntaxKind.PropertyAccessExpression:
            case SyntaxKind.ElementAccessExpression:
            case SyntaxKind.NewExpression:
            case SyntaxKind.NewTargetExpression:
            case SyntaxKind.CallExpression:
            case SyntaxKind.TaggedTemplateExpression:
            case SyntaxKind.ArrayLiteralExpression:
            case SyntaxKind.ParenthesizedExpression:
            case SyntaxKind.ObjectLiteralExpression:
            case SyntaxKind.ClassExpression:
            case SyntaxKind.FunctionExpression:
            case SyntaxKind.NodeExpression:
            case SyntaxKind.Identifier:
            case SyntaxKind.NumericLiteral:
            case SyntaxKind.StringLiteral:
            case SyntaxKind.FalseKeyword:
            case SyntaxKind.NullKeyword:
            case SyntaxKind.ThisKeyword:
            case SyntaxKind.TrueKeyword:
            case SyntaxKind.SuperKeyword:
            case SyntaxKind.ImportKeyword:
                return true;
            default:
                return false;
        }
    }

    function isAssignOp(t: SyntaxKind): boolean {
        return token >= SyntaxKindMarker.FirstAssignment && token <= SyntaxKindMarker.LastAssignment;
    }

    function reScanGreaterToken(): SyntaxKind {
        return token = scanner.reScanGreaterToken();
    }

    function parseBinaryExp(precedence: number): lang.BinaryExp {
        const leftOperand: lang.BinaryExp = parseUnaryExp();
        return parseBinaryExpRest(precedence, leftOperand);
    }

    function parseBinaryExpRest(precedence: number, leftOperand: lang.BinaryExp): lang.BinaryExp {
        while (true) {
            reScanGreaterToken();
            const newPrecedence = getBinaryOperatorPrecedence(token);

            const consumeCurrentOperator = token === SyntaxKind.AsteriskAsteriskToken
                ? newPrecedence >= precedence
                : newPrecedence > precedence;

            if (!consumeCurrentOperator) {
                break;
            }

            if (token === SyntaxKind.AsKeyword) {
                leftOperand = makeAsExpression(leftOperand, parseTokenNode(), parseType());
            } else {
                leftOperand = makeBinaryExpression(leftOperand, parseTokenNode(), parseBinaryExp(newPrecedence));
            }
        }

        return leftOperand;
    }

    function makeAsExpression(left: lang.BinaryExp, operatorToken: Token<SyntaxKind.AsKeyword>, right: lang.Type): lang.AsExpression {
        const node = <lang.AsExpression>createNode(SyntaxKind.AsExpression, left.pos);
        node.left = left;
        node.operatorToken = operatorToken;
        node.right = right;
        return finishNode(node);
    }

    function makeBinaryExpression(left: lang.BinaryExp, operatorToken: Token<lang.BinaryOperator>, right: lang.BinaryExp): lang.BinaryExpression {
        const node = <lang.BinaryExpression>createNode(SyntaxKind.BinaryExpression, left.pos);
        node.left = left;
        node.operatorToken = operatorToken;
        node.right = right;
        return finishNode(node);
    }


    function getBinaryOperatorPrecedence(kind: SyntaxKind): number {
        switch (kind) {
            case SyntaxKind.QuestionQuestionToken:
                return 4;
            case SyntaxKind.BarBarToken:
                return 5;
            case SyntaxKind.AmpersandAmpersandToken:
                return 6;
            case SyntaxKind.BarToken:
                return 7;
            case SyntaxKind.CaretToken:
                return 8;
            case SyntaxKind.AmpersandToken:
                return 9;
            case SyntaxKind.EqualsEqualsToken:
            case SyntaxKind.ExclamationEqualsToken:
            case SyntaxKind.EqualsEqualsEqualsToken:
            case SyntaxKind.ExclamationEqualsEqualsToken:
                return 10;
            case SyntaxKind.LessThanToken:
            case SyntaxKind.GreaterThanToken:
            case SyntaxKind.LessThanEqualsToken:
            case SyntaxKind.GreaterThanEqualsToken:
            case SyntaxKind.InstanceOfKeyword:
            case SyntaxKind.InKeyword:
            case SyntaxKind.AsKeyword:
                return 11;
            case SyntaxKind.LessThanLessThanToken:
            case SyntaxKind.GreaterThanGreaterThanToken:
            case SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
                return 12;
            case SyntaxKind.PlusToken:
            case SyntaxKind.MinusToken:
                return 13;
            case SyntaxKind.AsteriskToken:
            case SyntaxKind.SlashToken:
            case SyntaxKind.PercentToken:
                return 14;
            case SyntaxKind.AsteriskAsteriskToken:
                return 15;
        }

        // -1 is lower than all other precedences.  Returning it will cause binary expression
        // parsing to stop.
        return -1;
    }

    function parseUnaryExp(): lang.UnaryExp {
        switch (token) {
            case SyntaxKind.DeleteKeyword:
            case SyntaxKind.VoidKeyword:
            case SyntaxKind.TypeOfKeyword:
            case SyntaxKind.AwaitKeyword:
            case SyntaxKind.PlusToken:
            case SyntaxKind.MinusToken:
            case SyntaxKind.TildeToken:
            case SyntaxKind.ExclamationToken:
                const node = <lang.PrefixUnaryExpression>createNode(SyntaxKind.PrefixUnaryExpression);
                node.operator = token;
                nextToken();
                node.operand = parseUnaryExp();
                return finishNode(node);
            case SyntaxKind.LessThanToken:
                return parseTypeAssertion();
            default:
                return parseUpdateExp();
        }
    }

    function parseTypeAssertion(): lang.TypeAssertionExpression {
        const node = <lang.TypeAssertionExpression>createNode(SyntaxKind.TypeAssertionExpression);
        parseExpected(SyntaxKind.LessThanToken);
        node.type = parseType();
        parseExpected(SyntaxKind.GreaterThanToken);
        node.operand = parseUnaryExp();
        return finishNode(node);
    }

    function parseUpdateExp(): lang.UpdateExp {
        if (token === SyntaxKind.PlusPlusToken ||
            token === SyntaxKind.MinusMinusToken) {
            const node = <lang.PrefixUpdateExpression>createNode(SyntaxKind.PrefixUpdateExpression);
            node.operator = token;
            nextToken();
            node.operand = parseUnaryExp();
            return finishNode(node);
        }
        const expr: lang.LeftHandExp = parseLeftHandExp();
        assert(isLeftHandExp(expr));
        if ((token as SyntaxKind) === SyntaxKind.PlusPlusToken ||
            (token as SyntaxKind) === SyntaxKind.MinusMinusToken
        ) {
            const node = <lang.PostfixUpdateExpression>createNode(SyntaxKind.PostfixUpdateExpression, expr.pos);
            node.operand = expr;
            node.operator = token as lang.UpdateOperator;
            nextToken();
            return finishNode(node);
        }

        return expr;
    }

    function parseLeftHandExp(): lang.LeftHandExp {
        const expr = parseMemberExp();
        return parseCallExpRest(expr);
    }

    function parseMemberExp(): lang.MemberExp {
        if (token === SyntaxKind.NewKeyword &&
            lookAhead(() =>
                nextToken() === SyntaxKind.DotToken
                && nextToken()
                && scanner.tokenValue === 'target')
        ) {
            const node = <lang.NewTargetExpression>createNode(SyntaxKind.NewTargetExpression);
            nextToken(); // .
            nextToken(); // target
            nextToken();
            return finishNode(node);
        }
        const expr = parsePrimaryExp();
        return parseMemberExpRest(expr) as lang.MemberExp;
    }

    function parseMemberExpRest(expr: lang.LeftHandExp): lang.LeftHandExp {
        while (true) {
            let isAccess = false;
            let isPropertyAccess = false;
            let isOptionalChain = false;
            lookAhead(() => {
                if (token === SyntaxKind.DotToken) {
                    if (nextToken() && scanner.isIdentifier()) {
                        isAccess = true;
                        isPropertyAccess = true;
                    }
                } else if (token === SyntaxKind.OpenBracketToken) {
                    isAccess = true;
                } else if (token === SyntaxKind.QuestionDotToken) {
                    isOptionalChain = true;
                    nextToken();
                    if ((token as SyntaxKind) === SyntaxKind.OpenBracketToken) {
                        isAccess = true;
                    } else if ((token as SyntaxKind) === SyntaxKind.Identifier) {
                        isAccess = true;
                        isPropertyAccess = true;
                    }
                }
            });
            if (!isAccess) return expr;

            if (isPropertyAccess) {
                const node = <lang.PropertyAccessExpression>createNode(SyntaxKind.PropertyAccessExpression, expr.pos);
                node.expression = expr;
                node.questionDotToken = isOptionalChain
                    ? parseOptionalToken(SyntaxKind.QuestionDotToken)
                    : (nextToken(), undefined);
                node.name = parseIdentifier();
                expr = finishNode(node);
                continue;
            }

            const node = <lang.ElementAccessExpression>createNode(SyntaxKind.ElementAccessExpression, expr.pos);
            node.expression = expr;
            node.questionDotToken = isOptionalChain
                ? parseOptionalToken(SyntaxKind.QuestionDotToken)
                : undefined;
            nextToken();
            node.argumentExpression = parseExpression();
            parseExpected(SyntaxKind.CloseBracketToken);
            expr = finishNode(node);
        }
    }

    function parseCallExpRest(expr: lang.LeftHandExp): lang.LeftHandExp {
        while (true) {
            expr = parseMemberExpRest(expr);
            const questionDotToken = parseOptionalToken(SyntaxKind.QuestionDotToken);

            if (token === SyntaxKind.LessThanToken) {
                const typeArguments = tryParse(parseTypeArgumentsInExpression);
                if (typeArguments) {
                    const callExpr = <lang.CallExpression>createNode(SyntaxKind.CallExpression, expr.pos);
                    callExpr.expression = expr;
                    callExpr.questionDotToken = questionDotToken;
                    callExpr.typeArguments = typeArguments;
                    callExpr.arguments = parseArguments();
                    expr = finishNode(callExpr);
                    continue;
                }
            } else if (token === SyntaxKind.OpenParenToken) {
                const callExpr = <lang.CallExpression>createNode(SyntaxKind.CallExpression, expr.pos);
                callExpr.expression = expr;
                callExpr.questionDotToken = questionDotToken;
                callExpr.arguments = parseArguments();
                expr = finishNode(callExpr);
                continue;
            }

            if (questionDotToken) {
                error('Identifier expected.');
            }

            break;
        }
        return expr;
    }

    function parseTypeArgumentsInExpression(): lang.NodeList<lang.Type> | undefined {
        if (!parseOptional(SyntaxKind.LessThanToken)) return undefined;

        const typeArguments = parseTypeArgumentList();

        if (!typeArguments || !parseOptional(SyntaxKind.GreaterThanToken)) return undefined;

        if (token !== SyntaxKind.OpenParenToken) return undefined;

        return typeArguments;
    }

    function parseArguments(): lang.Arguments {
        const node = <lang.Arguments>createNode(SyntaxKind.Arguments);
        parseExpected(SyntaxKind.OpenParenToken);
        node.list = parseDelimitedList(ParsingContext.ArgumentExpressions, parseArgument);
        parseExpected(SyntaxKind.CloseParenToken);
        return finishNode(node);
    }

    function parseArgument(): lang.ConnectExp | lang.SpreadExpression {
        if (token === SyntaxKind.DotDotDotToken) {
            const node: lang.SpreadExpression = <lang.SpreadExpression>createNode(SyntaxKind.SpreadExpression);
            nextToken();
            node.expression = parseConnectExp();
            return finishNode(node);
        } else {
            return parseConnectExp();
        }
    }

    function parsePrimaryExp(): lang.PrimaryExp {
        switch (token) {
            case SyntaxKind.NumericLiteral:
            case SyntaxKind.StringLiteral:
                const node: any = createNode(token);
                node.text = scanner.tokenText;
                if (token === SyntaxKind.NumericLiteral) {
                    node.numericLiteralFlags = scanner.tokenFlags;
                }
                nextToken();
                return finishNode(node);
            case SyntaxKind.ThisKeyword:
            case SyntaxKind.SuperKeyword:
            case SyntaxKind.NullKeyword:
            case SyntaxKind.TrueKeyword:
            case SyntaxKind.FalseKeyword:
            case SyntaxKind.ImportKeyword:
                return parseTokenNode<lang.PrimaryExp>();
            case SyntaxKind.OpenParenToken:
                return parseParenthesizedExpression();
            case SyntaxKind.OpenBracketToken:
                return parseArrayLiteralExpression();
            case SyntaxKind.OpenBraceToken:
                return parseObjectLiteralExpression();
            case SyntaxKind.ClassKeyword:
                return parseClassExpression();
            case SyntaxKind.FunctionKeyword:
                return parseFunctionExpressionWithoutModifiers();
            case SyntaxKind.NodeKeyword:
            case SyntaxKind.SubnetKeyword:
                if (!isStartOfNode_()) break;
                return parseNodeExpressionWithoutModifiers();
            case SyntaxKind.NewKeyword:
                return parseNewExpression();
            case SyntaxKind.AsyncKeyword:
                let next!: SyntaxKind;
                lookAhead(() => next = nextToken());
                if (next === SyntaxKind.FunctionKeyword) {
                    const pos = scanner.startPos;
                    const modifiers = createNodeList([parseTokenNode()], pos) as lang.ModifiersList;
                    const node = <lang.FunctionExpression>createNode(SyntaxKind.FunctionExpression, pos);
                    node.modifiers = modifiers;
                    return parseFunctionExpressionWithoutModifiers({ node });
                } else if (next === SyntaxKind.NodeKeyword || next === SyntaxKind.SubnetKeyword) {
                    const pos = scanner.startPos;
                    const modifiers = createNodeList([parseTokenNode()], pos) as lang.ModifiersList;
                    const node = <lang.NodeExpression>createNode(SyntaxKind.NodeExpression, pos);
                    node.modifiers = modifiers;
                    return parseNodeExpressionWithoutModifiers({ node });
                }
        }

        return parseIdentifier();
    }

    function parseParenthesizedExpression() {
        const node = <lang.ParenthesizedExpression>createNode(SyntaxKind.ParenthesizedExpression);
        parseExpected(SyntaxKind.OpenParenToken);
        node.expression = parseExpression();
        parseExpected(SyntaxKind.CloseParenToken);
        return finishNode(node);
    }

    function parseArrayLiteralExpression(): lang.ArrayLiteral {
        const node = <lang.ArrayLiteral>createNode(SyntaxKind.ArrayLiteralExpression);
        parseExpected(SyntaxKind.OpenBracketToken);
        node.elements = parseDelimitedList(ParsingContext.ArrayLiteralMembers, parseArrayElement);
        parseExpected(SyntaxKind.CloseBracketToken);
        return finishNode(node);
    }
    function parseArrayElement(): lang.ConnectExp | lang.SpreadExpression | lang.OmittedExpression {
        if (token === SyntaxKind.DotDotDotToken) {
            const node: lang.SpreadExpression = <lang.SpreadExpression>createNode(SyntaxKind.SpreadExpression);
            nextToken();
            node.expression = parseConnectExp();
            return finishNode(node);
        } else if (token !== SyntaxKind.CommaToken) {
            return parseConnectExp();
        } else {
            const node = <lang.OmittedExpression>createNode(SyntaxKind.OmittedExpression);
            return node;
        }
    }

    function parseObjectLiteralExpression(): lang.ObjectLiteral {
        const node = <lang.ObjectLiteral>createNode(SyntaxKind.ObjectLiteralExpression);
        parseExpected(SyntaxKind.OpenBraceToken);
        node.properties = parseDelimitedList(ParsingContext.ObjectLiteralMembers, parseObjectDefinition);
        parseExpected(SyntaxKind.CloseBraceToken);
        return finishNode(node);
    }

    function parseObjectDefinition(): lang.PropertyDefinition {
        const node = <lang.PropertyDefinition>createNode(SyntaxKind.Unknown);
        if (parseOptional(SyntaxKind.DotDotDotToken)) {
            node.kind = SyntaxKind.SpreadExpression;
            (node as lang.SpreadExpression).expression = parseConnectExp();
            return finishNode(node);
        }

        if (token === SyntaxKind.Identifier && lookAhead(() => nextToken() !== SyntaxKind.ColonToken)) {
            node.kind = SyntaxKind.ShorthandPropertyAssignment;
            (node as lang.ShorthandPropertyAssignment).name = parseIdentifier();
            return finishNode(node);
        }

        node.kind = SyntaxKind.PropertyAssignment;
        if (token === SyntaxKind.OpenBracketToken) {
            const computedPropertyName = <lang.ComputedPropertyName>createNode(SyntaxKind.ComputedPropertyName);
            nextToken();
            computedPropertyName.expression = parseConnectExp();
            parseExpected(SyntaxKind.CloseBracketToken);
            (node as lang.PropertyAssignment).name = finishNode(computedPropertyName);
        } else {
            if (scanner.isIdentifier()) {
                (node as lang.PropertyAssignment).name = parseIdentifier();
            } else if (token === SyntaxKind.StringLiteral || token === SyntaxKind.NumericLiteral) {
                const literal: any = createNode(token);
                literal.text = scanner.tokenText;
                if (token === SyntaxKind.NumericLiteral) {
                    literal.numericLiteralFlags = scanner.tokenFlags;
                }
                nextToken();
                (node as lang.PropertyAssignment).name = finishNode(literal);
            } else {
                error('Expect valid ObjectPropertyName.');
            }
        }

        parseExpected(SyntaxKind.ColonToken);
        (node as lang.PropertyAssignment).initializer = parseConnectExp();
        return finishNode(node);
    }

    function parseNewExpression(): lang.NewExpression {
        const node = <lang.NewExpression>createNode(SyntaxKind.NewExpression);
        parseExpected(SyntaxKind.NewKeyword);
        node.expression = parseMemberExp();

        const typeArguments = tryParse(parseTypeArgumentsInExpression);
        if (typeArguments) node.typeArguments = typeArguments;

        node.arguments = parseArguments();
        return finishNode(node);
    }

    function parseTypeParameters(): lang.NodeList<lang.TypeParameter> | undefined {
        if (!parseOptional(SyntaxKind.LessThanToken)) return undefined;
        const list = [];
        const listPos = scanner.startPos;
        while (token !== SyntaxKind.GreaterThanToken) {
            const node = <lang.TypeParameter>createNode(SyntaxKind.TypeParameter);
            if (!scanner.isIdentifier()) return undefined;
            node.name = parseIdentifier();
            if (token === SyntaxKind.ExtendsKeyword) {
                nextToken();
                if (!canBeType(token)) return undefined;
                node.constraint = parseType();
            }
            list.push(finishNode(node));
            if (!parseOptional(SyntaxKind.CommaToken)) break;
        }
        if (!parseOptional(SyntaxKind.GreaterThanToken)) return undefined;
        return createNodeList(list, listPos);
    }
    function parseTypeArgumentList(listTerminatorIsSemicolon = false): lang.NodeList<lang.Type> | undefined {
        const list = [];
        const listPos = scanner.startPos;
        const listTerminator = listTerminatorIsSemicolon
            ? SyntaxKind.SemicolonToken
            : SyntaxKind.GreaterThanToken;
        while (token !== listTerminator) {
            if (!canBeType(token)) return undefined;
            list.push(parseType());
            if (!parseOptional(SyntaxKind.CommaToken)) break;
        }
        return createNodeList(list, listPos);
    }

    function parseType(): lang.Type {
        if (!canBeType(token)) {
            error('Type literal expected.');
            const node = <lang.Type>createNode(SyntaxKind.UnknownKeyword);
            return finishNode(node);
        }
        const node = <lang.Type>createNode(token);
        nextToken();
        return finishNode(node);
    }

    function canBeType(t: SyntaxKind): boolean {
        switch (t) {
            case SyntaxKind.AnyKeyword:
            case SyntaxKind.UnknownKeyword:
            case SyntaxKind.NumberKeyword:
            case SyntaxKind.BigIntKeyword:
            case SyntaxKind.ObjectKeyword:
            case SyntaxKind.BooleanKeyword:
            case SyntaxKind.StringKeyword:
            case SyntaxKind.SymbolKeyword:
            case SyntaxKind.ThisKeyword:
            case SyntaxKind.VoidKeyword:
            case SyntaxKind.UndefinedKeyword:
            case SyntaxKind.NullKeyword:
            case SyntaxKind.NeverKeyword:
                return true;
            default:
                return false;
        }
    }

    function parseVariableDeclarationWithoutModifiers(opts?: {
        notParseSemicolon?: boolean,
        node?: lang.VariableDeclaration,
    }): lang.VariableDeclaration {
        opts = opts || {};
        const notParseSemicolon = opts.notParseSemicolon || false;
        const node = opts.node || <lang.VariableDeclaration>createNode(SyntaxKind.VariableDeclaration);
        if (!isCurrentTokenVLC()) {
            error('var/let/const expected.');
            node.vlc = SyntaxKind.LetKeyword;
        } else {
            node.vlc = token as any;
            nextToken();
        }
        node.isWalrus = false;

        node.declarations = parseDelimitedList(ParsingContext.VariableDeclarations, parseVariableBinding);
        if (!notParseSemicolon) parseExpected(SyntaxKind.SemicolonToken);
        return finishNode(node);
    }

    function parseVariableBinding(): lang.VariableBinding {
        const node = <lang.VariableBinding>createNode(SyntaxKind.VariableBinding);
        node.name = parseIdentifier();
        if (parseOptional(SyntaxKind.EqualsToken)) {
            node.initializer = parseConnectExp();
        }
        return finishNode(node);
    }

    function parseClassExpression(): lang.ClassExpression {
        return undefined as any;
    }

    function parseFunctionExpressionWithoutModifiers(opts?: { node?: lang.FunctionExpression }): lang.FunctionExpression {
        opts = opts || {};
        const node = opts.node || <lang.FunctionExpression>createNode(SyntaxKind.FunctionExpression);
        const fn = parseFunctionWithoutModifiers(node) as lang.FunctionExpression;
        if (!fn.body) {
            error('Function expression must have body block.');
        }
        return fn;
    }

    function parseFunctionWithoutModifiers(node: lang.Function_): lang.Function_ {
        parseExpected(SyntaxKind.FunctionKeyword);
        node.asteriskToken = parseOptionalToken(SyntaxKind.AsteriskToken);
        if (scanner.isIdentifier()) {
            node.name = parseIdentifier();
        }
        addCallSignature(node);
        switch (token) {
            case SyntaxKind.SemicolonToken:
                nextToken();
                return finishNode(node);
            case SyntaxKind.OpenBraceToken:
                node.body = parseBlock();
                return finishNode(node);
            default:
                error('; or block expected.');
                return finishNode(node);
        }
    }

    function isStartOfNode_(): boolean {
        return lookAhead(isStartOfNode_Worker);
    }

    function isStartOfNode_Worker(): boolean {
        if (token !== SyntaxKind.NodeKeyword &&
            token !== SyntaxKind.SubnetKeyword) return false;

        nextToken();
        if (scanner.isIdentifier() ||
            (token as any) === SyntaxKind.OpenBraceToken) return true;

        if ((token as any) === SyntaxKind.OpenParenToken) {
            let paren = 1;
            while (true) {
                switch (nextToken()) {
                    case SyntaxKind.OpenParenToken:
                        paren++;
                        break;
                    case SyntaxKind.CloseParenToken:
                        paren--;
                        break;
                    case SyntaxKind.EndOfFileToken:
                        return false;
                }
                if (paren === 0) break;
            }
            return nextToken() === SyntaxKind.OpenBraceToken;
        }
        return false;
    }

    function parseNodeExpressionWithoutModifiers(opts?: { node?: lang.NodeExpression }): lang.NodeExpression {
        opts = opts || {};
        const node = opts.node || <lang.NodeExpression>createNode(SyntaxKind.NodeExpression);
        return parseNode_WithoutModifiers(node) as lang.NodeExpression;
    }

    function parseNode_WithoutModifiers(node: lang.Node_): lang.Node_ {
        if (token === SyntaxKind.NodeKeyword) {
            node.isSubnet = false;
        } else if (token === SyntaxKind.SubnetKeyword) {
            node.isSubnet = true;
        } else {
            error('node or subnet expected.');
            return finishNode(node);
        }
        nextToken();
        if (scanner.isIdentifier()) {
            node.name = parseIdentifier();
        }
        if (parseOptional(SyntaxKind.OpenParenToken)) {
            node.parameters = parseDelimitedList(ParsingContext.Parameters, parseParameter);
            parseExpected(SyntaxKind.CloseParenToken);
        }

        const nodeBlock = createNode(SyntaxKind.NodeBlock) as lang.NodeBlock;
        parseExpected(SyntaxKind.OpenBraceToken);
        nodeBlock.statements = parseList(ParsingContext.NodeBlock, parseNodeStatement);
        parseExpected(SyntaxKind.CloseBraceToken);

        node.nodeBlock = finishNode(nodeBlock);

        return finishNode(node);
    }

    function parseNodeStatement(): lang.NodeStatement {
        if (token === SyntaxKind.StateKeyword && lookAhead(() =>
            nextToken() === SyntaxKind.ColonToken
        )) {
            const node = <lang.NodeStateDeclaration>createNode(SyntaxKind.NodeStateDeclaration);
            node.kind = SyntaxKind.NodeStateDeclaration;
            nextToken(); nextToken();
            (node as lang.NodeStateDeclaration).expression = parseAssignExp();
            parseSemicolon();
            return finishNode(node);
        }

        let whichKind = 0;
        if (token === SyntaxKind.Identifier) {
            const name = scanner.tokenValue!;
            if (name === '$$' || name.charAt(0) === '$') {
                if (lookAhead(() => nextToken() === SyntaxKind.ColonToken)) {
                    whichKind = name === '$$' ? 1 : 2;
                }
            }
        }

        if (whichKind === 0) return parseStatement();
        if (whichKind === 1) {
            const node = <lang.NodeAllPortTypeDeclaration>createNode(SyntaxKind.NodeAllPortTypeDeclaration);
            nextToken();
            nextToken();
            const types = parseTypeArgumentList(/*listTerminatorIsSemicolon*/true);
            if (!types) {
                error('Expected list of type argument.');
            }
            node.types = types!;
            parseSemicolon();
            return finishNode(node);
        }
        const node = <lang.NodePortTypeDeclaration>createNode(SyntaxKind.NodePortTypeDeclaration);
        node.portName = parseIdentifier();
        nextToken();
        node.type = parseType();
        parseSemicolon();
        return finishNode(node);
    }


    function isStartOfDeclaration(): boolean {
        return lookAhead(isDeclaration);
    }

    function isDeclaration(): boolean {
        while (true) {
            switch ((token as any)) {
                case SyntaxKind.VarKeyword:
                case SyntaxKind.LetKeyword:
                case SyntaxKind.ConstKeyword:
                case SyntaxKind.FunctionKeyword:
                case SyntaxKind.ClassKeyword:
                case SyntaxKind.EnumKeyword:
                    return true;

                case SyntaxKind.NodeKeyword:
                case SyntaxKind.SubnetKeyword:
                    return isStartOfNode_();

                case SyntaxKind.InterfaceKeyword:
                case SyntaxKind.TypeKeyword:
                    return (nextToken(), scanner.isIdentifier());
                case SyntaxKind.NamespaceKeyword:
                    return (nextToken(), scanner.isIdentifier() || token === SyntaxKind.StringLiteral);

                case SyntaxKind.AbstractKeyword:
                case SyntaxKind.AsyncKeyword:
                    nextToken();
                    continue;

                case SyntaxKind.ImportKeyword:
                    nextToken();
                    return token === SyntaxKind.StringLiteral || token === SyntaxKind.AsteriskToken ||
                        token === SyntaxKind.OpenBraceToken || scanner.isIdentifier();
                case SyntaxKind.ExportKeyword:
                    nextToken();
                    if (token === SyntaxKind.AsteriskToken ||
                        token === SyntaxKind.OpenBraceToken || token === SyntaxKind.DefaultKeyword) {
                        return true;
                    }
                    continue;
                default:
                    return false;
            }
        }
    }

    function parseDeclaration(): lang.Declaration {
        const node = <lang.Declaration>createNode(SyntaxKind.Unknown);
        const decorators = parseDecorators();
        const modifiers = parseModifiers();
        if (decorators) (node as any).decorators = decorators;
        if (modifiers) (node as any).modifiers = modifiers;
        return parseDeclarationWorker(node);
    }

    function parseDecorators(): NodeList<lang.Decorator> | undefined {
        let list: lang.Decorator[] | undefined;
        const listPos = scanner.startPos;
        while (true) {
            const decoratorStart = scanner.startPos;
            if (!parseOptional(SyntaxKind.AtToken)) {
                break;
            }
            const decorator = <lang.Decorator>createNode(SyntaxKind.Decorator, decoratorStart);
            decorator.expression = parseLeftHandExp();
            finishNode(decorator);
            (list || (list = [])).push(decorator);
        }
        return list && createNodeList(list, listPos);
    }

    function parseModifiers(): NodeList<lang.Modifier> | undefined {
        let list: lang.Modifier[] | undefined;
        const listPos = scanner.startPos;
        while (true) {
            const modifierStart = scanner.startPos;
            const modifierKind = token;

            if (!parseAnyContextualModifier()) {
                break;
            }

            const modifier = finishNode(<lang.Modifier>createNode(modifierKind, modifierStart));
            (list || (list = [])).push(modifier);
        }
        return list && createNodeList(list, listPos);
    }

    function parseAnyContextualModifier(): boolean {
        return isModifierKind(token) && tryParse(nextTokenCanFollowModifier);
    }

    function isModifierKind(token: SyntaxKind): token is lang.Modifier["kind"] {
        switch (token) {
            case SyntaxKind.AbstractKeyword:
            case SyntaxKind.AsyncKeyword:
            case SyntaxKind.ConstKeyword:
            case SyntaxKind.DefaultKeyword:
            case SyntaxKind.ExportKeyword:
                return true;
        }
        return false;
    }

    function nextTokenCanFollowModifier(): boolean {
        switch ((token as any)) {
            case SyntaxKind.ConstKeyword:
                // 'const' is just a modifier if followed by 'enum'
                return nextToken() === SyntaxKind.EnumKeyword;
            case SyntaxKind.ExportKeyword:
                nextToken();
                if (token === SyntaxKind.DefaultKeyword) {
                    return lookAhead(() => {
                        nextToken();
                        return tokenCanFollowDefaultKeyword();
                    });
                }
                return tokenCanFollowExportKeyword();
            case SyntaxKind.DefaultKeyword:
                nextToken();
                return tokenCanFollowDefaultKeyword();
            case SyntaxKind.AbstractKeyword:
                return nextToken() === SyntaxKind.ClassKeyword;
            case SyntaxKind.AsyncKeyword:
                nextToken();
                return token === SyntaxKind.FunctionKeyword ||
                    token === SyntaxKind.NodeKeyword ||
                    token === SyntaxKind.SubnetKeyword;
        }
        return false;
    }

    function tokenCanFollowDefaultKeyword(): boolean {
        return token === SyntaxKind.ClassKeyword ||
            token === SyntaxKind.FunctionKeyword ||
            token === SyntaxKind.NodeKeyword ||
            token === SyntaxKind.SubnetKeyword ||
            token === SyntaxKind.AbstractKeyword && lookAhead(nextTokenIsClassKeyword) ||
            token === SyntaxKind.AsyncKeyword && lookAhead(nextTokenIsFunctionOrNodeOrSubnetKeyword);
    }
    function nextTokenIsClassKeyword(): boolean {
        nextToken();
        return token === SyntaxKind.ClassKeyword;
    }
    function nextTokenIsFunctionOrNodeOrSubnetKeyword(): boolean {
        nextToken();
        return token === SyntaxKind.FunctionKeyword ||
            token === SyntaxKind.NodeKeyword ||
            token === SyntaxKind.SubnetKeyword;
    }

    function tokenCanFollowExportKeyword(): boolean {
        if (tokenCanFollowDefaultKeyword()) return true;
        return token === SyntaxKind.InterfaceKeyword && lookAhead(nextTokenIsIdentifier) ||
            token === SyntaxKind.TypeKeyword && lookAhead(nextTokenIsIdentifier) ||
            token === SyntaxKind.EnumKeyword && lookAhead(nextTokenIsIdentifier) ||
            token === SyntaxKind.NamespaceKeyword && lookAhead(nextTokenIsIdentifierOrStringLiteral);
    }

    function nextTokenIsIdentifier() {
        return nextToken(), scanner.isIdentifier();
    }
    function nextTokenIsIdentifierOrStringLiteral() {
        nextToken();
        return scanner.isIdentifier() || token === SyntaxKind.StringLiteral;
    }

    function parseDeclarationWorker(node: lang.Declaration): lang.Declaration {
        switch (token) {
            case SyntaxKind.VarKeyword:
            case SyntaxKind.LetKeyword:
            case SyntaxKind.ConstKeyword:
                node.kind = SyntaxKind.VariableDeclaration;
                return parseVariableDeclarationWithoutModifiers({ node: node as any });
            case SyntaxKind.FunctionKeyword:
                node.kind = SyntaxKind.FunctionDeclaration;
                return parseFunctionWithoutModifiers(node as any) as lang.FunctionDeclaration;
            case SyntaxKind.ClassKeyword:
                return {} as any;
            case SyntaxKind.InterfaceKeyword:
                return {} as any;
            case SyntaxKind.TypeKeyword:
                return {} as any;
            case SyntaxKind.EnumKeyword:
                return {} as any;
            case SyntaxKind.NamespaceKeyword:
                return {} as any;
            case SyntaxKind.ImportKeyword:
                return {} as any;
            case SyntaxKind.ExportKeyword:
                return {} as any;
            case SyntaxKind.NodeKeyword:
            case SyntaxKind.SubnetKeyword:
                node.kind = SyntaxKind.NodeDeclaration;
                return parseNode_WithoutModifiers(node as any) as lang.NodeDeclaration;
            default:
                return {} as any;
        }
    }
}
