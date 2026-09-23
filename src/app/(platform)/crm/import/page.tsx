import { PageHeader } from "@/components/page-header";
import { ImportWizard } from "./import-wizard";

export default function ImportPage() {
  return (
    <div>
      <PageHeader
        title="Import dat"
        description="Hromadně importujte firmy, kontakty, leady nebo produkty z Excelu, CSV nebo vloženého textu."
        breadcrumbs={[{ label: "CRM" }, { label: "Import dat" }]}
      />
      <div className="p-6">
        <ImportWizard />
      </div>
    </div>
  );
}
