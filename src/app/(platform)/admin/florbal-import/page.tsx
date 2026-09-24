import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { FlorbalImportButton } from "./florbal-import-button";
import { TalentYouthImportButton } from "./talent-youth-import-button";

export default async function FlorbalImportPage() {
  const session = await auth();
  if (session?.user.role !== "Administrator") redirect("/dashboard");

  return (
    <div>
      <PageHeader
        title="Import klubů Českého florbalu"
        description="Jednorázové importy dat pro florbalové kluby a výběry."
        breadcrumbs={[{ label: "Admin" }, { label: "Import klubů" }]}
      />
      <div className="p-6 max-w-lg space-y-6">
        <FlorbalImportButton />
        <TalentYouthImportButton />
      </div>
    </div>
  );
}
