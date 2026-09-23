import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CreateTeamDialog, AddTeamMemberControl, RemoveTeamMemberButton } from "@/components/admin/team-dialog";
import { initials } from "@/lib/format";

export default async function TeamsPage() {
  const session = await auth();
  const user = session!.user;

  const [teams, allUsers] = await Promise.all([
    prisma.team.findMany({ where: { tenantId: user.tenantId }, include: { members: { include: { user: true } } }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { tenantId: user.tenantId, status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="Týmy" description={`${teams.length} týmů`} breadcrumbs={[{ label: "Administrace" }, { label: "Týmy" }]} actions={<CreateTeamDialog />} />
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {teams.map((team) => {
          const memberIds = new Set(team.members.map((m) => m.userId));
          const candidates = allUsers.filter((u) => !memberIds.has(u.id));
          return (
            <Card key={team.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{team.name}</CardTitle>
                <AddTeamMemberControl teamId={team.id} candidates={candidates} />
              </CardHeader>
              <CardContent className="space-y-2">
                {team.members.length === 0 && <p className="text-sm text-muted-foreground">Zatím žádní členové.</p>}
                {team.members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7"><AvatarFallback className="text-[10px]">{initials(m.user.name)}</AvatarFallback></Avatar>
                      <span className="text-sm">{m.user.name}</span>
                      {m.roleInTeam === "lead" && <span className="text-[10px] text-muted-foreground border rounded px-1.5 py-0.5">vedoucí</span>}
                    </div>
                    <RemoveTeamMemberButton memberId={m.id} />
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
