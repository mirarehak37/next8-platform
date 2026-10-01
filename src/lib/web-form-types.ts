// Kinds of public web forms: each has its own fields and lands in a different part of the CRM.
// No DB access here, so client components can use it.

export const WEB_FORM_TYPES = [
  {
    value: "demo",
    label: "Poptávka / demo",
    target: "Leady",
    href: "/crm/leads",
    headline: "Vyzkoušej NEXT8 se svým týmem",
    intro: "Nech nám kontakt, ozveme se do 24 hodin a ukážeme ti, jak NEXT8 funguje.",
    thankYou: "Díky! Ozveme se ti do 24 hodin.",
    source: "Web – poptávka",
  },
  {
    value: "contact",
    label: "Obecný kontakt",
    target: "Leady",
    href: "/crm/leads",
    headline: "Napiš nám",
    intro: "Máš dotaz k NEXT8? Odpovíme co nejdřív.",
    thankYou: "Díky za zprávu, brzy se ozveme.",
    source: "Web – kontakt",
  },
  {
    value: "event",
    label: "Přihláška na akci / kemp",
    target: "Akce a kempy → přihlášky",
    href: "/events",
    headline: "Přihláška",
    intro: "Vyplň přihlášku, potvrzení a platební údaje pošleme e-mailem.",
    thankYou: "Přihláška je odeslaná. Potvrzení ti pošleme e-mailem.",
    source: "Web – přihláška",
  },
  {
    value: "ambassador",
    label: "Chci být ambasadorem",
    target: "Ambasadoři (kandidát)",
    href: "/crm/ambassadors",
    headline: "Staň se ambasadorem NEXT8",
    intro: "Hraješ, trénuješ nebo tvoříš obsah? Napiš nám o sobě.",
    thankYou: "Díky! Projdeme to a ozveme se ti.",
    source: "Web – ambasador",
  },
  {
    value: "partner",
    label: "Partnerství a sponzoring",
    target: "Partneři",
    href: "/crm/partners",
    headline: "Staňte se partnerem NEXT8",
    intro: "Zajímá vás spolupráce nebo sponzoring? Nechte nám kontakt.",
    thankYou: "Děkujeme, ozveme se vám do pár dní.",
    source: "Web – partnerství",
  },
] as const;
export type WebFormType = (typeof WEB_FORM_TYPES)[number]["value"];

export function webFormType(value: string | null | undefined) {
  return WEB_FORM_TYPES.find((t) => t.value === value) ?? WEB_FORM_TYPES[0];
}
