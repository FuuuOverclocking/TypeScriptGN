// The order of each SyntaxKind matters.
export enum SyntaxKind {
    // <Token>
    Unknown,
    EndOfFileToken,

    // Literals
    NumericLiteral,
    StringLiteral,

    // <Punctuation>
    OpenBraceToken,             // {
    CloseBraceToken,            // }
    OpenParenToken,             // (
    CloseParenToken,            // )
    OpenBracketToken,           // [
    CloseBracketToken,          // ]
    DotToken,                   // .
    DotDotDotToken,             // ...
    SemicolonToken,             // ;
    CommaToken,                 // ,
    QuestionDotToken,           // ?.
    ColonEqualsToken,           // :=
    AtToken,                    // @
    EqualsGreaterThanToken,     // =>
    QuestionToken,              // ?
    ColonToken,                 // :
    PlusPlusToken,              // ++
    MinusMinusToken,            // --

    // Operators that could be treated as binary operators
    //     <BinaryOperator>
    LessThanToken,              // <
    GreaterThanToken,           // >
    LessThanEqualsToken,        // <=
    GreaterThanEqualsToken,     // >=
    EqualsEqualsToken,          // ==
    ExclamationEqualsToken,     // !=
    EqualsEqualsEqualsToken,    // ===
    ExclamationEqualsEqualsToken, // !==
    MinusGreaterThanToken,      // -> , self-defined
    PlusToken,                  // +
    MinusToken,                 // -
    AsteriskToken,              // *
    AsteriskAsteriskToken,      // **
    SlashToken,                 // /
    PercentToken,               // %
    LessThanLessThanToken,      // <<
    GreaterThanGreaterThanToken,// >>
    GreaterThanGreaterThanGreaterThanToken, // >>>
    AmpersandToken,             // &
    BarToken,                   // |
    CaretToken,                 // ^
    ExclamationToken,           // !
    TildeToken,                 // ~
    AmpersandAmpersandToken,    // &&
    BarBarToken,                // ||
    QuestionQuestionToken,      // ??
    //     </BinaryOperator>

    //     <Assignments>
    EqualsToken,
    //         <CompoundAssignment>
    PlusEqualsToken,
    MinusEqualsToken,
    AsteriskEqualsToken,
    AsteriskAsteriskEqualsToken,
    SlashEqualsToken,
    PercentEqualsToken,
    LessThanLessThanEqualsToken,
    GreaterThanGreaterThanEqualsToken,
    GreaterThanGreaterThanGreaterThanEqualsToken,
    AmpersandEqualsToken,
    BarEqualsToken,
    CaretEqualsToken,
    //         </CompoundAssignment>
    //     </Assignments>
    // </Punctuation>

    // Identifiers, token is a keyword if token > SyntaxKind.Identifier
    Identifier,

    // <Keyword>
    //     <ReservedWord>
    BreakKeyword,
    CaseKeyword,
    CatchKeyword,
    ClassKeyword,
    ConstKeyword,
    ContinueKeyword,
    DebuggerKeyword,
    DefaultKeyword,
    DeleteKeyword,
    DoKeyword,
    ElifKeyword,
    ElseKeyword,
    EnumKeyword,
    ExportKeyword,
    ExtendsKeyword,
    FalseKeyword,
    FinallyKeyword,
    ForKeyword,
    FunctionKeyword,
    IfKeyword,
    ImportKeyword,
    InKeyword,
    InstanceOfKeyword,
    NewKeyword,
    NullKeyword,
    ReturnKeyword,
    SuperKeyword,
    SwitchKeyword,
    ThisKeyword,
    ThrowKeyword,
    TrueKeyword,
    TryKeyword,
    TypeOfKeyword,
    VarKeyword,
    VoidKeyword,
    WhileKeyword,
    WithKeyword,

    // TS strict mode keyword
    ImplementsKeyword,
    InterfaceKeyword,
    LetKeyword,
    PackageKeyword,
    PrivateKeyword,
    ProtectedKeyword,
    PublicKeyword,
    StaticKeyword,
    YieldKeyword,
    // self-defined keyword
    FallThroughKeyword,
    NodeKeyword,
    SubnetKeyword,
    UsingKeyword,
    //     </ReservedWord>

    //     <ContextualKeyword>
    AbstractKeyword,
    AsKeyword,
    AssertsKeyword,
    AnyKeyword,
    AsyncKeyword,
    AwaitKeyword,
    BooleanKeyword,
    ConstructorKeyword,
    DeclareKeyword,
    GetKeyword,
    InferKeyword,
    IsKeyword,
    KeyOfKeyword,
    ModuleKeyword,
    NamespaceKeyword,
    NeverKeyword,
    ReadonlyKeyword,
    RequireKeyword,
    NumberKeyword,
    ObjectKeyword,
    SetKeyword,
    StringKeyword,
    SymbolKeyword,
    TypeKeyword,
    UndefinedKeyword,
    UniqueKeyword,
    UnknownKeyword,
    FromKeyword,
    GlobalKeyword,
    BigIntKeyword,
    OfKeyword,
    StateKeyword, // self-defined
    //     </ContextualKeyword>
    // </Keyword>
    // </Token>

    // Enum value count
    Count,
};

export enum SyntaxKindMarker {
    FirstAssignment = SyntaxKind.EqualsToken,
    LastAssignment = SyntaxKind.CaretEqualsToken,
    FirstCompoundAssignment = SyntaxKind.PlusEqualsToken,
    LastCompoundAssignment = SyntaxKind.CaretEqualsToken,
    FirstReservedWord = SyntaxKind.BreakKeyword,
    LastReservedWord = SyntaxKind.UsingKeyword,
    FirstKeyword = SyntaxKind.BreakKeyword,
    LastKeyword = SyntaxKind.StateKeyword,
    FirstPunctuation = SyntaxKind.OpenBraceToken,
    LastPunctuation = SyntaxKind.CaretEqualsToken,
    FirstToken = SyntaxKind.Unknown,
    LastToken = LastKeyword,
    FirstLiteralToken = SyntaxKind.NumericLiteral,
    LastLiteralToken = SyntaxKind.StringLiteral,
    FirstBinaryOperator = SyntaxKind.LessThanToken,
    LastBinaryOperator = SyntaxKind.QuestionQuestionToken,

    FirstContextualKeyword = SyntaxKind.AbstractKeyword,
    LastContextualKeyword = SyntaxKind.StateKeyword,
}

export const textToKeyword: {
    [_: string]: KeywordSyntaxKind | undefined;
} = Object.create(null);
Object.assign(textToKeyword, {
    abstract: SyntaxKind.AbstractKeyword,
    any: SyntaxKind.AnyKeyword,
    as: SyntaxKind.AsKeyword,
    asserts: SyntaxKind.AssertsKeyword,
    bigint: SyntaxKind.BigIntKeyword,
    boolean: SyntaxKind.BooleanKeyword,
    break: SyntaxKind.BreakKeyword,
    case: SyntaxKind.CaseKeyword,
    catch: SyntaxKind.CatchKeyword,
    class: SyntaxKind.ClassKeyword,
    continue: SyntaxKind.ContinueKeyword,
    const: SyntaxKind.ConstKeyword,
    ["" + "constructor"]: SyntaxKind.ConstructorKeyword,
    debugger: SyntaxKind.DebuggerKeyword,
    declare: SyntaxKind.DeclareKeyword,
    default: SyntaxKind.DefaultKeyword,
    delete: SyntaxKind.DeleteKeyword,
    do: SyntaxKind.DoKeyword,
    else: SyntaxKind.ElseKeyword,
    enum: SyntaxKind.EnumKeyword,
    elif: SyntaxKind.ElifKeyword,
    export: SyntaxKind.ExportKeyword,
    extends: SyntaxKind.ExtendsKeyword,
    fallthrough: SyntaxKind.FallThroughKeyword,
    false: SyntaxKind.FalseKeyword,
    finally: SyntaxKind.FinallyKeyword,
    for: SyntaxKind.ForKeyword,
    from: SyntaxKind.FromKeyword,
    function: SyntaxKind.FunctionKeyword,
    get: SyntaxKind.GetKeyword,
    if: SyntaxKind.IfKeyword,
    implements: SyntaxKind.ImplementsKeyword,
    import: SyntaxKind.ImportKeyword,
    in: SyntaxKind.InKeyword,
    infer: SyntaxKind.InferKeyword,
    instanceof: SyntaxKind.InstanceOfKeyword,
    interface: SyntaxKind.InterfaceKeyword,
    is: SyntaxKind.IsKeyword,
    keyof: SyntaxKind.KeyOfKeyword,
    let: SyntaxKind.LetKeyword,
    module: SyntaxKind.ModuleKeyword,
    namespace: SyntaxKind.NamespaceKeyword,
    never: SyntaxKind.NeverKeyword,
    new: SyntaxKind.NewKeyword,
    node: SyntaxKind.NodeKeyword,
    null: SyntaxKind.NullKeyword,
    number: SyntaxKind.NumberKeyword,
    object: SyntaxKind.ObjectKeyword,
    package: SyntaxKind.PackageKeyword,
    private: SyntaxKind.PrivateKeyword,
    protected: SyntaxKind.ProtectedKeyword,
    public: SyntaxKind.PublicKeyword,
    readonly: SyntaxKind.ReadonlyKeyword,
    require: SyntaxKind.RequireKeyword,
    global: SyntaxKind.GlobalKeyword,
    return: SyntaxKind.ReturnKeyword,
    set: SyntaxKind.SetKeyword,
    state: SyntaxKind.StateKeyword,
    static: SyntaxKind.StaticKeyword,
    string: SyntaxKind.StringKeyword,
    subnet: SyntaxKind.SubnetKeyword,
    super: SyntaxKind.SuperKeyword,
    switch: SyntaxKind.SwitchKeyword,
    symbol: SyntaxKind.SymbolKeyword,
    this: SyntaxKind.ThisKeyword,
    throw: SyntaxKind.ThrowKeyword,
    true: SyntaxKind.TrueKeyword,
    try: SyntaxKind.TryKeyword,
    type: SyntaxKind.TypeKeyword,
    typeof: SyntaxKind.TypeOfKeyword,
    undefined: SyntaxKind.UndefinedKeyword,
    unique: SyntaxKind.UniqueKeyword,
    unknown: SyntaxKind.UnknownKeyword,
    using: SyntaxKind.UsingKeyword,
    var: SyntaxKind.VarKeyword,
    void: SyntaxKind.VoidKeyword,
    while: SyntaxKind.WhileKeyword,
    with: SyntaxKind.WithKeyword,
    yield: SyntaxKind.YieldKeyword,
    async: SyntaxKind.AsyncKeyword,
    await: SyntaxKind.AwaitKeyword,
    of: SyntaxKind.OfKeyword,
});


export type KeywordSyntaxKind =
    | SyntaxKind.AbstractKeyword
    | SyntaxKind.AnyKeyword
    | SyntaxKind.AsKeyword
    | SyntaxKind.AssertsKeyword
    | SyntaxKind.BigIntKeyword
    | SyntaxKind.BooleanKeyword
    | SyntaxKind.BreakKeyword
    | SyntaxKind.CaseKeyword
    | SyntaxKind.CatchKeyword
    | SyntaxKind.ClassKeyword
    | SyntaxKind.ContinueKeyword
    | SyntaxKind.ConstKeyword
    | SyntaxKind.ConstructorKeyword
    | SyntaxKind.DebuggerKeyword
    | SyntaxKind.DeclareKeyword
    | SyntaxKind.DefaultKeyword
    | SyntaxKind.DeleteKeyword
    | SyntaxKind.DoKeyword
    | SyntaxKind.ElifKeyword
    | SyntaxKind.ElseKeyword
    | SyntaxKind.EnumKeyword
    | SyntaxKind.ExportKeyword
    | SyntaxKind.ExtendsKeyword
    | SyntaxKind.FalseKeyword
    | SyntaxKind.FinallyKeyword
    | SyntaxKind.ForKeyword
    | SyntaxKind.FromKeyword
    | SyntaxKind.FunctionKeyword
    | SyntaxKind.GetKeyword
    | SyntaxKind.IfKeyword
    | SyntaxKind.ImplementsKeyword
    | SyntaxKind.ImportKeyword
    | SyntaxKind.InKeyword
    | SyntaxKind.InferKeyword
    | SyntaxKind.InstanceOfKeyword
    | SyntaxKind.InterfaceKeyword
    | SyntaxKind.IsKeyword
    | SyntaxKind.KeyOfKeyword
    | SyntaxKind.LetKeyword
    | SyntaxKind.ModuleKeyword
    | SyntaxKind.NamespaceKeyword
    | SyntaxKind.NeverKeyword
    | SyntaxKind.NewKeyword
    | SyntaxKind.NullKeyword
    | SyntaxKind.NumberKeyword
    | SyntaxKind.ObjectKeyword
    | SyntaxKind.PackageKeyword
    | SyntaxKind.PrivateKeyword
    | SyntaxKind.ProtectedKeyword
    | SyntaxKind.PublicKeyword
    | SyntaxKind.ReadonlyKeyword
    | SyntaxKind.RequireKeyword
    | SyntaxKind.GlobalKeyword
    | SyntaxKind.ReturnKeyword
    | SyntaxKind.SetKeyword
    | SyntaxKind.StaticKeyword
    | SyntaxKind.StringKeyword
    | SyntaxKind.SuperKeyword
    | SyntaxKind.SwitchKeyword
    | SyntaxKind.SymbolKeyword
    | SyntaxKind.ThisKeyword
    | SyntaxKind.ThrowKeyword
    | SyntaxKind.TrueKeyword
    | SyntaxKind.TryKeyword
    | SyntaxKind.TypeKeyword
    | SyntaxKind.TypeOfKeyword
    | SyntaxKind.UndefinedKeyword
    | SyntaxKind.UniqueKeyword
    | SyntaxKind.UnknownKeyword
    | SyntaxKind.VarKeyword
    | SyntaxKind.VoidKeyword
    | SyntaxKind.WhileKeyword
    | SyntaxKind.WithKeyword
    | SyntaxKind.YieldKeyword
    | SyntaxKind.AsyncKeyword
    | SyntaxKind.AwaitKeyword
    | SyntaxKind.OfKeyword

    | SyntaxKind.NodeKeyword
    | SyntaxKind.SubnetKeyword
    | SyntaxKind.FallThroughKeyword
    | SyntaxKind.UsingKeyword
    | SyntaxKind.StateKeyword
    ;

export enum TokenFlags {
    None = 0,
    PrecedingLineBreak = 1 << 0,
    Scientific = 1 << 1,        // e.g. `10e2`
    Octal = 1 << 2,             // e.g. `0777`
    HexSpecifier = 1 << 3,      // e.g. `0x00000000`
    BinarySpecifier = 1 << 4,   // e.g. `0b0110010000000000`
    OctalSpecifier = 1 << 5,    // e.g. `0o777`
    BinaryOrOctalSpecifier = BinarySpecifier | OctalSpecifier,
    NumericLiteralFlags = Scientific | Octal | HexSpecifier | BinaryOrOctalSpecifier
}

export enum CharacterCodes {
    nullCharacter = 0,
    maxAsciiCharacter = 0x7F,

    lineFeed = 0x0A,              // \n
    carriageReturn = 0x0D,        // \r
    space = 0x0020,   // " "

    _ = 0x5F,
    $ = 0x24,

    _0 = 0x30,
    _1 = 0x31,
    _2 = 0x32,
    _3 = 0x33,
    _4 = 0x34,
    _5 = 0x35,
    _6 = 0x36,
    _7 = 0x37,
    _8 = 0x38,
    _9 = 0x39,

    a = 0x61,
    b = 0x62,
    c = 0x63,
    d = 0x64,
    e = 0x65,
    f = 0x66,
    g = 0x67,
    h = 0x68,
    i = 0x69,
    j = 0x6A,
    k = 0x6B,
    l = 0x6C,
    m = 0x6D,
    n = 0x6E,
    o = 0x6F,
    p = 0x70,
    q = 0x71,
    r = 0x72,
    s = 0x73,
    t = 0x74,
    u = 0x75,
    v = 0x76,
    w = 0x77,
    x = 0x78,
    y = 0x79,
    z = 0x7A,

    A = 0x41,
    B = 0x42,
    C = 0x43,
    D = 0x44,
    E = 0x45,
    F = 0x46,
    G = 0x47,
    H = 0x48,
    I = 0x49,
    J = 0x4A,
    K = 0x4B,
    L = 0x4C,
    M = 0x4D,
    N = 0x4E,
    O = 0x4F,
    P = 0x50,
    Q = 0x51,
    R = 0x52,
    S = 0x53,
    T = 0x54,
    U = 0x55,
    V = 0x56,
    W = 0x57,
    X = 0x58,
    Y = 0x59,
    Z = 0x5a,

    ampersand = 0x26,             // &
    asterisk = 0x2A,              // *
    at = 0x40,                    // @
    backslash = 0x5C,             // \
    backtick = 0x60,              // `
    bar = 0x7C,                   // |
    caret = 0x5E,                 // ^
    closeBrace = 0x7D,            // }
    closeBracket = 0x5D,          // ]
    closeParen = 0x29,            // )
    colon = 0x3A,                 // :
    comma = 0x2C,                 // ,
    dot = 0x2E,                   // .
    doubleQuote = 0x22,           // "
    equals = 0x3D,                // =
    exclamation = 0x21,           // !
    greaterThan = 0x3E,           // >
    hash = 0x23,                  // #
    lessThan = 0x3C,              // <
    minus = 0x2D,                 // -
    openBrace = 0x7B,             // {
    openBracket = 0x5B,           // [
    openParen = 0x28,             // (
    percent = 0x25,               // %
    plus = 0x2B,                  // +
    question = 0x3F,              // ?
    semicolon = 0x3B,             // ;
    singleQuote = 0x27,           // '
    slash = 0x2F,                 // /
    tilde = 0x7E,                 // ~

    backspace = 0x08,             // \b
    formFeed = 0x0C,              // \f
    tab = 0x09,                   // \t
    verticalTab = 0x0B,           // \v
}
