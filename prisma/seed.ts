import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ROLE_MATRIX, ROLE_NAMES } from "../src/lib/rbac";

const prisma = new PrismaClient();

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log("Seeding database…");

  await prisma.$transaction([
    prisma.taskChecklistItem.deleteMany(),
    prisma.task.deleteMany(),
    prisma.activity.deleteMany(),
    prisma.quoteItem.deleteMany(),
    prisma.quote.deleteMany(),
    prisma.dealProduct.deleteMany(),
    prisma.dealContact.deleteMany(),
    prisma.deal.deleteMany(),
    prisma.pipelineStage.deleteMany(),
    prisma.pipeline.deleteMany(),
    prisma.lead.deleteMany(),
    prisma.companyContact.deleteMany(),
    prisma.contact.deleteMany(),
    prisma.company.deleteMany(),
    prisma.product.deleteMany(),
    prisma.taggedItem.deleteMany(),
    prisma.tag.deleteMany(),
    prisma.customFieldValue.deleteMany(),
    prisma.customFieldDefinition.deleteMany(),
    prisma.savedView.deleteMany(),
    prisma.workflowRun.deleteMany(),
    prisma.workflowRule.deleteMany(),
    prisma.numberSequence.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.teamMember.deleteMany(),
    prisma.team.deleteMany(),
    prisma.userRole.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.permission.deleteMany(),
    prisma.role.deleteMany(),
    prisma.tenantModule.deleteMany(),
    prisma.user.deleteMany(),
    prisma.module.deleteMany(),
    prisma.tenant.deleteMany(),
  ]);

  // ---- Tenant ----------------------------------------------------------
  const tenant = await prisma.tenant.create({
    data: {
      name: "NEXT8 Performance s.r.o.",
      slug: "next8",
      legalName: "NEXT8 Performance s.r.o.",
      plan: "business",
    },
  });

  // ---- Module registry ---------------------------------------------------
  const modules = await Promise.all(
    [
      { code: "crm", name: "CRM", icon: "users-round", isCore: true, route: "/crm", order: 1 },
      { code: "roadmap", name: "Roadmap", icon: "map", isCore: true, route: "/roadmap", order: 2 },
      { code: "invoices", name: "Faktury", icon: "receipt", isCore: false, route: "/invoices", order: 3 },
      { code: "orders", name: "Objednávky", icon: "shopping-cart", isCore: false, route: "/orders", order: 4 },
      { code: "contracts", name: "Smlouvy", icon: "file-signature", isCore: false, route: "/contracts", order: 5 },
      { code: "projects", name: "Projekty", icon: "kanban-square", isCore: false, route: "/projects", order: 6 },
      { code: "helpdesk", name: "HelpDesk", icon: "life-buoy", isCore: false, route: "/helpdesk", order: 7 },
      { code: "documents", name: "Dokumenty (DMS)", icon: "folder", isCore: false, route: "/documents", order: 8 },
      { code: "hr", name: "HR", icon: "id-card", isCore: false, route: "/hr", order: 9 },
      { code: "assets", name: "Majetek", icon: "package", isCore: false, route: "/assets", order: 10 },
      { code: "approvals", name: "Schvalování", icon: "check-check", isCore: false, route: "/approvals", order: 11 },
    ].map((m) => prisma.module.create({ data: m })),
  );
  const coreModuleCodes = new Set(["crm", "roadmap"]);
  for (const m of modules) {
    await prisma.tenantModule.create({ data: { tenantId: tenant.id, moduleId: m.id, enabled: coreModuleCodes.has(m.code) } });
  }
  const roadmapModule = modules.find((m) => m.code === "roadmap")!;

  // ---- Permission catalog + roles ----------------------------------------
  const resources = Array.from(
    new Set(ROLE_NAMES.flatMap((r) => Object.keys(ROLE_MATRIX[r]))),
  );
  const actionSet = new Set<string>();
  for (const r of ROLE_NAMES) {
    for (const res of Object.keys(ROLE_MATRIX[r])) {
      ROLE_MATRIX[r][res as keyof (typeof ROLE_MATRIX)[typeof r]]!.actions.forEach((a) => actionSet.add(a));
    }
  }
  const permissionByCode = new Map<string, string>();
  for (const resource of resources) {
    for (const action of actionSet) {
      const code = `${resource}.${action}`;
      const perm = await prisma.permission.create({
        data: { code, module: "crm", resource, action, label: `${resource}:${action}` },
      });
      permissionByCode.set(code, perm.id);
    }
  }

  const roleByName = new Map<string, string>();
  for (const roleName of ROLE_NAMES) {
    const role = await prisma.role.create({
      data: { tenantId: tenant.id, name: roleName, isSystem: true, description: `Systémová role ${roleName}` },
    });
    roleByName.set(roleName, role.id);
    const matrix = ROLE_MATRIX[roleName];
    for (const [resource, def] of Object.entries(matrix)) {
      for (const action of def!.actions) {
        const permId = permissionByCode.get(`${resource}.${action}`);
        if (permId) {
          await prisma.rolePermission.create({
            data: { roleId: role.id, permissionId: permId, scope: def!.scope },
          });
        }
      }
    }
  }

  // ---- Users --------------------------------------------------------------
  const passwordHash = await bcrypt.hash("demo1234", 10);
  const demoUsers = [
    { email: "admin@next8.cz", name: "Adam Novák", role: "Administrator", jobTitle: "IT Administrátor" },
    { email: "reditel@next8.cz", name: "Petra Svobodová", role: "Management", jobTitle: "Obchodní ředitelka" },
    { email: "vedouci.obchodu@next8.cz", name: "Tomáš Dvořák", role: "Sales Manager", jobTitle: "Vedoucí obchodního týmu" },
    { email: "lucie.prochazkova@next8.cz", name: "Lucie Procházková", role: "Sales", jobTitle: "Obchodní zástupkyně" },
    { email: "jakub.horak@next8.cz", name: "Jakub Horák", role: "Sales", jobTitle: "Obchodní zástupce" },
    { email: "marketing@next8.cz", name: "Eva Marková", role: "Marketing", jobTitle: "Marketingová specialistka" },
    { email: "finance@next8.cz", name: "Martin Král", role: "Finance", jobTitle: "Finanční manažer" },
    { email: "podpora@next8.cz", name: "Kateřina Veselá", role: "Support", jobTitle: "Zákaznická podpora" },
    { email: "viewer@next8.cz", name: "Viktor Čtenář", role: "Read Only", jobTitle: "Externí konzultant" },
  ];

  const users = new Map<string, Awaited<ReturnType<typeof prisma.user.create>>>();
  for (const u of demoUsers) {
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: u.email,
        passwordHash,
        name: u.name,
        jobTitle: u.jobTitle,
        status: "active",
      },
    });
    await prisma.userRole.create({ data: { userId: user.id, roleId: roleByName.get(u.role)! } });
    users.set(u.email, user);
  }

  const admin = users.get("admin@next8.cz")!;
  const director = users.get("reditel@next8.cz")!;
  const salesManager = users.get("vedouci.obchodu@next8.cz")!;
  const sales1 = users.get("lucie.prochazkova@next8.cz")!;
  const sales2 = users.get("jakub.horak@next8.cz")!;
  const marketingUser = users.get("marketing@next8.cz")!;
  const supportUser = users.get("podpora@next8.cz")!;
  const financeUser = users.get("finance@next8.cz")!;

  // ---- Teams ---------------------------------------------------------------
  const teamPraha = await prisma.team.create({ data: { tenantId: tenant.id, name: "Obchod Praha" } });
  const teamBrno = await prisma.team.create({ data: { tenantId: tenant.id, name: "Obchod Brno" } });
  await prisma.teamMember.createMany({
    data: [
      { teamId: teamPraha.id, userId: salesManager.id, roleInTeam: "lead" },
      { teamId: teamPraha.id, userId: sales1.id },
      { teamId: teamBrno.id, userId: sales2.id, roleInTeam: "lead" },
    ],
  });

  // ---- Pipeline --------------------------------------------------------------
  const pipeline = await prisma.pipeline.create({
    data: { tenantId: tenant.id, name: "Standardní obchodní pipeline", isDefault: true, order: 1 },
  });
  const stageDefs = [
    { name: "Nový", order: 1, probability: 10 },
    { name: "Kvalifikace", order: 2, probability: 20 },
    { name: "Analýza", order: 3, probability: 35 },
    { name: "Demo", order: 4, probability: 50 },
    { name: "Nabídka", order: 5, probability: 65 },
    { name: "Jednání", order: 6, probability: 80 },
    { name: "Vyhráno", order: 7, probability: 100, isWon: true },
    { name: "Prohráno", order: 8, probability: 0, isLost: true },
  ];
  const stages = new Map<string, Awaited<ReturnType<typeof prisma.pipelineStage.create>>>();
  for (const s of stageDefs) {
    const stage = await prisma.pipelineStage.create({
      data: { pipelineId: pipeline.id, name: s.name, order: s.order, probability: s.probability, isWon: !!s.isWon, isLost: !!s.isLost },
    });
    stages.set(s.name, stage);
  }

  // ---- Products --------------------------------------------------------------
  const productDefs = [
    { name: "CRM Professional – licence (měsíčně)", code: "LIC-CRM-PRO", category: "Licence", price: 1490, isRecurring: true, billingPeriod: "monthly" },
    { name: "CRM Enterprise – licence (měsíčně)", code: "LIC-CRM-ENT", category: "Licence", price: 3990, isRecurring: true, billingPeriod: "monthly" },
    { name: "Onboarding a implementace", code: "SVC-ONBOARD", category: "Implementace", price: 45000, isRecurring: false },
    { name: "Prémiová podpora (ročně)", code: "SVC-SUPPORT-PREM", category: "Podpora", price: 24000, isRecurring: true, billingPeriod: "yearly" },
    { name: "Konzultační hodiny (balíček 10h)", code: "SVC-CONSULT-10", category: "Konzultace", price: 18000, isRecurring: false },
    { name: "Marketingový audit", code: "SVC-AUDIT-MKT", category: "Marketing", price: 32000, isRecurring: false },
    { name: "SEO balíček Growth", code: "SVC-SEO-GROWTH", category: "Marketing", price: 22000, isRecurring: true, billingPeriod: "monthly" },
    { name: "PPC správa kampaní", code: "SVC-PPC-MGMT", category: "Marketing", price: 15000, isRecurring: true, billingPeriod: "monthly" },
    { name: "Školení uživatelů (skupina)", code: "SVC-TRAINING", category: "Vzdělávání", price: 9000, isRecurring: false },
    { name: "API integrace na míru", code: "SVC-API-CUSTOM", category: "Implementace", price: 60000, isRecurring: false },
  ];
  const products = [];
  for (const p of productDefs) {
    products.push(
      await prisma.product.create({
        data: { tenantId: tenant.id, name: p.name, code: p.code, category: p.category, price: p.price, isRecurring: p.isRecurring, billingPeriod: p.billingPeriod ?? null, unit: p.isRecurring ? "měsíc" : "ks" },
      }),
    );
  }

  // ---- Tags --------------------------------------------------------------
  const tagDefs = ["VIP", "Upsell příležitost", "Enterprise", "Newsletter", "Partner"];
  const tags = new Map<string, Awaited<ReturnType<typeof prisma.tag.create>>>();
  for (const name of tagDefs) {
    tags.set(name, await prisma.tag.create({ data: { tenantId: tenant.id, name, color: pick(["emerald", "indigo", "amber", "rose", "sky"]) } }));
  }

  // ---- Custom field example --------------------------------------------------
  const partnerLevelField = await prisma.customFieldDefinition.create({
    data: {
      tenantId: tenant.id,
      entityType: "company",
      key: "partner_level",
      label: "Úroveň partnerství",
      fieldType: "select",
      options: JSON.stringify(["Bronze", "Silver", "Gold"]),
      order: 1,
    },
  });

  // ---- Companies --------------------------------------------------------------
  const companyDefs = [
    { name: "Moravia Steel Group a.s.", industry: "Výroba a hutnictví", city: "Ostrava", size: "1000+", owner: sales2, status: "active", segment: "Enterprise" },
    { name: "Pražská pekárna s.r.o.", industry: "Potravinářství", city: "Praha", size: "51-200", owner: sales1, status: "active", segment: "SMB" },
    { name: "TechnoLogistik CZ s.r.o.", industry: "Logistika", city: "Plzeň", size: "201-1000", owner: sales2, status: "active", segment: "Mid-market" },
    { name: "Byznys Media s.r.o.", industry: "Média a vydavatelství", city: "Praha", size: "11-50", owner: sales1, status: "prospect", segment: "SMB" },
    { name: "AgroFarm Vysočina a.s.", industry: "Zemědělství", city: "Jihlava", size: "51-200", owner: sales2, status: "active", segment: "SMB" },
    { name: "Dativa Software s.r.o.", industry: "IT a software", city: "Brno", size: "11-50", owner: sales1, status: "active", segment: "Mid-market" },
    { name: "Stavební huť Morava a.s.", industry: "Stavebnictví", city: "Zlín", size: "201-1000", owner: sales2, status: "active", segment: "Mid-market" },
    { name: "Fashion Point CZ s.r.o.", industry: "Maloobchod", city: "Praha", size: "11-50", owner: sales1, status: "prospect", segment: "SMB" },
    { name: "Energie Bohemia a.s.", industry: "Energetika", city: "Ústí nad Labem", size: "1000+", owner: sales2, status: "active", segment: "Enterprise" },
    { name: "Nová Klinika Care s.r.o.", industry: "Zdravotnictví", city: "Olomouc", size: "51-200", owner: sales1, status: "inactive", segment: "SMB" },
    { name: "Digital Reklama s.r.o.", industry: "Marketing a reklama", city: "Praha", size: "11-50", owner: sales1, status: "active", segment: "SMB" },
    { name: "Kovo Výroba Plus s.r.o.", industry: "Strojírenství", city: "Liberec", size: "51-200", owner: sales2, status: "prospect", segment: "SMB" },
    { name: "Wellness Group Bohemia a.s.", industry: "Služby", city: "Karlovy Vary", size: "201-1000", owner: sales1, status: "active", segment: "Mid-market" },
    { name: "TransEuro Doprava s.r.o.", industry: "Doprava", city: "Brno", size: "201-1000", owner: sales2, status: "lost", segment: "Mid-market" },
    { name: "GreenTech Solutions s.r.o.", industry: "Obnovitelná energie", city: "Praha", size: "11-50", owner: sales1, status: "active", segment: "SMB" },
  ];

  const czechFirstNamesM = ["Jan", "Petr", "Martin", "Tomáš", "Jiří", "Pavel", "Michal", "David", "Lukáš", "Ondřej"];
  const czechFirstNamesF = ["Jana", "Eva", "Petra", "Hana", "Lucie", "Markéta", "Kateřina", "Veronika", "Alena", "Barbora"];
  const czechLastNamesM = ["Novák", "Svoboda", "Novotný", "Dvořák", "Černý", "Procházka", "Kučera", "Veselý", "Horák", "Marek"];
  const czechLastNamesF = ["Nováková", "Svobodová", "Novotná", "Dvořáková", "Černá", "Procházková", "Kučerová", "Veselá", "Horáková", "Marková"];
  const jobTitles = ["Jednatel", "Marketingová ředitelka", "Nákupčí", "Finanční ředitel", "Obchodní ředitel", "IT manažer", "Office manažerka", "Provozní ředitel"];

  const companies = [];
  for (const c of companyDefs) {
    const ico = String(10000000 + Math.floor(Math.random() * 89999999));
    const company = await prisma.company.create({
      data: {
        tenantId: tenant.id,
        name: c.name,
        legalName: c.name,
        registrationNumber: ico,
        vatNumber: `CZ${ico}`,
        companyType: c.name.includes("a.s.") ? "a.s." : "s.r.o.",
        status: c.status,
        segment: c.segment,
        industry: c.industry,
        sizeBand: c.size,
        employeeCount: c.size === "1000+" ? 1500 : c.size === "201-1000" ? 450 : c.size === "51-200" ? 120 : 30,
        annualRevenue: c.size === "1000+" ? 850_000_000 : c.size === "201-1000" ? 180_000_000 : c.size === "51-200" ? 42_000_000 : 8_500_000,
        website: `www.${c.name.toLowerCase().split(" ")[0].replace(/[^a-z]/g, "")}.cz`,
        phone: `+420 ${String(200000000 + Math.floor(Math.random() * 99999999))}`,
        email: `info@${c.name.toLowerCase().split(" ")[0].replace(/[^a-z]/g, "")}.cz`,
        billingStreet: `Ulice ${1 + Math.floor(Math.random() * 200)}`,
        billingCity: c.city,
        billingZip: `${10000 + Math.floor(Math.random() * 89999)}`,
        source: pick(["Web", "Doporučení", "Veletrh", "Kampaň", "LinkedIn", "Partner"]),
        ownerId: c.owner.id,
        teamId: c.owner === sales1 ? teamPraha.id : teamBrno.id,
        description: `Klíčový klient v odvětví ${c.industry.toLowerCase()}.`,
      },
    });
    companies.push({ ...c, record: company });

    // contacts per company
    const numContacts = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < numContacts; i++) {
      const isMale = Math.random() > 0.5;
      const firstName = isMale ? pick(czechFirstNamesM) : pick(czechFirstNamesF);
      const lastName = isMale ? pick(czechLastNamesM) : pick(czechLastNamesF);
      const contact = await prisma.contact.create({
        data: {
          tenantId: tenant.id,
          firstName,
          lastName,
          jobTitle: pick(jobTitles),
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${c.name.toLowerCase().split(" ")[0].replace(/[^a-z]/g, "")}.cz`,
          phone: `+420 ${String(600000000 + Math.floor(Math.random() * 99999999))}`,
          ownerId: c.owner.id,
          status: "active",
          source: pick(["Web", "Doporučení", "Veletrh", "Kampaň"]),
          gdprConsent: true,
          marketingConsent: Math.random() > 0.3,
        },
      });
      await prisma.companyContact.create({
        data: { companyId: company.id, contactId: contact.id, role: pick(jobTitles), isPrimary: i === 0 },
      });
      (company as unknown as { _contacts: string[] })["_contacts"] ??= [] as unknown as string[];
      (company as unknown as { _contacts: string[] })._contacts.push(contact.id);
    }

    if (Math.random() > 0.6) {
      await prisma.taggedItem.create({
        data: { tagId: pick([...tags.values()]).id, entityType: "company", entityId: company.id },
      });
    }
    if (c.segment === "Enterprise" || c.segment === "Mid-market") {
      await prisma.customFieldValue.create({
        data: { definitionId: partnerLevelField.id, entityId: company.id, value: pick(["Bronze", "Silver", "Gold"]) },
      });
    }
  }

  const allContacts = await prisma.contact.findMany();
  const allCompanies = await prisma.company.findMany();

  // ---- Leads --------------------------------------------------------------
  const leadCompanyNames = [
    "Metrio Analytics s.r.o.", "BuildFast Stavby s.r.o.", "Severočeská Distribuce a.s.", "PetShop Online s.r.o.",
    "Institut Vzdělávání ČR", "Alpine Sport CZ s.r.o.", "FinTech Solutions Brno s.r.o.", "Rodinná Pekárna Klas",
    "Cloud Servery s.r.o.", "Interier Design Studio",
  ];
  for (const name of leadCompanyNames) {
    const isMale = Math.random() > 0.5;
    await prisma.lead.create({
      data: {
        tenantId: tenant.id,
        firstName: isMale ? pick(czechFirstNamesM) : pick(czechFirstNamesF),
        lastName: isMale ? pick(czechLastNamesM) : pick(czechLastNamesF),
        companyName: name,
        jobTitle: pick(jobTitles),
        email: `kontakt@${name.toLowerCase().split(" ")[0].replace(/[^a-z]/g, "")}.cz`,
        phone: `+420 ${String(700000000 + Math.floor(Math.random() * 99999999))}`,
        source: pick(["Web", "Doporučení", "Veletrh", "Kampaň", "Studený telefonát", "LinkedIn"]),
        campaign: pick(["Jarní kampaň 2026", "Webinář CRM", "Google Ads Q1", "LinkedIn Ads", null]),
        estimatedValue: 20000 + Math.floor(Math.random() * 400000),
        ownerId: pick([sales1, sales2, marketingUser]).id,
        status: pick(["new", "to_contact", "contacted", "qualifying", "qualified", "unqualified"]),
        rating: pick(["hot", "warm", "cold"]),
        notes: "Zájem projeven přes marketingový kanál, čeká na kvalifikaci obchodníkem.",
      },
    });
  }

  // ---- Deals + products + contacts + quotes --------------------------------------
  const dealNameTemplates = ["Implementace CRM", "Rozšíření licencí", "Marketingová podpora", "Roční support", "Digitální transformace", "SEO & PPC balíček"];
  let quoteCounter = 1;
  for (let i = 0; i < 22; i++) {
    const company = pick(allCompanies);
    const owner = company.ownerId === sales1.id ? sales1 : sales2;
    const stageRoll = Math.random();
    let stage;
    let status = "open";
    if (stageRoll < 0.25) { stage = stages.get("Vyhráno")!; status = "won"; }
    else if (stageRoll < 0.4) { stage = stages.get("Prohráno")!; status = "lost"; }
    else {
      stage = pick([stages.get("Nový")!, stages.get("Kvalifikace")!, stages.get("Analýza")!, stages.get("Demo")!, stages.get("Nabídka")!, stages.get("Jednání")!]);
    }
    const value = 30000 + Math.floor(Math.random() * 900000);
    const companyContacts = await prisma.companyContact.findMany({ where: { companyId: company.id } });
    const primaryContactId = companyContacts[0]?.contactId;

    // Backdate creation so won/lost deals have a plausible sales-cycle length,
    // and so "new this month" KPIs aren't artificially inflated by all-at-once seeding.
    const closedDaysAgo = Math.floor(Math.random() * 25);
    const cycleLengthDays = 10 + Math.floor(Math.random() * 60);
    const closedAt = status !== "open" ? daysAgo(closedDaysAgo) : undefined;
    const dealCreatedAt = status !== "open" ? daysAgo(closedDaysAgo + cycleLengthDays) : daysAgo(Math.floor(Math.random() * 75));

    const deal = await prisma.deal.create({
      data: {
        tenantId: tenant.id,
        name: `${pick(dealNameTemplates)} – ${company.name}`,
        companyId: company.id,
        primaryContactId,
        ownerId: owner.id,
        teamId: owner.id === sales1.id ? teamPraha.id : teamBrno.id,
        pipelineId: pipeline.id,
        stageId: stage.id,
        value,
        probability: stage.probability,
        status,
        createdAt: dealCreatedAt,
        expectedCloseDate: status === "open" ? daysFromNow(Math.floor(Math.random() * 60)) : undefined,
        closedAt,
        source: pick(["Web", "Doporučení", "Veletrh", "Kampaň"]),
        lossReason: status === "lost" ? pick(["Cena", "Zvolili konkurenci", "Odloženo", "Bez odpovědi"]) : undefined,
        competitor: status === "lost" && Math.random() > 0.5 ? pick(["Salesforce", "HubSpot", "Pipedrive", "Interní řešení"]) : undefined,
        nextStep: status === "open" ? pick(["Zaslat nabídku", "Naplánovat demo", "Follow-up telefonát", "Podepsat smlouvu"]) : undefined,
        nextStepDate: status === "open" ? daysFromNow(Math.floor(Math.random() * 14)) : undefined,
      },
    });

    if (primaryContactId) {
      await prisma.dealContact.create({ data: { dealId: deal.id, contactId: primaryContactId, role: "Rozhodovatel" } });
    }

    const numProducts = 1 + Math.floor(Math.random() * 3);
    let dealTotal = 0;
    const chosenProducts = [];
    for (let p = 0; p < numProducts; p++) {
      const product = pick(products);
      const quantity = product.isRecurring ? 1 : 1 + Math.floor(Math.random() * 3);
      const unitPrice = product.price;
      const total = quantity * unitPrice;
      dealTotal += total;
      chosenProducts.push({ product, quantity, unitPrice, total });
      await prisma.dealProduct.create({
        data: { dealId: deal.id, productId: product.id, name: product.name, quantity, unitPrice, total },
      });
    }

    if (stage.name === "Nabídka" || stage.name === "Jednání" || status === "won") {
      const subtotal = dealTotal;
      const vatTotal = subtotal * 0.21;
      const total = subtotal + vatTotal;
      const number = `NAB-2026-${String(quoteCounter).padStart(4, "0")}`;
      quoteCounter++;
      const quote = await prisma.quote.create({
        data: {
          tenantId: tenant.id,
          number,
          dealId: deal.id,
          companyId: company.id,
          contactId: primaryContactId,
          status: status === "won" ? "accepted" : pick(["draft", "pending_approval", "approved", "sent"]),
          validUntil: daysFromNow(30),
          subtotal,
          vatTotal,
          total,
          terms: "Splatnost faktury 14 dní od data vystavení. Nabídka platná 30 dní.",
          ownerId: owner.id,
        },
      });
      for (const cp of chosenProducts) {
        await prisma.quoteItem.create({
          data: {
            quoteId: quote.id,
            productId: cp.product.id,
            name: cp.product.name,
            quantity: cp.quantity,
            unitPrice: cp.unitPrice,
            total: cp.total,
          },
        });
      }
    }

    // activities per deal
    const numActivities = 1 + Math.floor(Math.random() * 4);
    for (let a = 0; a < numActivities; a++) {
      const type = pick(["call", "email", "meeting", "note"] as const);
      await prisma.activity.create({
        data: {
          tenantId: tenant.id,
          type,
          subject:
            type === "call" ? "Telefonát ohledně nabídky" :
            type === "email" ? "E-mail s podklady" :
            type === "meeting" ? "Obchodní schůzka" : "Interní poznámka k obchodu",
          description: "Detail proběhlé komunikace se zákazníkem k aktuálnímu obchodnímu případu.",
          subjectType: "deal",
          subjectId: deal.id,
          ownerId: owner.id,
          direction: type === "call" || type === "email" ? pick(["inbound", "outbound"]) : undefined,
          durationMinutes: type === "call" || type === "meeting" ? 10 + Math.floor(Math.random() * 50) : undefined,
          activityAt: daysAgo(Math.floor(Math.random() * 45)),
        },
      });
    }
  }

  // ---- Standalone company/contact activities -------------------------------------
  for (let i = 0; i < 15; i++) {
    const company = pick(allCompanies);
    await prisma.activity.create({
      data: {
        tenantId: tenant.id,
        type: pick(["call", "email", "meeting", "note", "presentation"] as const),
        subject: "Pravidelný kontakt se zákazníkem",
        subjectType: "company",
        subjectId: company.id,
        ownerId: company.ownerId,
        activityAt: daysAgo(Math.floor(Math.random() * 90)),
      },
    });
  }

  // ---- Tasks --------------------------------------------------------------
  const taskTitles = [
    "Zaslat cenovou nabídku", "Připravit prezentaci pro klienta", "Follow-up po demu", "Zavolat a domluvit schůzku",
    "Zkontrolovat podepsanou smlouvu", "Připravit podklady pro fakturaci", "Aktualizovat kartu zákazníka",
    "Naplánovat onboarding call", "Zjistit stav rozhodování u klienta", "Odeslat marketingové materiály",
    "Vyřešit reklamaci", "Připravit QBR prezentaci", "Ověřit fakturační údaje", "Domluvit obnovu smlouvy",
    "Zaslat děkovný e-mail po podpisu",
  ];
  for (const title of taskTitles) {
    const assignee = pick([sales1, sales2, marketingUser, supportUser, salesManager]);
    const dueOffset = Math.floor(Math.random() * 30) - 10; // some overdue, some future
    const status = dueOffset < -3 ? pick(["open", "in_progress", "done"]) : pick(["open", "in_progress"]);
    const company = pick(allCompanies);
    const task = await prisma.task.create({
      data: {
        tenantId: tenant.id,
        title,
        description: `Úkol vztažený ke klientovi ${company.name}.`,
        assigneeId: assignee.id,
        creatorId: pick([director, salesManager]).id,
        dueDate: daysFromNow(dueOffset),
        priority: pick(["low", "medium", "high", "urgent"]),
        status,
        subjectType: "company",
        subjectId: company.id,
        completedAt: status === "done" ? daysAgo(1) : undefined,
      },
    });
    if (Math.random() > 0.5) {
      await prisma.taskChecklistItem.createMany({
        data: [
          { taskId: task.id, label: "Ověřit kontaktní údaje", isDone: true, order: 1 },
          { taskId: task.id, label: "Připravit podklady", isDone: status === "done", order: 2 },
          { taskId: task.id, label: "Odeslat klientovi", isDone: status === "done", order: 3 },
        ],
      });
    }
  }

  // ---- Saved view example ---------------------------------------------------------
  await prisma.savedView.create({
    data: {
      tenantId: tenant.id,
      userId: sales1.id,
      entityType: "company",
      name: "Moji zákazníci",
      filters: JSON.stringify({ ownerId: sales1.id, status: "active" }),
      isDefault: true,
    },
  });

  // ---- Workflow rule example (engine skeleton, config only) -----------------------
  await prisma.workflowRule.create({
    data: {
      tenantId: tenant.id,
      name: "Automatický úkol při přesunu do fáze Nabídka",
      description: "Když obchodní případ přejde do fáze 'Nabídka', vytvoří se obchodníkovi úkol na přípravu nabídky.",
      entityType: "deal",
      triggerType: "on_status_change",
      triggerConfig: JSON.stringify({ field: "stage", to: "Nabídka" }),
      actions: JSON.stringify([{ type: "create_task", title: "Připravit a odeslat nabídku", dueInDays: 2 }]),
      createdById: admin.id,
    },
  });

  // ---- Number sequence --------------------------------------------------------------
  await prisma.numberSequence.create({
    data: { tenantId: tenant.id, code: "quote", prefix: "NAB-2026-", nextNumber: quoteCounter },
  });

  // ---- Roadmap: ideas, planned work and updates for the platform itself -----------
  const moduleByCode = new Map(modules.map((m) => [m.code, m.id]));
  async function createRoadmapItem(data: {
    title: string; description?: string; type?: string; status?: string; priority?: string;
    effort?: string; votes?: number; targetQuarter?: string; moduleCode?: string;
    owner: typeof admin; parentId?: string;
  }) {
    return prisma.roadmapItem.create({
      data: {
        tenantId: tenant.id,
        title: data.title,
        description: data.description,
        type: data.type ?? "feature",
        status: data.status ?? "backlog",
        priority: data.priority ?? "medium",
        effort: data.effort,
        votes: data.votes ?? 0,
        targetQuarter: data.targetQuarter,
        moduleId: data.moduleCode ? moduleByCode.get(data.moduleCode) : undefined,
        ownerId: data.owner.id,
        createdById: admin.id,
        parentId: data.parentId,
      },
    });
  }

  const epicInvoices = await createRoadmapItem({
    title: "Modul Faktury", type: "update", status: "planned", priority: "high", effort: "xl",
    votes: 12, targetQuarter: "Q1 2027", moduleCode: "invoices", owner: director,
    description: "Vystavování a evidence faktur navázaná na obchodní případy a firmy z CRM.",
  });
  await createRoadmapItem({ title: "Datový model faktur a číselné řady", type: "feature", status: "done", priority: "high", effort: "m", moduleCode: "invoices", owner: admin, parentId: epicInvoices.id });
  await createRoadmapItem({ title: "Generování PDF faktury ze šablony", type: "feature", status: "in_progress", priority: "high", effort: "m", votes: 8, moduleCode: "invoices", owner: admin, parentId: epicInvoices.id });
  await createRoadmapItem({ title: "Export do ISDOC pro účetní systémy", type: "feature", status: "considering", priority: "medium", effort: "l", votes: 5, moduleCode: "invoices", owner: director, parentId: epicInvoices.id });
  await createRoadmapItem({ title: "Párování plateb a upomínky po splatnosti", type: "idea", status: "backlog", priority: "medium", effort: "l", moduleCode: "invoices", owner: financeUser, parentId: epicInvoices.id });

  const epicProjects = await createRoadmapItem({
    title: "Modul Projekty", type: "update", status: "considering", priority: "medium", effort: "xl",
    votes: 9, targetQuarter: "Q2 2027", moduleCode: "projects", owner: director,
    description: "Řízení interních i zákaznických projektů navázaných na obchodní případy.",
  });
  await createRoadmapItem({ title: "Kanban a Ganttův diagram projektu", type: "feature", status: "backlog", priority: "medium", effort: "l", moduleCode: "projects", owner: salesManager, parentId: epicProjects.id });
  await createRoadmapItem({ title: "Evidence odpracovaných hodin (timesheet)", type: "idea", status: "backlog", priority: "low", effort: "m", moduleCode: "projects", owner: salesManager, parentId: epicProjects.id });

  const epicHelpdesk = await createRoadmapItem({
    title: "Modul HelpDesk", type: "update", status: "backlog", priority: "medium", effort: "xl",
    votes: 6, targetQuarter: "Q3 2027", moduleCode: "helpdesk", owner: supportUser,
    description: "Ticketing systém pro zákaznickou podporu se SLA a znalostní bází.",
  });
  await createRoadmapItem({ title: "Ticketing se SLA pravidly", type: "feature", status: "backlog", priority: "medium", effort: "l", moduleCode: "helpdesk", owner: supportUser, parentId: epicHelpdesk.id });
  await createRoadmapItem({ title: "Zákaznický portál pro sledování ticketů", type: "idea", status: "backlog", priority: "low", effort: "l", moduleCode: "helpdesk", owner: supportUser, parentId: epicHelpdesk.id });

  const epicCrm = await createRoadmapItem({
    title: "Vylepšení CRM modulu", type: "improvement", status: "in_progress", priority: "high", effort: "xl",
    votes: 15, targetQuarter: "Q4 2026", moduleCode: "crm", owner: admin,
    description: "Doladění stávajícího CRM modulu na základě zpětné vazby z ostrého provozu.",
  });
  await createRoadmapItem({ title: "PDF export cenových nabídek", type: "feature", status: "in_progress", priority: "high", effort: "s", votes: 11, targetQuarter: "Q4 2026", moduleCode: "crm", owner: admin, parentId: epicCrm.id });
  await createRoadmapItem({ title: "Vizuální builder automatizací (drag & drop)", type: "feature", status: "planned", priority: "high", effort: "l", votes: 9, targetQuarter: "Q1 2027", moduleCode: "crm", owner: admin, parentId: epicCrm.id });
  await createRoadmapItem({ title: "E-mailová schránka (IMAP/SMTP) napojená na kontakty", type: "feature", status: "considering", priority: "high", effort: "l", votes: 14, moduleCode: "crm", owner: marketingUser, parentId: epicCrm.id });
  await createRoadmapItem({ title: "Mobilní aplikace pro obchodníky", type: "idea", status: "backlog", priority: "medium", effort: "xl", votes: 7, moduleCode: "crm", owner: sales1, parentId: epicCrm.id });

  // Standalone, cross-cutting platform ideas (no module / epic yet)
  await createRoadmapItem({ title: "Tmavý režim (dark mode)", type: "idea", status: "backlog", priority: "low", effort: "s", votes: 4, owner: sales2 });
  await createRoadmapItem({ title: "Import dat z Excelu / CSV", type: "feature", status: "planned", priority: "high", effort: "m", votes: 10, targetQuarter: "Q4 2026", owner: admin });
  await createRoadmapItem({ title: "Dvoufaktorové ověření (2FA)", type: "feature", status: "considering", priority: "high", effort: "m", votes: 6, owner: admin, description: "Bezpečnostní požadavek pro přístup administrátorů." });
  await createRoadmapItem({ title: "Veřejné REST API a webhooky", type: "feature", status: "backlog", priority: "medium", effort: "l", votes: 5, owner: admin });
  await createRoadmapItem({ title: "E-mailové notifikace o úkolech po termínu", type: "feature", status: "testing", priority: "high", effort: "s", votes: 8, targetQuarter: "Q4 2026", owner: admin });
  await createRoadmapItem({ title: "Vlastní report builder (drag & drop grafy)", type: "idea", status: "backlog", priority: "medium", effort: "l", votes: 3, owner: director });
  await createRoadmapItem({ title: "Duplicitní firmy při importu", type: "bug", status: "planned", priority: "critical", effort: "s", votes: 2, targetQuarter: "Q4 2026", moduleCode: "crm", owner: admin, description: "Import bez kontroly duplicit podle IČO může vytvořit dvě karty stejné firmy." });
  await createRoadmapItem({ title: "Nesprávné zaokrouhlení DPH na položkách nabídky", type: "bug", status: "done", priority: "high", effort: "s", moduleCode: "crm", owner: admin });

  console.log("Hotovo. Demo tenant:", tenant.slug);
  console.log("Přihlašovací údaje (heslo pro všechny: demo1234):");
  demoUsers.forEach((u) => console.log(`  ${u.email}  ->  ${u.role}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
