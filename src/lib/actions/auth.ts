"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/dashboard");

  try {
    await signIn("credentials", { email, password, redirectTo: callbackUrl || "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Neplatný e-mail nebo heslo." };
    }
    throw error;
  }
}
