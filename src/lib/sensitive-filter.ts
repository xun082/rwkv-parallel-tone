/**
 * Sensitive-word matcher: a conservative normalization pass plus an
 * Aho-Corasick automaton, so a single O(n) scan finds every word in the list.
 *
 * A line in the word list is either a plain word or, when it contains `|`, a
 * compound rule whose parts must all appear (parts built only from single
 * characters must also appear in order). For text longer than the longest rule,
 * a compound rule's parts must additionally fall inside one window of that
 * length. Malformed pipes fall back to a literal plain word.
 *
 * Isomorphic: no DOM or Node APIs, so the browser and the route handler share
 * this exact matching logic against the same word list.
 */

export const COMPOUND_SEPARATOR = "|";

export interface SensitiveFilterRules {
  plainWords: Set<string>;
  compoundRules: string[][];
  orderedCompoundRules: string[][];
  unorderedCompoundRules: string[][];
  maxLength: number;
}

export const EMPTY_SENSITIVE_FILTER_RULES: SensitiveFilterRules = {
  plainWords: new Set<string>(),
  compoundRules: [],
  orderedCompoundRules: [],
  unorderedCompoundRules: [],
  maxLength: 0,
};

// ===========================================================================
// Normalization (conservative: whitespace + full-width ASCII only)
// ===========================================================================

/**
 * Folds away separator-insertion evasions that are safe to collapse: strips all
 * whitespace (incl. the ideographic space and zero-width marks) and maps
 * full-width ASCII (U+FF01–U+FF5E) to half-width. Case and Simplified/
 * Traditional are deliberately left untouched to avoid false positives.
 */
export function normalizeSensitiveText(input: string): string {
  let result = "";
  for (let i = 0; i < input.length; i++) {
    let unit = input.charCodeAt(i);
    if (unit >= 0xff01 && unit <= 0xff5e) {
      unit -= 0xfee0; // full-width ASCII -> ASCII
    } else if (isDroppableSpace(unit)) {
      continue;
    }
    result += String.fromCharCode(unit);
  }
  return result;
}

function isDroppableSpace(unit: number): boolean {
  switch (unit) {
    case 0x09: // tab
    case 0x0a: // line feed
    case 0x0b: // vertical tab
    case 0x0c: // form feed
    case 0x0d: // carriage return
    case 0x20: // space
    case 0x85: // next line
    case 0xa0: // no-break space
    case 0x1680: // ogham space mark
    case 0x2028: // line separator
    case 0x2029: // paragraph separator
    case 0x202f: // narrow no-break space
    case 0x205f: // medium mathematical space
    case 0x3000: // ideographic space
    case 0x200b: // zero-width space
    case 0x200c: // zero-width non-joiner
    case 0x200d: // zero-width joiner
    case 0xfeff: // zero-width no-break space / BOM
      return true;
  }
  // U+2000–U+200A: the general punctuation spaces.
  return unit >= 0x2000 && unit <= 0x200a;
}

// ===========================================================================
// Parsing
// ===========================================================================

export function parseSensitiveFilterRules(filter: string): SensitiveFilterRules {
  const plainWords = new Set<string>();
  const compoundRuleKeys = new Set<string>();
  const compoundRules: string[][] = [];
  const orderedCompoundRules: string[][] = [];
  const unorderedCompoundRules: string[][] = [];
  let maxLength = 0;

  const addPlainWord = (raw: string) => {
    const normalized = normalizeSensitiveText(raw);
    if (normalized.length > 0) plainWords.add(normalized);
  };

  for (const line of filter.split("\n")) {
    const raw = line.trim();
    if (raw.length === 0) continue;
    if (raw.length > maxLength) maxLength = raw.length;

    if (!raw.includes(COMPOUND_SEPARATOR)) {
      addPlainWord(raw);
      continue;
    }

    const trimmedParts = raw.split(COMPOUND_SEPARATOR).map((part) => part.trim());
    if (trimmedParts.some((part) => part.length === 0)) {
      addPlainWord(raw);
      continue;
    }

    const uniqueParts: string[] = [];
    const seenParts = new Set<string>();
    let normalizationDroppedPart = false;
    for (const part of trimmedParts) {
      const normalized = normalizeSensitiveText(part);
      if (normalized.length === 0) {
        normalizationDroppedPart = true;
        break;
      }
      if (seenParts.has(normalized)) continue;
      seenParts.add(normalized);
      uniqueParts.push(normalized);
    }
    if (normalizationDroppedPart || uniqueParts.length < 2) {
      addPlainWord(raw);
      continue;
    }

    const key = uniqueParts.join(COMPOUND_SEPARATOR);
    if (compoundRuleKeys.has(key)) continue;
    compoundRuleKeys.add(key);
    compoundRules.push(uniqueParts);
    if (shouldCompoundRuleBeOrdered(uniqueParts)) {
      orderedCompoundRules.push(uniqueParts);
    } else {
      unorderedCompoundRules.push(uniqueParts);
    }
  }

  return {
    plainWords,
    compoundRules,
    orderedCompoundRules,
    unorderedCompoundRules,
    maxLength,
  };
}

export function isRulesEmpty(rules: SensitiveFilterRules): boolean {
  if (rules.plainWords.size > 0) return false;
  return rules.compoundRules.length === 0;
}

function shouldCompoundRuleBeOrdered(rule: string[]): boolean {
  return rule.every((part) => part.length === 1);
}

// ===========================================================================
// Matcher
// ===========================================================================

type ScanIndex = Map<string, number[]>;

export class SensitiveFilterMatcher {
  readonly rules: SensitiveFilterRules;
  private readonly automaton: AhoCorasick;
  private readonly empty: boolean;

  constructor(rules: SensitiveFilterRules) {
    this.rules = rules;
    this.empty = isRulesEmpty(rules);
    const atoms = new Set<string>(rules.plainWords);
    for (const rule of rules.compoundRules) {
      for (const part of rule) atoms.add(part);
    }
    this.automaton = AhoCorasick.build([...atoms]);
  }

  get isEmpty(): boolean {
    return this.empty;
  }

  /** True when [text] contains any listed word (window-aware). */
  isSensitive(text: string): boolean {
    return this.matchInWindows(text) !== null;
  }

  /** Plain words, then compound rules whose parts all appear. No window. */
  match(text: string): string | null {
    if (this.empty) return null;
    const normalized = normalizeSensitiveText(text);
    const scan = this.automaton.scan(normalized);

    const plain = this.earliestPlainWord(scan);
    if (plain !== null) return plain;
    for (const rule of this.rules.unorderedCompoundRules) {
      if (everyPartPresent(scan, rule)) return rule.join(COMPOUND_SEPARATOR);
    }
    for (const rule of this.rules.orderedCompoundRules) {
      if (everyPartPresent(scan, rule) && matchesInOrder(scan, rule)) {
        return rule.join(COMPOUND_SEPARATOR);
      }
    }
    return null;
  }

  /**
   * Like [match], but for text longer than `maxLength` every compound rule's
   * parts must also fall inside a single window of that length.
   */
  matchInWindows(text: string): string | null {
    if (this.rules.maxLength <= 0 || this.empty) return null;

    const normalized = normalizeSensitiveText(text);
    const scan = this.automaton.scan(normalized);

    const plain = this.earliestPlainWord(scan);
    if (plain !== null) return plain;

    const windowed = normalized.length > this.rules.maxLength;
    const maxLength = this.rules.maxLength;

    for (const rule of this.rules.unorderedCompoundRules) {
      if (!everyPartPresent(scan, rule)) continue;
      if (!windowed || matchesUnorderedWindow(scan, rule, maxLength)) {
        return rule.join(COMPOUND_SEPARATOR);
      }
    }

    for (const rule of this.rules.orderedCompoundRules) {
      if (!everyPartPresent(scan, rule)) continue;
      if (!windowed) {
        if (matchesInOrder(scan, rule)) return rule.join(COMPOUND_SEPARATOR);
        continue;
      }
      if (matchesOrderedWindow(scan, rule, maxLength)) {
        return rule.join(COMPOUND_SEPARATOR);
      }
    }

    return null;
  }

  /** Plain word whose match starts earliest in the (small) scan result. */
  private earliestPlainWord(scan: ScanIndex): string | null {
    let best: string | null = null;
    let bestStart = Number.MAX_SAFE_INTEGER;
    for (const [atom, starts] of scan) {
      if (!this.rules.plainWords.has(atom)) continue;
      const start = starts[0];
      if (start < bestStart) {
        bestStart = start;
        best = atom;
      }
    }
    return best;
  }
}

// ===========================================================================
// Compound-rule checks over collected positions
// ===========================================================================

function everyPartPresent(scan: ScanIndex, rule: string[]): boolean {
  return rule.every((part) => scan.has(part));
}

/** Every part appears in order, greedily taking the earliest later occurrence. */
function matchesInOrder(scan: ScanIndex, rule: string[]): boolean {
  let cursor = 0;
  for (const part of rule) {
    const starts = scan.get(part)!;
    const index = firstStartAtOrAfter(starts, cursor);
    if (index < 0) return false;
    cursor = starts[index] + part.length;
  }
  return true;
}

/** Some window of at most [maxLength] contains one occurrence of every part. */
function matchesUnorderedWindow(scan: ScanIndex, rule: string[], maxLength: number): boolean {
  const occurrences: { partIndex: number; start: number; end: number }[] = [];
  for (let partIndex = 0; partIndex < rule.length; partIndex++) {
    const part = rule[partIndex];
    const length = part.length;
    for (const start of scan.get(part)!) {
      occurrences.push({ partIndex, start, end: start + length });
    }
  }
  occurrences.sort((a, b) => a.start - b.start);

  const counts = new Array<number>(rule.length).fill(0);
  let coveredParts = 0;
  let left = 0;

  for (let right = 0; right < occurrences.length; right++) {
    const rightOccurrence = occurrences[right];
    if (counts[rightOccurrence.partIndex] === 0) coveredParts++;
    counts[rightOccurrence.partIndex]++;

    while (coveredParts === rule.length && left <= right) {
      const windowStart = occurrences[left].start;
      let windowEnd = occurrences[left].end;
      for (let k = left + 1; k <= right; k++) {
        if (occurrences[k].end > windowEnd) windowEnd = occurrences[k].end;
      }
      if (windowEnd - windowStart <= maxLength) return true;

      const leftOccurrence = occurrences[left];
      counts[leftOccurrence.partIndex]--;
      if (counts[leftOccurrence.partIndex] === 0) coveredParts--;
      left++;
    }
  }

  return false;
}

/** Every part appears in order inside a window of at most [maxLength]. */
function matchesOrderedWindow(scan: ScanIndex, rule: string[], maxLength: number): boolean {
  const firstStarts = scan.get(rule[0])!;
  for (const firstStart of firstStarts) {
    let cursor = firstStart + rule[0].length;
    let windowEnd = cursor;
    let matched = true;
    for (let index = 1; index < rule.length; index++) {
      const part = rule[index];
      const starts = scan.get(part)!;
      const at = firstStartAtOrAfter(starts, cursor);
      if (at < 0) {
        matched = false;
        break;
      }
      windowEnd = starts[at] + part.length;
      cursor = windowEnd;
    }
    if (matched && windowEnd - firstStart <= maxLength) return true;
  }
  return false;
}

/** Index of the first ascending value >= [target], or -1. Binary search. */
function firstStartAtOrAfter(starts: number[], target: number): number {
  let low = 0;
  let high = starts.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (starts[mid] < target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low < starts.length ? low : -1;
}

// ===========================================================================
// Aho-Corasick automaton
// ===========================================================================

class AhoCorasick {
  private constructor(
    private readonly goto: Map<number, number>[],
    private readonly fail: number[],
    private readonly output: number[][],
    private readonly atoms: string[],
  ) {}

  static build(atoms: string[]): AhoCorasick {
    const goto: Map<number, number>[] = [new Map<number, number>()];
    const terminal: number[][] = [[]];

    for (let id = 0; id < atoms.length; id++) {
      const atom = atoms[id];
      let node = 0;
      for (let i = 0; i < atom.length; i++) {
        const unit = atom.charCodeAt(i);
        let next = goto[node].get(unit);
        if (next === undefined) {
          next = goto.length;
          goto.push(new Map<number, number>());
          terminal.push([]);
          goto[node].set(unit, next);
        }
        node = next;
      }
      terminal[node].push(id);
    }

    const fail = new Array<number>(goto.length).fill(0);
    const output: number[][] = terminal.map((ids) => ids);

    const queue: number[] = [];
    for (const child of goto[0].values()) {
      fail[child] = 0;
      queue.push(child);
    }

    let head = 0;
    while (head < queue.length) {
      const node = queue[head++];
      for (const [unit, child] of goto[node]) {
        let candidate = fail[node];
        while (candidate !== 0 && !goto[candidate].has(unit)) {
          candidate = fail[candidate];
        }
        const target = goto[candidate].get(unit);
        fail[child] = target !== undefined && target !== child ? target : 0;
        const inherited = output[fail[child]];
        if (inherited.length > 0) {
          output[child] = [...output[child], ...inherited];
        }
        queue.push(child);
      }
    }

    return new AhoCorasick(goto, fail, output, atoms);
  }

  /** Single pass: each present atom mapped to its ascending start positions. */
  scan(text: string): Map<string, number[]> {
    const result = new Map<string, number[]>();
    let node = 0;
    for (let i = 0; i < text.length; i++) {
      const unit = text.charCodeAt(i);
      while (node !== 0 && !this.goto[node].has(unit)) {
        node = this.fail[node];
      }
      node = this.goto[node].get(unit) ?? 0;
      const ending = this.output[node];
      if (ending.length === 0) continue;
      for (const id of ending) {
        const atom = this.atoms[id];
        const start = i - atom.length + 1;
        const existing = result.get(atom);
        if (existing) {
          existing.push(start);
        } else {
          result.set(atom, [start]);
        }
      }
    }
    return result;
  }
}
