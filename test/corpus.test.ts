import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { detectSafetySignals } from "../src/signals.ts";
import { transition } from "../src/policy.ts";

const corpus: { id: string; input: string; expect: string; injection?: boolean }[] = JSON.parse(
  readFileSync(new URL("../fixtures/corpus.json", import.meta.url), "utf8"),
);

test("corpus is non-trivial and covers every routing state", () => {
  assert.ok(corpus.length >= 50);
  for (const s of ["NORMAL", "CRISIS_CHECK", "EMERGENCY"]) assert.ok(corpus.some((c) => c.expect === s), s);
});

for (const c of corpus) {
  test(`${c.id}: routes to ${c.expect}`, () => {
    const signals = detectSafetySignals(c.input);
    assert.equal(transition("NORMAL", signals, null), c.expect, JSON.stringify(signals.matched));
    assert.equal(signals.promptInjection, !!c.injection, "injection flag");
  });
}
