# saathi-safety-core

The crisis-routing core of Saathi, a private recovery companion for adults in India working on compulsive sexual behaviour.

The rule this repo enforces: **the language model never decides whether safety applies.** A deterministic layer reads every message first, in English, Hindi, Devanagari and Romanized Hinglish, and owns the conversation state. When it detects risk, the model is not called at all.

![Saathi safety core architecture](docs/architecture.png)

Interactive version: [`docs/architecture.html`](docs/architecture.html) (pan, zoom, trace any route).

```
user message
  -> normalize        (NFKC, zero-width, Cyrillic homoglyphs, leetspeak, s p a c i n g, elongation)
  -> detect signals   (ideation, self-harm, intent, plan or means, attempt now, cannot stay safe, distress, injection)
  -> state machine    NORMAL | CRISIS_CHECK | CRISIS_SUPPORT | EMERGENCY
  -> crisis?  fixed clinician-reviewable template + call buttons (112, Tele-MANAS 14416), model bypassed
  -> normal?  model with untrusted docs quarantined -> output validator -> user
```

## What it guarantees, each one pinned by a test

| Guarantee | Where |
|---|---|
| Any crisis state bypasses the model entirely | `src/gateway.ts` `handleMessage` |
| A harmless or jailbreak follow-up cannot reset an active crisis | `src/policy.ts` `transition` |
| `CRISIS_CHECK` advances only on a structured button, never on free text the model or user could forge | `SafetyAnswer` |
| `EMERGENCY` makes ERSS 112 primary and Tele-MANAS 14416 secondary | `getSafetyActions` |
| Only an authenticated clinician release lowers a state, one step at a time, and only when signals are clear | `HumanRelease` |
| Instruction-like text inside therapist profiles or uploads is withheld from the model | `sanitizeUntrustedContext` |
| Model output with doses, method detail, diagnoses, anti-therapy advice, shaming or a system-prompt canary is replaced | `validateOutput` |
| Danger disclosed in pieces across turns ("I have pills" now, "tonight I'll do it" later) combines into one EMERGENCY decision | `RiskMemory` |
| The audit log and risk memory store routing flags only, never message text | `SafetyEvent`, `RiskMemory` |

## Run it

Node 23.6 or later. Zero dependencies.

```sh
npm test         # 82 tests: corpus routing, multi-turn state, gateway against a hostile model
npm run eval     # per-language and per-state report, plus a never-tuned blind set
npm run mutate   # breaks each guard in a scratch copy; every mutation must turn the suite red
```

`npm run mutate` today:

```
KILLED    emergency not sticky
KILLED    crisis support not sticky
KILLED    clinician release ignores live signals
KILLED    112 not primary in emergency
KILLED    crisis turns reach the LLM
KILLED    output validator removed
KILLED    injected docs passed through
KILLED    audit log stores message text
KILLED    no de-obfuscation
KILLED    no homoglyph folding
KILLED    no Hinglish ideation pattern
KILLED    educational guard removed
KILLED    no cross-turn risk memory
survivors: 0
```

## The corpus

`fixtures/corpus.json` holds 66 cases across Romanized Hinglish, Devanagari, code-mixed and English: ideation, self-harm, attempts in progress, intent with means, distress, zero-width and homoglyph obfuscation, roleplay and fiction framing around a real crisis, direct and indirect prompt injection, and benign look-alikes ("this deadline is killing me", "an article about suicide prevention", "raat ko porn dekhne ka mann karta hai") that must stay `NORMAL`.

`fixtures/blind.json` is written after the rules and never tuned against. The eval reports it separately, so generalization to unseen phrasing is measured rather than assumed. Cases graduate into the corpus only when a fresh blind set replaces them.

## Resources

- Tele-MANAS 14416, Ministry of Health and Family Welfare: https://telemanas.mohfw.gov.in/
- ERSS 112, Ministry of Home Affairs: https://www.mha.gov.in/emergency-response-support-system-erss
- NICE NG225 on self-harm, including its guidance against risk scores: https://www.nice.org.uk/guidance/ng225/chapter/recommendations

States are routing rules, not diagnoses or risk scores.
