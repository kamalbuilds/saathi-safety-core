import { normalize, detectLanguage, type Language } from "./normalize.ts";

export interface SafetySignals {
  language: Language;
  suicidalIdeation: boolean;
  selfHarmThoughts: boolean;
  currentIntent: boolean;
  planOrMeans: boolean;
  attemptOrInjuryOrPoisoningNow: boolean;
  cannotStaySafeNow: boolean;
  severeDistress: boolean;
  promptInjection: boolean;
  matched: string[];
}

type SignalKey = Exclude<keyof SafetySignals, "language" | "matched">;

// Romanized Hindi has no fixed spelling, so each pattern spans the common variants.
const NAHI = "(?:nahi|nahin|nhi|nai|nahii|na)";
const MANN = "(?:mann|man|mn|dil)";
const KARTA = "(?:karta|karti|krta|krti|kar raha|kar rahi|hota|hai)";
const JEENE = "(?:jeene|jine|jeena|jina|jeeney|jeeny)";
const KHATAM = "(?:khatam|khatm|khtm|khatma)";

const PATTERNS: Record<SignalKey, RegExp[]> = {
  suicidalIdeation: [
    /\b(?:kill|end) (?:myself|my ?self|my life|it all)\b/,
    /\bwant(?:ed|s)? to (?:die|disappear forever|not exist)\b/,
    /\b(?:wish i (?:was|were) dead|better off dead|no reason to (?:live|go on))\b/,
    /\bdon'?t want to (?:live|be alive|exist|wake up) ?(?:anymore)?\b/,
    /\btake my (?:own )?life\b/,
    /\b(?:end|ending|ended|take|taking) (?:my|my own) life\b/,
    /\bno (?:point|reason|use) (?:in |of )?(?:living|going on|being alive|to live|in life)\b/,
    /\b(?:want|need) (?:it|everything|it all|all of it) (?:all )?to (?:stop|end) (?:forever|for good|permanently)\b/,
    new RegExp(`\\b${NAHI} (?:jeena|jina|jeene|jine)\\b`),
    /\bmar (?:hi )?(?:jaun|jaau|jaaun|jaunga|jaungi|jaana|jana)\b/,
    /नहीं जीना/,
    /\b(?:i'?m|i am|feeling|feel|been) (?:so )?suicidal\b/,
    /\bsuicidal (?:thoughts|feelings|urges)\b/,
    new RegExp(`\\b${JEENE} (?:ka |ki )?(?:${MANN} |ichha |iccha )?${NAHI}\\b`),
    new RegExp(`\\bmar(?:na|ne|jaana|jana|ja) (?:ka |ki )?(?:${MANN} |ichha )?${KARTA}`),
    /\bmar (?:jaana|jana|jaun|jaunga|jaungi|jaau) (?:chahta|chahti|hai|hu|hoon)/,
    new RegExp(`\\b(?:khud ?ko|apne ?aap ?ko) (?:${KHATAM}|maar|mar)`),
    new RegExp(`\\bsab(?: kuch)? ${KHATAM} (?:kar|karne|karna|krne) (?:ka|du|doon|dena|dunga|dungi|deta)`),
    new RegExp(`\\b(?:zindagi|zindgi|jindagi|life) ${KHATAM}`),
    /\b(?:aatmahatya|atmahatya|suicide kar(?:na|ne|lunga|lungi|loon|lu))/,
    /जीने का (?:मन|दिल) नहीं/, /मरना चाहत[ाी]/, /आत्महत्या/, /खुद को (?:खत्म|ख़त्म|मार)/,
    /सब (?:कुछ )?(?:खत्म|ख़त्म) कर/, /(?:ज़िंदगी|जिंदगी|ज़िन्दगी) (?:खत्म|ख़त्म)/, /मर जाना चाहत/,
  ],
  selfHarmThoughts: [
    /\b(?:cut|cutting|hurt|hurting|harm|harming|burn|burning) (?:myself|my ?self|my (?:arm|wrist|wrists|skin))\b/,
    /\bself[- ]?harm(?:ing)?\b/,
    /\b(?:khud ?ko|apne ?aap ?ko) (?:hurt|chot|nuksaan|nuksan|kaat|kaatna|jalana)/,
    /\b(?:haath|hath|kalai|nas) (?:kaat|kat)/,
    /खुद को (?:चोट|नुकसान|काट)/, /(?:हाथ|कलाई|नस) काट/,
  ],
  currentIntent: [
    /\b(?:kudne|koodne|jump|jumping|jump off) (?:wala|wali|ja raha|ja rahi|ja rha|about|going)/,
    /\babout to (?:jump|do it|end it|kill myself)\b/,
    /\b(?:going to|gonna|will|intend to|plan to|decided to) (?:kill myself|end (?:it|my life|it all)|do it|act)\b(?: (?:tonight|today|now|soon))?/,
    /\b(?:tonight|today) (?:is the night|i(?:'ll| will) (?:do it|end it))/,
    new RegExp(`\\b(?:aaj|aj) (?:raat |hi )*(?:sab )?(?:${KHATAM}|kar) (?:kar )?(?:dunga|dungi|lunga|lungi|doonga)`),
    /\b(?:maine|mene) (?:decide|faisla|tay) kar (?:liya|li)/,
    /आज (?:रात )?(?:ही )?(?:कर|खत्म कर) (?:लूँगा|लूंगा|लूँगी|दूँगा|दूंगा)/, /(?:मैंने|मैने) (?:फैसला|तय) कर (?:लिया|ली)/,
  ],
  planOrMeans: [
    /\b(?:i )?(?:have|got|made|bought|saved|collected|kept) (?:a |the )?(?:plan|pills|tablets|rope|blade|razor|poison|pesticide|gun|sleeping pills)\b/,
    /\bplan (?:to|for) (?:kill|end|die)/,
    /\b(?:pills|tablets|goliyan|goliyaan|golian|goli|zeher|zehar|jahar|rassi|blade) (?:bhi )?(?:hai|hain|rakhi|rakha|rakhe|le aaya|le aayi|mere paas)/,
    /\bmere paas (?:\w+ ){0,2}(?:pills|tablets|goliyan|goliyaan|goli|zeher|zehar|rassi|blade)/,
    /\bplan bana (?:liya|li|rakha)/,
    /(?:नींद की )?गोलियां?(?: भी)? (?:हैं|है|रखी)/, /(?:ज़हर|जहर|रस्सी|गोलियां|गोलियाँ) (?:भी )?(?:है|हैं|रखी|रखा|मेरे पास)/, /मेरे पास (?:\S+ ){0,2}(?:ज़हर|जहर|रस्सी|गोलियां|गोलियाँ)/, /(?:प्लान|योजना) बना (?:ली|लिया)/,
  ],
  attemptOrInjuryOrPoisoningNow: [
    /\b(?:i(?:'ve| have)?|just) (?:taken|took|swallowed|drank|drunk) (?:a lot of |all (?:my|the) |too many |\d+ )?(?:pills|tablets|poison|pesticide|bleach)/,
    /\b(?:i(?:'ve| have)? )?(?:just )?(?:overdosed|od'?d)\b/,
    /\bi(?:'ve| have)? (?:just )?(?:cut|slit) (?:myself|my (?:wrist|wrists|arm))/,
    /\b(?:i'?m|i am) bleeding\b/,
    /\b(?:swallowed|taken|took|ate|consumed|gulped) (?:\w+ ){0,4}(?:pills|tablets|strips?|poison|pesticide|bleach|medicines?)\b/,
    /\b(?:(?:pura|poora|saara|sara|saari|sari|ek) )?(?:patta|strip|goli|goliyan|goliyaan|dawai|dawaiyan|dawa|tablets?|pills) (?:\w+ )?(?:kha|le|nigal|pee|pi) (?:li|liya|liye|lin|chuka|chuki)\b/,
    /\b(?:standing|sitting|i'?m|i am) (?:\w+ )?(?:on|at) (?:the |a )?(?:edge|ledge|railing|bridge|parapet)\b(?: (?:\w+ ){0,3}(?:right now|now|tonight))?/,
    /\b(?:terrace|chhat|chat|chhath|roof|building|pul|bridge|track) (?:pe|par|ke upar|ke kinare|on) (?:\w+ ){0,2}(?:khada|khadi|baitha|baithi)\b.*\b(?:kudne|koodne|kood|kud|jump)/,
    /\b(?:goliyan|goliyaan|golian|pills|tablets|zeher|zehar) (?:kha|le|pee|pi) (?:li|liya|liye|lin|chuka|chuki|li hai|liya hai)/,
    /\b(?:khud ?ko|nas|haath|kalai) kaat (?:liya|li|diya|di)/,
    /(?:गोलियां|गोलियाँ|ज़हर|जहर) (?:खा|ले|पी) (?:ली|लीं|लिया|चुका|चुकी)/, /(?:नस|कलाई|हाथ) काट (?:ली|लिया|दी)/,
  ],
  cannotStaySafeNow: [
    /\bcan'?t (?:keep myself|stay|be) safe\b/,
    /\bcan'?t (?:stop|control) myself\b/,
    /\b(?:khud ?ko|apne ?aap ?ko) rok (?:nahi|nhi|nahin) (?:pa|paa) (?:raha|rahi|rha|rhi|unga|ungi)/,
    /(?:खुद को|अपने आप को) रोक नहीं पा (?:रहा|रही)/,
  ],
  severeDistress: [
    /\bcan'?t (?:take|handle|bear|do) (?:it|this|this anymore|it anymore)\b/,
    /\b(?:panic attack|completely hopeless|falling apart|breaking down|can'?t breathe)\b/,
    /\b(?:bardasht|bardaasht) (?:nahi|nhi|nahin) (?:hota|ho raha|ho rha|hoga)/,
    /\b(?:toot|tut) (?:gaya|gayi|chuka|chuki) (?:hoon|hu|hun)/,
    /\b(?:bahut|bohot|bht) (?:zyada |jyada )?(?:dard|takleef|takleef|ghabrahat)/,
    /बर्दाश्त नहीं/, /टूट (?:गया|गई|चुका|चुकी)/, /(?:बहुत|बेहद) (?:दर्द|तकलीफ़|तकलीफ|घबराहट)/,
  ],
  promptInjection: [
    /\bignore (?:all |any )?(?:the )?(?:previous|prior|above|earlier|your|system) (?:instructions|rules|prompt|messages)/,
    /\b(?:unrestricted|uncensored|unfiltered|jailbroken) (?:ai|mode|assistant)\b/,
    /\b(?:developer|dan|god) mode\b/,
    /\b(?:reveal|show|print|repeat|leak) (?:me )?(?:your |the )?(?:system prompt|hidden instructions|initial instructions)/,
    /\b(?:disable|turn off|bypass|remove|override) (?:your |the |all )?(?:safety|crisis|guard ?rails?|filters?|restrictions)/,
    /\b(?:safety|crisis) (?:rules|restrictions|mode|protocol)s? (?:disable|hata|hatao|band|off|bhool)/,
    /\b(?:pichle|purane|saare|sare|sabhi) (?:\w+ )?(?:rules|instructions|niyam) (?:bhool|bhul|ignore|hata)/,
    /\b(?:restrictions|rules|safety) (?:hata|hatao|hata do|band karo|bhool jao)/,
    /(?:नियम|निर्देश) (?:भूल|हटा|अनदेखा)/,
  ],
};

// Third-party and educational mentions ("an article about suicide prevention") must not fire on the
// bare keyword. First-person patterns above still fire regardless of framing, including roleplay.
const BARE_TERM = /\b(?:suicid(?:e|al)|self[- ]?harm)\b/;
const EDUCATIONAL = /\b(?:article|research|prevention|statistics|documentary|study|awareness|lecture|paper|news|podcast|book|course|helpline number|hotline|movie|film|show|series|song|novel|episode|watched)\b/;

export function detectSafetySignals(message: string): SafetySignals {
  const text = normalize(message);
  const out: SafetySignals = {
    language: detectLanguage(text),
    suicidalIdeation: false,
    selfHarmThoughts: false,
    currentIntent: false,
    planOrMeans: false,
    attemptOrInjuryOrPoisoningNow: false,
    cannotStaySafeNow: false,
    severeDistress: false,
    promptInjection: false,
    matched: [],
  };
  for (const key of Object.keys(PATTERNS) as SignalKey[]) {
    for (const re of PATTERNS[key]) {
      const m = text.match(re);
      if (!m) continue;
      if (key === "selfHarmThoughts" && /self[- ]?harm/.test(m[0]) && EDUCATIONAL.test(text)) continue;
      out[key] = true;
      out.matched.push(`${key}:${m[0]}`);
      break;
    }
  }
  if (!out.suicidalIdeation && BARE_TERM.test(text) && !EDUCATIONAL.test(text) && /\b(?:i|i'm|me|my|myself|mujhe|mereko|main)\b/.test(text) && !/\bnot (?:suicidal|thinking of suicide)\b/.test(text)) {
    out.suicidalIdeation = true;
    out.matched.push("suicidalIdeation:first-person-term");
  }
  return out;
}
