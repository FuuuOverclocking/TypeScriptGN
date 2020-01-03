import { SyntaxKind, TokenFlags } from './lang-types';

export const enum ParsingContext {
    SourceElements,            // Elements in source file
    BlockStatements,           // Statements in block
    SwitchClauses,             // Clauses in switch statement
    SwitchClauseStatements,    // Statements in switch clause
    VariableDeclarations,      // Variable declarations in variable statement
    ArgumentExpressions,       // Expressions in argument list
    ObjectLiteralMembers,      // Members in object literal
    ArrayLiteralMembers,       // Members in array literal
    Parameters,                // Parameters in parameter list
    NodeBlock,
    Count,                     // Number of parsing contexts
}

export interface TextRange {
    pos: number;
    end: number;
}

export interface Node extends TextRange {
    kind: SyntaxKind;
    flags: NodeFlags;
    parent: Node;
}

export interface NodeList<T extends Node> extends ReadonlyArray<T>, TextRange {
    hasTrailingDelimiter?: boolean;
}

export type Modifier =
    | Token<SyntaxKind.AbstractKeyword>
    | Token<SyntaxKind.AsyncKeyword>
    | Token<SyntaxKind.ConstKeyword>
    | Token<SyntaxKind.DeclareKeyword>
    | Token<SyntaxKind.DefaultKeyword>
    | Token<SyntaxKind.ExportKeyword>
    | Token<SyntaxKind.PublicKeyword>
    | Token<SyntaxKind.PrivateKeyword>
    | Token<SyntaxKind.ProtectedKeyword>
    | Token<SyntaxKind.ReadonlyKeyword>
    | Token<SyntaxKind.StaticKeyword>
    ;

export type ModifiersList = NodeList<Modifier>;

export const enum NodeFlags {
    None = 0,
}

export interface Token<TKind extends SyntaxKind> extends Node {
    kind: TKind;
}

export interface Statement extends Node {
    _statementBrand: any;
}
export interface Declaration extends Statement {
    _declarationBrand: any;
}
export interface Expression extends Node {
    _expressionBrand: any;
}

/***************** Structure of abstract expression *****************/

export interface ConnectExp extends Expression {
    _connectExpBrand: any;
}
export interface AssignExp extends ConnectExp {
    _assignExpBrand: any;
}
export interface ConditionalExp extends AssignExp {
    _conditionalExpBrand: any;
}
export interface BinaryExp extends ConditionalExp {
    _binaryExpBrand: any;
}
export interface UnaryExp extends BinaryExp {
    _unaryExpBrand: any;
}
export interface UpdateExp extends UnaryExp {
    _updateExpBrand: any;
}
export interface LeftHandExp extends UpdateExp {
    _leftHandBrand: any;
}
export interface MemberExp extends LeftHandExp {
    _memberExpBrand: any;
}
export interface CallExp extends LeftHandExp {
    _callExpBrand: any;
}
export interface PrimaryExp extends MemberExp {
    _primaryExpBrand: any;
}

/***************** Implementation of Expression *****************/

// e.g. [,,,] has 3 OmittedExpression
export interface OmittedExpression extends Expression {
    kind: SyntaxKind.OmittedExpression;
}

export interface ThisExpression extends PrimaryExp {
    kind: SyntaxKind.ThisKeyword;
}

export interface Identifier extends PrimaryExp {
    kind: SyntaxKind.Identifier;
    text: string;
    originalKeywordKind?: SyntaxKind;
}

export interface BooleanLiteral extends PrimaryExp {
    kind: SyntaxKind.TrueKeyword | SyntaxKind.FalseKeyword;
}

export interface NumericLiteral extends PrimaryExp {
    kind: SyntaxKind.NumericLiteral;
    numericLiteralFlags: TokenFlags;
    text: string;
}

export interface StringLiteral extends PrimaryExp {
    kind: SyntaxKind.StringLiteral;
    text: string;
}

export interface NullLiteral extends PrimaryExp {
    kind: SyntaxKind.NullKeyword;
}

export interface ArrayLiteral extends PrimaryExp {
    kind: SyntaxKind.ArrayLiteralExpression;
    elements: NodeList<ConnectExp | SpreadExpression | OmittedExpression>;
}
export interface ObjectLiteral extends PrimaryExp {
    kind: SyntaxKind.ObjectLiteralExpression;
    properties: NodeList<PropertyDefinition>;
}

export type PropertyDefinition =
    | ShorthandPropertyAssignment
    | PropertyAssignment
    | SpreadExpression;

export interface ShorthandPropertyAssignment extends Node {
    kind: SyntaxKind.ShorthandPropertyAssignment;
    name: Identifier;
    parent: ObjectLiteral;
}
export interface PropertyAssignment extends Node {
    kind: SyntaxKind.PropertyAssignment;
    name: PropertyName;
    initializer: ConnectExp;
    parent: ObjectLiteral;
}
export type PropertyName = Identifier | StringLiteral | NumericLiteral | ComputedPropertyName;
export interface ComputedPropertyName extends Node {
    kind: SyntaxKind.ComputedPropertyName;
    parent: PropertyAssignment;
    expression: ConnectExp;
}
export interface SpreadExpression extends Node {
    kind: SyntaxKind.SpreadExpression;
    expression: ConnectExp;
}
export interface FunctionExpression extends Function_, PrimaryExp {
    kind: SyntaxKind.FunctionExpression;
}
export interface ClassExpression extends Class_, PrimaryExp {
    kind: SyntaxKind.ClassExpression;
}
export interface NodeExpression extends Node_, PrimaryExp {
    kind: SyntaxKind.NodeExpression;
}
export interface ParenthesizedExpression extends PrimaryExp {
    kind: SyntaxKind.ParenthesizedExpression;
    // There is a common case that an expression is parenthesized
    // just for describing the structure.
    expression: Expression;
}
export interface NewExpression extends PrimaryExp {
    kind: SyntaxKind.NewExpression;
    expression: MemberExp;
    typeArguments?: NodeList<Type>;
    arguments: Arguments;
}
export interface SuperExpression extends PrimaryExp {
    kind: SyntaxKind.SuperKeyword;
}

// e.g. import.meta, import('jquery').then(...)
export interface ImportExpression extends PrimaryExp {
    kind: SyntaxKind.ImportKeyword;
}

export interface NewTargetExpression extends MemberExp {
    kind: SyntaxKind.NewTargetExpression;
}

export interface PropertyAccessExpression extends MemberExp, CallExp {
    kind: SyntaxKind.PropertyAccessExpression;
    expression: LeftHandExp;
    questionDotToken?: Token<SyntaxKind.QuestionDotToken>;
    name: Identifier;
}

export interface ElementAccessExpression extends MemberExp, CallExp {
    kind: SyntaxKind.ElementAccessExpression;
    expression: LeftHandExp;
    questionDotToken?: Token<SyntaxKind.QuestionDotToken>;
    argumentExpression: Expression;
}

export interface CallExpression extends CallExp {
    kind: SyntaxKind.CallExpression;
    expression: LeftHandExp;
    questionDotToken?: Token<SyntaxKind.QuestionDotToken>;
    typeArguments?: NodeList<Type>;
    arguments: Arguments;
}

export interface Arguments extends Node {
    kind: SyntaxKind.Arguments;
    list: NodeList<ConnectExp | SpreadExpression>;
}

export type UpdateOperator =
    | SyntaxKind.PlusPlusToken
    | SyntaxKind.MinusMinusToken
    ;

export interface PrefixUpdateExpression extends UpdateExp {
    kind: SyntaxKind.PrefixUpdateExpression;
    operator: UpdateOperator;
    operand: UnaryExp;
}
export interface PostfixUpdateExpression extends UpdateExp {
    kind: SyntaxKind.PostfixUpdateExpression;
    operator: UpdateOperator;
    operand: LeftHandExp;
}

export type PrefixUnaryOperator =
    | SyntaxKind.DeleteKeyword
    | SyntaxKind.VoidKeyword
    | SyntaxKind.TypeOfKeyword
    | SyntaxKind.AwaitKeyword
    | SyntaxKind.PlusToken
    | SyntaxKind.MinusToken
    | SyntaxKind.TildeToken
    | SyntaxKind.ExclamationToken;

export interface PrefixUnaryExpression extends UnaryExp {
    kind: SyntaxKind.PrefixUnaryExpression;
    operator: PrefixUnaryOperator;
    operand: UnaryExp;
}
export interface TypeAssertionExpression extends UnaryExp {
    kind: SyntaxKind.TypeAssertionExpression;
    operand: UnaryExp;
    type: Type
}

export interface BinaryExpression extends BinaryExp {
    kind: SyntaxKind.BinaryExpression;
    left: BinaryExp;
    operatorToken: Token<BinaryOperator>;
    right: BinaryExp;
}

export type BinaryOperator =
    | SyntaxKind.QuestionQuestionToken
    | SyntaxKind.BarBarToken
    | SyntaxKind.AmpersandAmpersandToken
    | SyntaxKind.BarToken
    | SyntaxKind.CaretToken
    | SyntaxKind.AmpersandToken
    | SyntaxKind.EqualsEqualsToken
    | SyntaxKind.ExclamationEqualsToken
    | SyntaxKind.EqualsEqualsEqualsToken
    | SyntaxKind.ExclamationEqualsEqualsToken
    | SyntaxKind.LessThanToken
    | SyntaxKind.GreaterThanToken
    | SyntaxKind.LessThanEqualsToken
    | SyntaxKind.GreaterThanEqualsToken
    | SyntaxKind.InKeyword
    | SyntaxKind.InstanceOfKeyword
    // | SyntaxKind.AsKeyword
    | SyntaxKind.LessThanLessThanToken
    | SyntaxKind.GreaterThanGreaterThanToken
    | SyntaxKind.GreaterThanGreaterThanGreaterThanToken
    | SyntaxKind.PlusToken
    | SyntaxKind.MinusToken
    | SyntaxKind.AsteriskToken
    | SyntaxKind.SlashToken
    | SyntaxKind.PercentToken
    | SyntaxKind.AsteriskAsteriskToken
    ;

export interface AsExpression extends BinaryExp {
    kind: SyntaxKind.AsExpression;
    left: BinaryExp;
    operatorToken: Token<SyntaxKind.AsKeyword>;
    right: Type;
}

export interface ConditionalExpression extends ConditionalExp {
    kind: SyntaxKind.ConditionalExpression;
    condition: Expression;
    whenTrue: Expression;
    whenFalse: Expression;
}

export interface YieldExpression extends AssignExp {
    kind: SyntaxKind.YieldExpression;
    hasAsterisk: boolean;
    expression: AssignExp;
}

export interface CallSignature {
    typeParameters?: NodeList<TypeParameter>;
    parameters: NodeList<Parameter>;
    type?: Type;
}

export interface ArrowFunction extends CallSignature, AssignExp {
    kind: SyntaxKind.ArrowFunction;
    isAsync: boolean;
    equalsGreaterThanToken: Token<SyntaxKind.EqualsGreaterThanToken>;
    body: Block | ConnectExp;
}

export interface AssignmentExpression extends AssignExp {
    kind: SyntaxKind.AssignmentExpression;
    left: LeftHandExp;
    operatorToken: Token<AssignmentOperator>;
    right: AssignExp;
}

export type AssignmentOperator =
    | SyntaxKind.EqualsToken
    | SyntaxKind.AsteriskEqualsToken
    | SyntaxKind.PercentEqualsToken
    | SyntaxKind.PlusEqualsToken
    | SyntaxKind.MinusEqualsToken
    | SyntaxKind.LessThanLessThanEqualsToken
    | SyntaxKind.GreaterThanGreaterThanEqualsToken
    | SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken
    | SyntaxKind.AmpersandEqualsToken
    | SyntaxKind.CaretEqualsToken
    | SyntaxKind.BarEqualsToken
    | SyntaxKind.AsteriskAsteriskEqualsToken
    ;

export interface ConnectionExpression extends ConnectExp {
    kind: SyntaxKind.ConnectionExpression;
    left: AssignExp;
    right: AssignExp;
}

export interface CommaExpression extends Expression {
    kind: SyntaxKind.CommaExpression;
    left: ConnectExp;
    right: ConnectExp;
}

/***************** Part of Type *****************/
export interface Type extends Node {
    _typeBrand: any;
}
export interface KeywordTypeNode extends Type {
    kind:
    | SyntaxKind.AnyKeyword
    | SyntaxKind.UnknownKeyword
    | SyntaxKind.NumberKeyword
    | SyntaxKind.BigIntKeyword
    | SyntaxKind.ObjectKeyword
    | SyntaxKind.BooleanKeyword
    | SyntaxKind.StringKeyword
    | SyntaxKind.SymbolKeyword
    | SyntaxKind.ThisKeyword
    | SyntaxKind.VoidKeyword
    | SyntaxKind.UndefinedKeyword
    | SyntaxKind.NullKeyword
    | SyntaxKind.NeverKeyword;
}

export interface TypeParameter extends Node {
    kind: SyntaxKind.TypeParameter;
    name: Identifier;
    constraint?: Type;
}

/***************** Part of Statement *****************/
export interface EmptyStatement extends Statement {
    kind: SyntaxKind.EmptyStatement;
}

export interface Block extends Statement {
    kind: SyntaxKind.Block;
    statements: NodeList<Statement>;
}

export interface ExpressionStatement extends Statement {
    kind: SyntaxKind.ExpressionStatement;
    expression: Expression;
}

export interface BreakStatement extends Statement {
    kind: SyntaxKind.BreakStatement;
    label?: Identifier;
}

export interface ContinueStatement extends Statement {
    kind: SyntaxKind.ContinueStatement;
    label?: Identifier;
}

export interface FallthroughStatement extends Statement {
    kind: SyntaxKind.FallThroughStatement;
}

export interface ReturnStatement extends Statement {
    kind: SyntaxKind.ReturnStatement;
    expression?: Expression;
}

export interface DebuggerStatement extends Statement {
    kind: SyntaxKind.DebuggerStatement;
}

export interface LabeledStatement extends Statement {
    kind: SyntaxKind.LabeledStatement;
    label: Identifier;
    statement: Statement;
}

export interface IfStatement extends Statement {
    kind: SyntaxKind.IfStatement;
    variableDeclaration?: VariableDeclaration;
    expression: Expression;
    thenBlock: Block;
    elifClauses?: NodeList<ElifClause>;
    elseBlock?: Block;
}

export interface ElifClause extends Node {
    kind: SyntaxKind.ElifClause;
    variableDeclaration?: VariableDeclaration;
    expression: Expression;
    thenBlock: Block;
}

export interface ForStatement extends Statement {
    kind: SyntaxKind.ForStatement;
    initializer?: VariableDeclaration | Expression;
    condition?: Expression;
    incrementor?: Expression;
    block: Block;
}
export interface ForInStatement extends Statement {
    kind: SyntaxKind.ForInStatement;
    vlc:
    | SyntaxKind.VarKeyword
    | SyntaxKind.LetKeyword
    | SyntaxKind.ConstKeyword;
    identifier: Identifier;
    expression: Expression;
    block: Block;
}

export interface ForOfStatement extends Statement {
    kind: SyntaxKind.ForOfStatement;
    vlc:
    | SyntaxKind.VarKeyword
    | SyntaxKind.LetKeyword
    | SyntaxKind.ConstKeyword;
    identifier: Identifier;
    expression: ConnectExp;
    block: Block;
}

export interface SwitchStatement extends Statement {
    kind: SyntaxKind.SwitchStatement;
    variableDeclaration?: VariableDeclaration;
    expression: Expression;
    caseBlock: CaseBlock;
}

export interface CaseBlock extends Node {
    kind: SyntaxKind.CaseBlock;
    parent: SwitchStatement;
    clauses: NodeList<CaseClause | DefaultClause>;
}

export interface CaseClause extends Node {
    kind: SyntaxKind.CaseClause;
    parent: CaseBlock;
    expression: Expression;
    statements: NodeList<Statement>;
}

export interface DefaultClause extends Node {
    kind: SyntaxKind.DefaultClause;
    parent: CaseBlock;
    statements: NodeList<Statement>;
}

export interface TryStatement extends Statement {
    kind: SyntaxKind.TryStatement;
    tryBlock: Block;
    catchClause?: CatchClause;
    finallyBlock?: Block;
}

export interface CatchClause extends Node {
    kind: SyntaxKind.CatchClause;
    parent: TryStatement;
    identifier?: Identifier;
    block: Block;
}

export interface UsingStatement extends Statement {
    kind: SyntaxKind.UsingStatement;
    usingTargets: NodeList<UsingTarget>;
    block: Block;
}

export type UsingTarget = VariableDeclaration | Identifier;

/***************** Implementation of Declaration *****************/
export interface ImportDeclaration extends Declaration {
    kind: SyntaxKind.ImportDeclaration;
    importClause?: ImportClause;
    moduleSpecifier: StringLiteral;
}
export interface ImportClause extends Node {
    kind: SyntaxKind.ImportClause;
    parent: ImportDeclaration;
    name?: Identifier; // Default binding
    namedBindings?: NamedImportsOrExports;
}

export interface NamedImportsOrExports extends Node {
    kind: SyntaxKind.NamedImportsOrExports;
    parent: ImportClause | ExportDeclaration;
    elements: NodeList<ImportOrExportSpecifier>;
}
export interface ImportOrExportSpecifier extends Node {
    kind: SyntaxKind.ImportOrExportSpecifier;
    parent: NamedImportsOrExports;
    name: Identifier;
    propertyName?: Identifier;
}

export interface ExportDeclaration extends Declaration {
    kind: SyntaxKind.ExportDeclaration;
    /** Will not be assigned in the case of `export * from "foo";` */
    exportClause?: NamedImportsOrExports;
    moduleSpecifier?: StringLiteral;

    /** Will be assigned in the case of `export default 12345;` */
    expression?: ConnectExp;
}


export interface VariableDeclaration extends Declaration {
    kind: SyntaxKind.VariableDeclaration;
    isWalrus: boolean;
    vlc?:
    | SyntaxKind.VarKeyword
    | SyntaxKind.LetKeyword
    | SyntaxKind.ConstKeyword;
    modifiers?: ModifiersList;
    declarations: NodeList<VariableBinding>;
}
export interface VariableBinding extends Node {
    kind: SyntaxKind.VariableBinding;
    parent: VariableDeclaration;
    name: Identifier;
    initializer?: ConnectExp;
}

export interface Decorator extends Node {
    kind: SyntaxKind.Decorator;
    expression: LeftHandExp;
}

export interface ClassDeclaration extends Class_, Declaration {
    kind: SyntaxKind.ClassDeclaration;
    decorators?: NodeList<Decorator>;
}

export interface Class_ extends Node {
    modifiers?: ModifiersList;
}

export interface FunctionDeclaration extends Function_, Declaration {
    kind: SyntaxKind.FunctionDeclaration;
}

export interface Function_ extends CallSignature, Node {
    modifiers?: ModifiersList;
    name?: Identifier;
    body?: Block;
    asteriskToken?: Token<SyntaxKind.AsteriskToken>;
}

export interface Parameter extends Node {
    kind: SyntaxKind.Parameter;
    name: Identifier;
    dotDotDotToken?: Token<SyntaxKind.DotDotDotToken>;
    questionToken?: Token<SyntaxKind.QuestionToken>;
    type?: Type;
    initializer?: ConnectExp;
}

export interface NodeDeclaration extends Node_, Declaration {
    kind: SyntaxKind.NodeDeclaration;
    decorators?: NodeList<Decorator>;
}

export interface Node_ extends Node {
    kind: SyntaxKind.NodeDeclaration | SyntaxKind.NodeExpression;
    isSubnet: boolean;
    modifiers?: ModifiersList;
    name?: Identifier;
    parameters?: NodeList<Parameter>;
    nodeBlock: NodeBlock;
}

export interface NodeBlock extends Node {
    kind: SyntaxKind.NodeBlock;
    statements: NodeList<NodeStatement>;
}

export type NodeStatement =
    | Statement
    | NodeStateDeclaration
    | NodeAllPortTypeDeclaration
    | NodePortTypeDeclaration
    ;

export interface NodeStateDeclaration extends Declaration {
    kind: SyntaxKind.NodeStateDeclaration;
    expression: Expression;
}
export interface NodeAllPortTypeDeclaration extends Declaration {
    kind: SyntaxKind.NodeAllPortTypeDeclaration;
    types: NodeList<Type>;
}
export interface NodePortTypeDeclaration extends Declaration {
    kind: SyntaxKind.NodePortTypeDeclaration;
    portName: Identifier;
    type: Type;
}

export interface InterfaceDeclaraion extends Declaration {
    kind: SyntaxKind.InterfaceDeclaration;
    modifiers?: ModifiersList;
}

export interface TypeAliasDeclaration extends Declaration {
    kind: SyntaxKind.TypeAliasDeclaration;
    name: Identifier;
    modifiers?: ModifiersList;
    typeParameters?: NodeList<TypeParameter>;
    type: Type;
}

export interface EnumDeclaration extends Declaration {
    kind: SyntaxKind.EnumDeclaration;
    name: Identifier;
    members: NodeList<EnumMember>;
}

export interface EnumMember extends Node {
    kind: SyntaxKind.EnumMember;
    parent: EnumDeclaration;
    name: Identifier;
    initializer?: ConnectExp;
}

export interface NamespaceDeclaration extends Declaration {
    kind: SyntaxKind.ModuleDeclaration;
    modifiers?: ModifiersList;
}

export interface SourceFile extends Node {
    kind: SyntaxKind.SourceFile;
    statements: NodeList<Statement>;

    fileName: string;
    text: string;

    /* @internal */ nodeCount: number;
}
