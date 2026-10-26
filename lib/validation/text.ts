// Text rules shared by every form whose values print on a customs document.
// They mirror the database's private.is_clean_text(), and are slightly
// stricter, so the database never rejects what a form accepted.

// (c), (r), zero-width and joiner characters, currency and letterlike
// symbols, arrows, maths, technical, box drawing, shapes, dingbats, private
// use, variation selectors, emoji and pictographs, tag characters.
const DENIED =
  /[©®​-‏⁠-⁯₠-⃏℀-⅏←-⯿-︀-️\u{1F000}-\u{1FAFF}\u{E0000}-\u{E007F}]/u;
const CONTROL = /[\u0000-\u001F\u007F-\u009F]/;
const ASCII_SYMBOLS = /[!"$%*;<=>?@[\\\]^_`{|}~]/;
// The database rejects a leading [[:space:][:punct:]]; Unicode punctuation and
// symbols are rejected here too, to stay on the strict side.
const LEADING = /^[\s\p{P}\p{S}]/u;

/** No characters a registered name or address can't contain. Ignores spacing. */
export function hasOnlyAllowedCharacters(value: string): boolean {
  return !DENIED.test(value) && !CONTROL.test(value) && !ASCII_SYMBOLS.test(value);
}

/** The full database rule: trimmed, single-spaced, starts with a letter or digit, allowed characters only. */
export function isCleanText(value: string): boolean {
  return (
    value === value.trim() &&
    !/\s\s/.test(value) &&
    !LEADING.test(value) &&
    hasOnlyAllowedCharacters(value)
  );
}

/** Every line of a multi-line value (addresses) is clean text. */
export function isCleanLines(value: string): boolean {
  return value.split("\n").every(isCleanText);
}

/** Trimmed, with runs of whitespace collapsed to one space. */
export function collapse(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Per line: trimmed and collapsed; blank lines dropped. */
export function collapseLines(value: string): string {
  return value
    .split(/\r?\n/)
    .map(collapse)
    .filter(Boolean)
    .join("\n");
}

/** Typing mask: no leading whitespace, no runs of spaces. Trailing space survives so the user can keep typing. */
export function tidy(value: string): string {
  return value.replace(/^\s+/, "").replace(/[^\S\n]{2,}/g, " ");
}

export const SYMBOLS_MESSAGE = "Use letters, numbers and normal punctuation only, no emoji or symbols.";
