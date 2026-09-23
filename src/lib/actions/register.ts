"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";
import { provisionTenant, getAdministratorRoleId } from "@/lib/provisioning";

const registerSchema = z.object({
  companyName: z.string().min(2, "Zadejte název firmy."),
  name: z.string().min(2, "Zadejte jméno a příjmení."),
  email: z.string().email("Zadejte platný e-mail."),
  password: z.string().min(8, "Heslo musí mít alespoň 8 znaků."),
});

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "firma";
}

export async function registerTenant(formData: FormData) {
  const parsed = registerSchema.safeParse({
    companyName: formData.get("companyName"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Zkontrolujte zadané údaje." };
  }
  const { companyName, name, email, password } = parsed.data;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return { error: "Uživatel s tímto e-mailem už existuje. Přihlaste se prosím." };
  }

  const baseSlug = slugify(companyName);
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.tenant.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${++suffix}`;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: companyName, slug, legalName: companyName },
      });

      // provisionTenant issues its own queries against `prisma`, not `tx` — SQLite only
      // allows one writer at a time, so nesting a second transaction-bound client here
      // would deadlock against this outer transaction. Run it right after commit instead.
      await tx.user.create({
        data: { tenantId: tenant.id, email, passwordHash, name, status: "active" },
      });

      return tenant;
    });
  } catch {
    return { error: "Registraci se nepodařilo dokončit. Zkuste to prosím znovu." };
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!tenant || !user) return { error: "Registraci se nepodařilo dokončit. Zkuste to prosím znovu." };

  await provisionTenant(tenant.id);
  const adminRoleId = await getAdministratorRoleId(tenant.id);
  await prisma.userRole.create({ data: { userId: user.id, roleId: adminRoleId } });

  await signIn("credentials", { email, password, redirectTo: "/dashboard" });
}
