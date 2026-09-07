import { simpleGlobToRegExp } from "./common.ts";

/**
 * Best-effort hook selection, never a permission grant. Unsupported shell syntax
 * runs the hook so that its script can inspect the original command itself.
 */
export function bashHookIfMatches(command: string, pattern: string): boolean {
  const candidates: string[] = [];
  let uncertain = false;
  let dynamic = false;

  function scan(start: number, terminator?: string, depth = 0): number {
    if (depth > 32) {
      uncertain = true;
      return command.length;
    }
    const words: { value: string; assignment: boolean }[] = [];
    let word = "";
    let rawWord = "";
    let quote: "'" | '"' | undefined;
    const finishWord = () => {
      if (rawWord) words.push({ value: word, assignment: /^[A-Za-z_][A-Za-z_0-9]*=/.test(rawWord) });
      word = "";
      rawWord = "";
    };
    const commandPosition = () => words.every((entry) => entry.assignment) && !/^[A-Za-z_][A-Za-z_0-9]*=/.test(rawWord);
    const flush = () => {
      finishWord();
      let firstCommandWord = 0;
      while (words[firstCommandWord]?.assignment) firstCommandWord++;
      const stripped = words.slice(firstCommandWord).map((entry) => entry.value).join(" ");
      if (stripped) candidates.push(stripped);
      // Variable command names and compound shell grammar need a real shell parser.
      if (/^\$|^(?:if|then|else|elif|fi|for|while|until|case|function|eval|source|exec|env|command|sudo|do|done|!|\.)(?:\s|$)/.test(stripped)) {
        uncertain = true;
      }
      words.length = 0;
    };
    for (let i = start; i < command.length; i++) {
      const char = command[i]!;
      if (!quote && char === terminator) {
        flush();
        return i;
      }
      if (char === "\\" && quote !== "'") {
        const next = command[++i];
        if (next === undefined) uncertain = true;
        else if (next !== "\n") {
          word += quote === '"' && !/[\\$"`]/.test(next) ? `\\${next}` : next;
          rawWord += `\\${next}`;
        }
        continue;
      }
      if (quote === "'") {
        if (char === "'") quote = undefined;
        else word += char;
        rawWord += char;
        continue;
      }
      if (char === "'" && !quote) { quote = "'"; rawWord += char; continue; }
      if (char === '"') { quote = quote ? undefined : '"'; rawWord += char; continue; }
      if (char === "$" && command[i + 1] === "(") {
        dynamic = true;
        if (command[i + 2] === "(") uncertain = true; // arithmetic expansion
        if (commandPosition()) uncertain = true;
        i = scan(i + 2, ")", depth + 1);
        word += "__shell_expansion__";
        rawWord += "__shell_expansion__";
        continue;
      }
      if (char === "`") {
        dynamic = true;
        if (commandPosition()) uncertain = true;
        i = scan(i + 1, "`", depth + 1);
        word += "__shell_expansion__";
        rawWord += "__shell_expansion__";
        continue;
      }
      if (char === "$" && /[A-Za-z_0-9{*?@#]/.test(command[i + 1] ?? "")) {
        dynamic = true;
        if (commandPosition()) uncertain = true;
      }
      if (!quote && char === "#" && !rawWord) {
        while (i < command.length && command[i] !== "\n") i++;
        flush();
        continue;
      }
      if (!quote && /\s/.test(char) && char !== "\n") { finishWord(); continue; }
      if (!quote && /[;&|\n()]/.test(char)) { flush(); continue; }
      if (!quote && /[<>{}]/.test(char)) uncertain = true;
      if (!quote && /[*?\[]/.test(char) && commandPosition()) uncertain = true;
      word += char;
      rawWord += char;
    }
    if (quote || terminator) uncertain = true;
    flush();
    return command.length;
  }

  scan(0);
  // A command-name-only filter can ignore unrelated substitutions. A filter
  // with argument constraints cannot determine what dynamic arguments expand to.
  const commandNameOnly = /^[^\s*?]+(?: \*)?$/.test(pattern);
  if (uncertain || (dynamic && !commandNameOnly)) return true;
  const glob = simpleGlobToRegExp(pattern);
  return candidates.some((candidate) => glob.test(candidate));
}
