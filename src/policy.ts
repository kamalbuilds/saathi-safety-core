import type { SafetySignals } from "./signals.ts";

export type SafetyState = "NORMAL" | "CRISIS_CHECK" | "CRISIS_SUPPORT" | "EMERGENCY";

// Comes only from the two structured buttons in the crisis check UI, never parsed from free text,
// so neither the user's prose nor the model's output can forge it.
export type SafetyAnswer = "IMMEDIATE_DANGER" | "NOT_IMMEDIATE" | null;

// Issued only by an authenticated clinician route. Lowers an active state one step at most.
export type HumanRelease = "CLINICIAN_REVIEWED" | null;

export function transition(
  current: SafetyState,
  signals: SafetySignals,
  answer: SafetyAnswer,
  release: HumanRelease = null,
): SafetyState {
  const immediateDanger =
    signals.attemptOrInjuryOrPoisoningNow ||
    (signals.currentIntent && (signals.planOrMeans || signals.cannotStaySafeNow)) ||
    answer === "IMMEDIATE_DANGER";

  if (immediateDanger) return "EMERGENCY";

  const concern =
    signals.suicidalIdeation ||
    signals.selfHarmThoughts ||
    signals.currentIntent ||
    signals.cannotStaySafeNow ||
    signals.severeDistress;

  if (release === "CLINICIAN_REVIEWED" && !concern) {
    if (current === "EMERGENCY") return "CRISIS_SUPPORT";
    if (current === "CRISIS_SUPPORT" || current === "CRISIS_CHECK") return "NORMAL";
  }

  if (current === "EMERGENCY") return "EMERGENCY";
  if (current === "CRISIS_SUPPORT") return "CRISIS_SUPPORT";
  if (current === "CRISIS_CHECK") return answer === "NOT_IMMEDIATE" ? "CRISIS_SUPPORT" : "CRISIS_CHECK";
  if (concern) return "CRISIS_CHECK";
  return "NORMAL";
}

export interface CallAction {
  label: string;
  tel: string;
}

export interface SafetyResponse {
  bypassLLM: boolean;
  message?: string;
  primaryAction?: CallAction;
  secondaryAction?: CallAction;
  answerButtons?: { label: string; answer: Exclude<SafetyAnswer, null> }[];
}

// Tele-MANAS 14416 (MoHFW, 24/7) and ERSS 112 (MHA). Templates are fixed strings for clinician sign-off.
export const TELE_MANAS: CallAction = { label: "Call Tele-MANAS (24/7, free)", tel: "14416" };
export const ERSS: CallAction = { label: "Call emergency services (112)", tel: "112" };

export function getSafetyActions(state: SafetyState): SafetyResponse {
  switch (state) {
    case "CRISIS_CHECK":
      return {
        bypassLLM: true,
        message: "Thank you for telling me. I want to make sure you're safe. Are you in immediate danger right now, or have you already taken steps to hurt yourself?",
        answerButtons: [
          { label: "Yes, I'm in danger or I've hurt myself", answer: "IMMEDIATE_DANGER" },
          { label: "No, not right now", answer: "NOT_IMMEDIATE" },
        ],
        primaryAction: TELE_MANAS,
        secondaryAction: ERSS,
      };
    case "CRISIS_SUPPORT":
      return {
        bypassLLM: true,
        message: "You don't have to handle this alone. A trained counsellor at Tele-MANAS is available right now, in Hindi, English and other Indian languages.",
        primaryAction: TELE_MANAS,
        secondaryAction: ERSS,
      };
    case "EMERGENCY":
      return {
        bypassLLM: true,
        message: "Please call 112 now. If you can, reach someone you trust and ask them to stay with you, and move away from anything you could use to hurt yourself.",
        primaryAction: ERSS,
        secondaryAction: TELE_MANAS,
      };
    case "NORMAL":
      return { bypassLLM: false };
  }
}
