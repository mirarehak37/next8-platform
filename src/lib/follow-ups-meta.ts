// Labels and defaults of the built-in follow-ups (no DB access, safe for client components).

export const FOLLOW_UPS = {
  lead_call: {
    label: "Nový lead → zavolat",
    description: "Každý nový lead (ručně i z webového formuláře) dostane úkol pro vlastníka leadu.",
    defaults: { days: 1 },
  },
  deal_onboarding: {
    label: "Vyhraný obchod → onboarding",
    description: "Po výhře obchodu check-iny s klubem, jestli NEXT8 opravdu používají.",
    defaults: { days: [7, 30, 90] },
  },
  deal_renewal: {
    label: "Roční balíček → obnova",
    description: "U ročního balíčku připomene ozvat se klubu před koncem předplatného.",
    defaults: { daysBefore: 30 },
  },
} as const;
export type FollowUpKey = keyof typeof FOLLOW_UPS;

export type FollowUpSettings = {
  lead_call: { isActive: boolean; days: number };
  deal_onboarding: { isActive: boolean; days: number[] };
  deal_renewal: { isActive: boolean; daysBefore: number };
};
