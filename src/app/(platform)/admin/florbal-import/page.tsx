import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { FlorbalImportButton } from "./florbal-import-button";

export default async function FlorbalImportPage() {
  const session = await auth();
  if (session?.user.role !== "Administrator") redirect("/dashboard");

  return (
    <div>
      <PageHeader
        title="Import klubů Českého florbalu"
        description="Jednorázový import ~400 klubů a jejich týmů z veřejného adresáře ceskyflorbal.cz."
        breadcrumbs={[{ label: "Admin" }, { label: "Import klubů" }]}
      />
      <div className="p-6 max-w-lg">
        <FlorbalImportButton />
      </div>
    </div>
  );
}
