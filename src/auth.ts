import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Heslo", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { userRoles: { include: { role: true } } },
        });
        if (!user || user.status !== "active") return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

        const roleName = user.userRoles[0]?.role.name ?? "Read Only";

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl ?? undefined,
          tenantId: user.tenantId,
          role: roleName,
          jobTitle: user.jobTitle ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.tenantId = (user as { tenantId?: string }).tenantId;
        token.role = (user as { role?: string }).role;
        token.jobTitle = (user as { jobTitle?: string }).jobTitle;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.sub as string;
        (session.user as { tenantId?: string }).tenantId = token.tenantId as string;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { jobTitle?: string }).jobTitle = token.jobTitle as string | undefined;
      }
      return session;
    },
  },
});
