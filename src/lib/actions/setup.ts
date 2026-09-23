"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";
import { provisionTenant, getAdministratorRoleId } from "@/lib/provisioning";

// This platform is NEXT8's own internal workspace, not a multi-tenant SaaS product —
// there is exactly one Tenant row, ever. This checks that instead of letting anyone
// spin up a second one.
export async function isSetupComplete() {
  const count = await prisma.tenant.count();
  return count > 0;
}

const NEXT8_TENANT = { name: "NEXT8 Performance", legalName: "NEXT8 Performance s.r.o.", slug: "next8" };

const setupSchema = z.object({
  name: z.string().min(2, "Zadejte jméno a příjmení."),
  email: z.string().email("Zadejte platný e-mail."),
  password: z.string().min(8, "Heslo musí mít alespoň 8 znaků."),
});

export async function setupWorkspace(formData: FormData) {
  if (await isSetupComplete()) {
    return { error: "Pracovní prostor NEXT8 už je nastavený. Přihlaste se prosím." };
  }

  const parsed = setupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Zkontrolujte zadané údaje." };
  }
  const { name, email, password } = parsed.data;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return { error: "Uživatel s tímto e-mailem už existuje. Přihlaste se prosím." };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: NEXT8_TENANT });
      await tx.user.create({
        data: { tenantId: tenant.id, email, passwordHash, name, status: "active" },
      });
    });
  } catch {
    return { error: "Nastavení se nepodařilo dokončit. Zkuste to prosím znovu." };
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug: NEXT8_TENANT.slug } });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!tenant || !user) return { error: "Nastavení se nepodařilo dokončit. Zkuste to prosím znovu." };

  await provisionTenant(tenant.id);
  const adminRoleId = await getAdministratorRoleId(tenant.id);
  await prisma.userRole.create({ data: { userId: user.id, roleId: adminRoleId } });

  await signIn("credentials", { email, password, redirectTo: "/dashboard" });
}
