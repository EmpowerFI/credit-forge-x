// Creates the demo accounts judges log in with, and the demo partner.
// Idempotent: re-running updates roles and names, creates nothing twice.
//
//   PLATFORM_SERVICE_KEY_FILE=<file holding the service role key> \
//     npx tsx scripts/platform/seed-demo-accounts.mts
//
// The key is read from a file so it never appears on a command line. Roles are
// set here, with the service role, because no user can set her own.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const URL = process.env.PLATFORM_SUPABASE_URL ?? "https://yuxrujoghizcfdmbkqfg.supabase.co";
const keyFile = process.env.PLATFORM_SERVICE_KEY_FILE;
if (!keyFile) throw new Error("set PLATFORM_SERVICE_KEY_FILE");

// Public on purpose: listed in the README so judges can log in. Demo project
// only — nothing here reaches a real person or real money.
export const DEMO_PASSWORD = "EmpowerFI-demo-2026";

const db = createClient(URL, readFileSync(keyFile, "utf8").trim(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

// EmpowerFI's own P2P desk (founder decision D1, 16 Sep): it formalises what
// investors fund, at the allocation engine's rate, and services the loans.
// The database calls it a partner; it was the demo's credit union before.
const PARTNER = {
  name: "EmpowerFI P2P desk",
  kind: "other" as const,
  min_ticket_cents: 10_000,
  max_ticket_cents: 5_000_000,
  accepted_purposes: [] as string[],
  decision_method: "rules" as const,
  is_simulated: true,
};
const FORMER_PARTNER_NAME = "Cooperativa Horizonte (demo)";

type Role = "entrepreneur" | "community_leader" | "partner" | "capital_provider" | "auditor" | "admin";

const ACCOUNTS: { email: string; name: string; role: Role }[] = [
  { email: "admin@demo.empowerfi.io", name: "Ana Reis (EmpowerFI)", role: "admin" },
  { email: "leader@demo.empowerfi.io", name: "Lúcia Santos", role: "community_leader" },
  { email: "maria@demo.empowerfi.io", name: "Maria Oliveira", role: "entrepreneur" },
  { email: "partner@demo.empowerfi.io", name: "Paulo Mendes", role: "partner" },
  { email: "investor@demo.empowerfi.io", name: "Irene Costa", role: "capital_provider" },
  { email: "auditor@demo.empowerfi.io", name: "Otávio Lima", role: "auditor" },
];

async function must<T>(label: string, p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

// The desk every partner-user acts for, renamed in place if it was the credit union.
const existingPartner = await must(
  "find partner",
  db.from("partners").select("id").in("name", [PARTNER.name, FORMER_PARTNER_NAME]).order("created_at").limit(1).maybeSingle(),
);
const partnerId = (existingPartner as { id: string } | null)?.id
  ? (await must("update partner", db.from("partners").update(PARTNER).eq("id", (existingPartner as { id: string }).id).select("id").single())).id
  : (await must("create partner", db.from("partners").insert(PARTNER).select("id").single())).id;
// Opportunities are matched to the first active partner: only the desk is.
await must("one desk", db.from("partners").update({ active: false }).neq("id", partnerId));

const { data: list, error: listError } = await db.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;

for (const account of ACCOUNTS) {
  let user = list.users.find((u) => u.email === account.email);
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({
      email: account.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: account.name },
    });
    if (error) throw new Error(`create ${account.email}: ${error.message}`);
    user = data.user;
  } else {
    await must(`reset password ${account.email}`, db.auth.admin.updateUserById(user.id, { password: DEMO_PASSWORD }));
  }

  await must(
    `profile ${account.email}`,
    db
      .from("profiles")
      .update({
        role: account.role,
        display_name: account.name,
        partner_id: account.role === "partner" ? partnerId : null,
      })
      .eq("id", user.id),
  );

  // Maria is the entrepreneur the demo follows; she needs her own record.
  if (account.role === "entrepreneur") {
    await must(
      `entrepreneur ${account.email}`,
      db.from("entrepreneurs").upsert(
        {
          profile_id: user.id,
          display_name: account.name,
          business_name: "Doces da Maria",
          business_sector: "food",
          city: "São Paulo",
          state: "SP",
          is_simulated: true,
        },
        { onConflict: "profile_id" },
      ),
    );
  }

  console.log(`${account.role.padEnd(16)} ${account.email}`);
}

console.log(`\npartner: ${PARTNER.name} (${partnerId})`);
console.log(`password for all accounts: ${DEMO_PASSWORD}`);
