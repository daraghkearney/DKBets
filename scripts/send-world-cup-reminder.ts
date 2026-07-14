/**
 * Send "World Cup free ending soon" emails to all Clerk users.
 *
 * Run via GitHub Actions on a schedule, or locally:
 *   CLERK_SECRET_KEY=... RESEND_API_KEY=... REMINDER_FROM_EMAIL="Statmanac <noreply@statmanac.com>" npm run remind:world-cup
 */
const DEFAULT_FREE_UNTIL = "2026-07-20T23:59:59Z";
const REMINDER_HOURS_BEFORE = Number(process.env.REMINDER_HOURS_BEFORE ?? "48");

interface ClerkEmail {
  email_address: string;
}

interface ClerkUser {
  id: string;
  first_name?: string | null;
  email_addresses?: ClerkEmail[];
}

function freeEndsAt(): Date {
  const raw = process.env.NEXT_PUBLIC_WORLD_CUP_FREE_UNTIL?.trim() || DEFAULT_FREE_UNTIL;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid end date: ${raw}`);
  return d;
}

function inReminderWindow(ends: Date): boolean {
  const msUntil = ends.getTime() - Date.now();
  const hoursUntil = msUntil / (1000 * 60 * 60);
  return hoursUntil > 0 && hoursUntil <= REMINDER_HOURS_BEFORE;
}

async function listClerkUsers(secret: string): Promise<ClerkUser[]> {
  const users: ClerkUser[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const res = await fetch(
      `https://api.clerk.com/v1/users?limit=${limit}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${secret}` } }
    );
    if (!res.ok) {
      throw new Error(`Clerk users API ${res.status}: ${await res.text()}`);
    }
    const batch = (await res.json()) as ClerkUser[];
    users.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  return users;
}

async function sendReminder(
  apiKey: string,
  from: string,
  to: string,
  name: string | null | undefined,
  ends: Date
): Promise<void> {
  const endLabel = ends.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  const greeting = name?.trim() ? `Hi ${name.trim()},` : "Hi,";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Your free World Cup access ends soon — Statmanac",
      html: `
        <p>${greeting}</p>
        <p>Your free <strong>Statmanac</strong> World Cup access ends on <strong>${endLabel}</strong>.</p>
        <p>After that, football Pro features (Bet365 builders, star players, matchups and stats) move to paid plans — with a 7-day free trial on All-Access Pro.</p>
        <p><a href="https://statmanac.com/subscribe/">View plans and keep access →</a></p>
        <p>Thanks for trying Statmanac — good luck for the semis and final.</p>
        <p style="color:#888;font-size:12px">Statmanac · 18+ · Gamble responsibly</p>
      `,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend ${res.status} for ${to}: ${await res.text()}`);
  }
}

async function main() {
  const clerkSecret = process.env.CLERK_SECRET_KEY?.trim();
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.REMINDER_FROM_EMAIL?.trim();

  if (!clerkSecret) {
    console.error("Missing CLERK_SECRET_KEY");
    process.exit(1);
  }
  if (!resendKey) {
    console.error("Missing RESEND_API_KEY");
    process.exit(1);
  }
  if (!from) {
    console.error("Missing REMINDER_FROM_EMAIL (e.g. Statmanac <noreply@statmanac.com>)");
    process.exit(1);
  }

  const ends = freeEndsAt();
  if (!inReminderWindow(ends)) {
    const hoursUntil = (ends.getTime() - Date.now()) / (1000 * 60 * 60);
    console.log(
      `Not in reminder window (${hoursUntil.toFixed(1)}h until end; sends within ${REMINDER_HOURS_BEFORE}h)`
    );
    return;
  }

  const users = await listClerkUsers(clerkSecret);
  const emails = [
    ...new Set(
      users
        .flatMap((u) => (u.email_addresses ?? []).map((e) => e.email_address))
        .filter(Boolean)
    ),
  ];

  if (!emails.length) {
    console.log("No user emails to notify");
    return;
  }

  console.log(`Sending World Cup reminder to ${emails.length} user(s)…`);
  let sent = 0;
  let failed = 0;

  for (const email of emails) {
    const user = users.find((u) =>
      u.email_addresses?.some((e) => e.email_address === email)
    );
    try {
      await sendReminder(resendKey, from, email, user?.first_name, ends);
      sent += 1;
      console.log(`  sent ${email}`);
      await new Promise((r) => setTimeout(r, 200));
    } catch (e) {
      failed += 1;
      console.warn(`  failed ${email}:`, e);
    }
  }

  console.log(`Done — ${sent} sent, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
