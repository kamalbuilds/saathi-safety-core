#!/bin/sh
# Breaks each safety guard in a scratch copy and requires the suite to go red. A guard whose
# mutation still passes is a guard the tests do not actually protect.
set -u
ROOT=$(cd "$(dirname "$0")/.." && pwd)
WORK="$ROOT/.mutation"
survived=0
mutate() {
  name=$1 file=$2 from=$3 to=$4
  rm -rf "$WORK" && mkdir -p "$WORK" && cp -R "$ROOT/src" "$ROOT/test" "$ROOT/fixtures" "$ROOT/package.json" "$WORK/"
  FROM="$from" TO="$to" perl -0pi -e 's/\Q$ENV{FROM}\E/$ENV{TO}/ or die "pattern not found\n"' "$WORK/$file" || { echo "ERROR  $name: pattern missing"; survived=$((survived+1)); return; }
  if (cd "$WORK" && node --test test/*.test.ts >/dev/null 2>&1); then
    echo "SURVIVED  $name"; survived=$((survived+1))
  else
    echo "KILLED    $name"
  fi
}
mutate "emergency not sticky"          src/policy.ts  'if (current === "EMERGENCY") return "EMERGENCY";' ''
mutate "crisis support not sticky"     src/policy.ts  'if (current === "CRISIS_SUPPORT") return "CRISIS_SUPPORT";' ''
mutate "clinician release ignores live signals" src/policy.ts '&& !concern' ''
mutate "112 not primary in emergency"  src/policy.ts  'primaryAction: ERSS,' 'primaryAction: TELE_MANAS,'
mutate "crisis turns reach the LLM"    src/gateway.ts 'if (to !== "NORMAL") {' 'if (false) {'
mutate "output validator removed"      src/gateway.ts 'if (!verdict.ok || outputCrisis) {' 'if (false) {'
mutate "injected docs passed through"  src/gateway.ts 'text: flagged ?' 'text: false ?'
mutate "audit log stores message text" src/gateway.ts 'const event: SafetyEvent = { at' 'const event: any = { text: turn.message, at'
mutate "no de-obfuscation"             src/normalize.ts 'let s = input.normalize("NFKC").replace(INVISIBLE, "").toLowerCase();' 'let s = input.toLowerCase();'
mutate "no homoglyph folding"          src/normalize.ts 's = s.replace(/./gu, (ch) => HOMOGLYPHS[ch] ?? ch);' ''
mutate "no Hinglish ideation pattern"  src/signals.ts 'new RegExp(`\\b${JEENE}' 'new RegExp(`\\bxx${JEENE}'
mutate "educational guard removed"     src/signals.ts '&& !EDUCATIONAL.test(text) &&' '&&'
rm -rf "$WORK"
echo "survivors: $survived"
[ "$survived" -eq 0 ]
