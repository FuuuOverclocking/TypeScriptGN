export function assert(expression: boolean, msg?: string) {
    if (expression) return;
    throw new Error(msg);
}
