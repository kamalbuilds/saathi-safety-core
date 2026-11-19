const INVISIBLE = /[\u00AD\u200B-\u200F\u2060-\u2064\uFEFF\u034F\u180E]/g;

const HOMOGLYPHS: Record<string, string> = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x",
  "і": "i", "ј": "j", "ѕ": "s", "к": "k", "м": "m", "т": "t", "н": "h",
  "ı": "i", "ɑ": "a", "ο": "o", "ρ": "p", "ε": "e", "ν": "v",
};

const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s",
};

export function normalize(input: string): string {
  let s = input.normalize("NFKC").replace(INVISIBLE, "").toLowerCase();
  s = s.replace(/./gu, (ch) => HOMOGLYPHS[ch] ?? ch);
  // Leet substitutions only inside tokens that already contain letters, so "112" and "14416" survive.
  s = s.replace(/[\p{L}0-9@$]+/gu, (tok) =>
    /\p{L}/u.test(tok) && /[0-9@$]/.test(tok) ? tok.replace(/[013457@$]/g, (c) => LEET[c]) : tok,
  );
  // "s u i c i d e" and "k.i.l.l" spacing tricks.
  s = s.replace(/\b(?:[a-z][\s._\-*]){3,}[a-z]\b/g, (m) => m.replace(/[\s._\-*]/g, ""));
  // Elongations: "jeeeeene" -> "jeene", "nahiiii" -> "nahii".
  s = s.replace(/(\p{L})\1{2,}/gu, "$1$1");
  s = s.replace(/[’‘`]/g, "'").replace(/\s+/g, " ").trim();
  return s;
}

const DEVANAGARI = /[\u0900-\u097F]/;
const HINGLISH_MARKERS = /\b(hai|hain|nahi|nhi|nahin|mann|man|karta|karti|krta|mujhe|mereko|mera|meri|kya|ka|ki|ko|ab|bhi|sab|kuch|raha|rahi|dunga|dungi|kar|karo|batao|bhool|jao|yaar|bhai|tum|aap|zindagi|jeene|jina)\b/g;
const ENGLISH_MARKERS = /\b(the|is|i|my|and|to|you|me|am|have|want|all|this|it|please|just|now)\b/g;

export type Language = "en" | "hi" | "hi-Latn" | "mixed";

export function detectLanguage(normalized: string): Language {
  const hasDeva = DEVANAGARI.test(normalized);
  const latin = normalized.replace(/[\u0900-\u097F]+/g, " ");
  const hi = (latin.match(HINGLISH_MARKERS) ?? []).length;
  const en = (latin.match(ENGLISH_MARKERS) ?? []).length;
  if (hasDeva) return /[a-z]{3,}/.test(latin) ? "mixed" : "hi";
  if (hi >= 2 && en >= 2) return "mixed";
  if (hi >= 2) return "hi-Latn";
  return "en";
}
