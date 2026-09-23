import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QuoteStatusControl } from "@/components/crm/quote-status-control";
import { Building2, Handshake } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const user = session!.user;

  const quote = await prisma.quote.findFirst({
    where: { id, tenantId: user.tenantId },
    include: { company: true, contact: true, deal: true, owner: true, items: { orderBy: { order: "asc" } } },
  });
  if (!quote) notFound();

  return (
    <div>
      <PageHeader
        title={`Nabídka ${quote.number}`}
        breadcrumbs={[{ label: "CRM" }, { label: "Nabídky", href: "/crm/quotes" }, { label: quote.number }]}
        actions={<QuoteStatusControl quoteId={quote.id} status={quote.status} />}
      />
      <div className="p-6 max-w-3xl">
        <Card>
          <CardContent className="space-y-6 p-8">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-muted-foreground">NEXT8 Performance s.r.o.</div>
                <h2 className="text-xl font-semibold mt-1">Cenová nabídka {quote.number}</h2>
                <div className="text-sm text-muted-foreground mt-1">Vystaveno: {formatDate(quote.createdAt)}</div>
                {quote.validUntil && <div className="text-sm text-muted-foreground">Platnost do: {formatDate(quote.validUntil)}</div>}
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold">{formatCurrency(quote.total, quote.currency)}</div>
                <div className="text-xs text-muted-foreground">vč. DPH</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 text-sm">
              {quote.company && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Odběratel</div>
                  <Link href={`/crm/companies/${quote.company.id}`} className="flex items-center gap-1.5 font-medium text-[#FF1947] hover:underline">
                    <Building2 className="h-3.5 w-3.5" /> {quote.company.name}
                  </Link>
                  {quote.company.registrationNumber && <div className="text-muted-foreground text-xs mt-0.5">IČO: {quote.company.registrationNumber}</div>}
                </div>
              )}
              {quote.deal && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Obchodní případ</div>
                  <Link href={`/crm/deals/${quote.deal.id}`} className="flex items-center gap-1.5 font-medium text-[#FF1947] hover:underline">
                    <Handshake className="h-3.5 w-3.5" /> {quote.deal.name}
                  </Link>
                </div>
              )}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Položka</TableHead>
                  <TableHead className="text-right">Množství</TableHead>
                  <TableHead className="text-right">Cena/ks</TableHead>
                  <TableHead className="text-right">DPH</TableHead>
                  <TableHead className="text-right">Celkem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quote.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell className="text-right">{item.vatRate}%</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(item.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex justify-end">
              <div className="w-56 space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Bez DPH</span><span>{formatCurrency(quote.subtotal)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>DPH</span><span>{formatCurrency(quote.vatTotal)}</span></div>
                <div className="flex justify-between font-semibold text-base border-t pt-1"><span>Celkem</span><span>{formatCurrency(quote.total)}</span></div>
              </div>
            </div>

            {quote.terms && (
              <div className="text-sm text-muted-foreground border-t pt-4">
                <div className="text-xs font-medium text-foreground mb-1">Obchodní podmínky</div>
                {quote.terms}
              </div>
            )}

            <div className="text-xs text-muted-foreground border-t pt-4">Zpracoval: {quote.owner.name}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
