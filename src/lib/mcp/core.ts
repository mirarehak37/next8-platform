import type { z } from "zod";
import type { TokenUser } from "@/lib/api-tokens";

export class ToolError extends Error {}

export type Tool<S extends z.ZodType> = {
  name: string;
  title: string;
  description: string;
  input: S;
  readOnly: boolean;
  destructive?: boolean;
  run: (user: TokenUser, args: z.infer<S>) => Promise<unknown>;
};

export function tool<S extends z.ZodType>(t: Tool<S>) {
  return t;
}
