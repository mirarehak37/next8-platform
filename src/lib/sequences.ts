import type { TagTone } from "@/components/common/tag";

export const SEQUENCE_STEP_TYPES = [
  { value: "email", label: "Email", tone: "blue" },
  { value: "call", label: "Hovor", tone: "green" },
  { value: "task", label: "Úkol", tone: "amber" },
] as const satisfies readonly { value: string; label: string; tone: TagTone }[];

export type SequenceStepType = (typeof SEQUENCE_STEP_TYPES)[number]["value"];

export function stepTypeMeta(type: string) {
  return SEQUENCE_STEP_TYPES.find((t) => t.value === type) ?? SEQUENCE_STEP_TYPES[2];
}

export const ENROLLMENT_STATUSES: Record<string, { label: string; tone: TagTone }> = {
  active: { label: "Běží", tone: "blue" },
  completed: { label: "Dokončeno", tone: "green" },
  replied: { label: "Odpověděl", tone: "purple" },
  stopped: { label: "Zastaveno", tone: "neutral" },
};
