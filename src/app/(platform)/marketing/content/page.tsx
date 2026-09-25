import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { ContentBoard } from "@/components/marketing/content-board";
import { PostFormDialog } from "@/components/marketing/post-form-dialog";
import { loadPostFormOptions, postInclude, toPostView } from "@/lib/marketing-queries";

export default async function MarketingContentPage() {
  const session = await auth();
  const user = session!.user;
  if (!can(user.role, "marketing", "view")) redirect("/dashboard");

  const [posts, options] = await Promise.all([
    prisma.marketingPost.findMany({
      where: { tenantId: user.tenantId },
      include: postInclude,
      orderBy: [{ scheduledAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    }),
    loadPostFormOptions(user.tenantId),
  ]);
  const canEdit = can(user.role, "marketing", "edit");
  const ideas = posts.filter((p) => p.status === "idea").length;

  return (
    <div>
      <PageHeader
        title="Obsah a posty"
        description={`${posts.length} příspěvků · ${ideas} nápadů v zásobníku`}
        breadcrumbs={[{ label: "Marketing", href: "/marketing" }, { label: "Obsah a posty" }]}
        actions={can(user.role, "marketing", "create") ? <PostFormDialog options={options} currentUserId={user.id} /> : null}
      />
      <div className="p-6">
        <ContentBoard
          posts={posts.map(toPostView)}
          options={options}
          currentUserId={user.id}
          canEdit={canEdit}
          canDelete={can(user.role, "marketing", "delete")}
        />
      </div>
    </div>
  );
}
