import { readFileSync } from "node:fs";
import { detectSafetySignals } from "../src/signals.ts";
import { transition } from "../src/policy.ts";

const corpus: { id: string; lang: string; cat: string; input: string; expect: string; injection?: boolean }[] = JSON.parse(
  readFileSync(new URL("../fixtures/corpus.json", import.meta.url), "utf8"),
);

const rows = corpus.map((c) => {
  const s = detectSafetySignals(c.input);
  const got = transition("NORMAL", s, null);
  return { ...c, got, routeOk: got === c.expect, injOk: s.promptInjection === !!c.injection };
});

const pct = (n: number, d: number) => (d ? `${n}/${d} (${Math.round((100 * n) / d)}%)` : "n/a");
const group = (key: "lang" | "expect") => {
  const out = new Map<string, typeof rows>();
  for (const r of rows) out.set(r[key], [...(out.get(r[key]) ?? []), r]);
  return out;
};

console.log("| Language | Correct routing |\n|---|---|");
for (const [k, rs] of group("lang")) console.log(`| ${k} | ${pct(rs.filter((r) => r.routeOk).length, rs.length)} |`);
console.log("\n| Expected state | Correct routing |\n|---|---|");
for (const [k, rs] of group("expect")) console.log(`| ${k} | ${pct(rs.filter((r) => r.routeOk).length, rs.length)} |`);

const crisis = rows.filter((r) => r.expect !== "NORMAL");
const benign = rows.filter((r) => r.expect === "NORMAL" && !r.injection);
const inj = rows.filter((r) => r.injection);
console.log("\n| Metric | Result |\n|---|---|");
console.log(`| Crisis recall (any non-NORMAL case escalated) | ${pct(crisis.filter((r) => r.got !== "NORMAL").length, crisis.length)} |`);
console.log(`| Emergency under-triage (EMERGENCY routed lower) | ${crisis.filter((r) => r.expect === "EMERGENCY" && r.got !== "EMERGENCY").length} |`);
console.log(`| False positives on benign cases | ${pct(benign.filter((r) => r.got !== "NORMAL").length, benign.length)} |`);
console.log(`| Prompt-injection detection | ${pct(inj.filter((r) => r.injOk).length, inj.length)} |`);
console.log(`| Injection false flags on non-injection cases | ${rows.filter((r) => !r.injection && !r.injOk).length} |`);
// Blind set: written after the rules and never tuned against. It measures generalization, so it
// reports instead of gating; a case only moves into corpus.json once a new blind set replaces it.
const blind: { id: string; input: string; expect: string }[] = JSON.parse(readFileSync(new URL("../fixtures/blind.json", import.meta.url), "utf8"));
const blindRows = blind.map((b) => ({ ...b, got: transition("NORMAL", detectSafetySignals(b.input), null) }));
const blindCrisis = blindRows.filter((b) => b.expect !== "NORMAL");
console.log(`| Blind set routing (never tuned) | ${pct(blindRows.filter((b) => b.got === b.expect).length, blindRows.length)} |`);
console.log(`| Blind set crisis recall | ${pct(blindCrisis.filter((b) => b.got !== "NORMAL").length, blindCrisis.length)} |`);

const misses = rows.filter((r) => !r.routeOk || !r.injOk);
if (misses.length) {
  console.log("\nMisses:");
  for (const m of misses) console.log(`- ${m.id} expected ${m.expect} got ${m.got}`);
  process.exit(1);
}
