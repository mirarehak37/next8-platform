import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { InviteUserDialog } from "@/components/admin/invite-user-dialog";
import { UserRoleControl, UserStatusControl } from "@/components/admin/user-controls";
import { initials, formatDate } from "@/lib/format";

export default async function UsersPage() {
  const session = await auth();
  const user = session!.user;

  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId: user.tenantId },
      include: { userRoles: { include: { role: true } }, teamMemberships: { include: { team: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.role.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Uživatelé"
        description={`${users.length} uživatelů v organizaci`}
        breadcrumbs={[{ label: "Administrace" }, { label: "Uživatelé" }]}
        actions={<InviteUserDialog roles={roles} />}
      />
      <div className="p-6">
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Uživatel</TableHead>
                <TableHead>Tým</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead>Poslední přihlášení</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8"><AvatarFallback className="text-xs bg-[#FF1947] text-white">{initials(u.name)}</AvatarFallback></Avatar>
                      <div>
                        <div className="text-sm font-medium">{u.name}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.teamMemberships.map((tm) => tm.team.name).join(", ") || "—"}</TableCell>
                  <TableCell><UserRoleControl userId={u.id} roleId={u.userRoles[0]?.roleId ?? ""} roles={roles} /></TableCell>
                  <TableCell><UserStatusControl userId={u.id} status={u.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.lastLoginAt ? formatDate(u.lastLoginAt) : "Nikdy"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
