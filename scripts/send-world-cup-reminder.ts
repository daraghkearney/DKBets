/**
 * One-shot Premier League season reminder to all Clerk users.
 *
 * Idempotent: tracks recipients in data/email-campaigns/pl-season-reminder-2026.json
 * so re-runs skip anyone already emailed.
 *
 *   CLERK_SECRET_KEY=... RESEND_API_KEY=... REMINDER_FROM_EMAIL="Statmanac <updates@statmanac.com>" npm run remind:world-cup
 */
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const CAMPAIGN_ID = "pl-season-reminder-2026";
const MARKER_PATH = path.join(
  process.cwd(),
  "data/email-campaigns",
  `${CAMPAIGN_ID}.json`
);
const DEFAULT_FREE_UNTIL = "2026-07-20T23:59:59Z";

interface ClerkEmail {
  email_address: string;
}

interface ClerkUser {
  id: string;
  first_name?: string | null;
  email_addresses?: ClerkEmail[];
}

interface CampaignMarker {
  campaignId: string;
  status: "in_progress" | "complete";
  sentAt?: string;
  completedAt?: string;
  sentEmails: string[];
  sentCount: number;
  failedCount: number;
}

async function loadMarker(): Promise<CampaignMarker> {
  try {
    const raw = await readFile(MARKER_PATH, "utf8");
    const parsed = JSON.parse(raw) as CampaignMarker;
    return {
      campaignId: CAMPAIGN_ID,
      status: parsed.status === "complete" ? "complete" : "in_progress",
      sentAt: parsed.sentAt,
      completedAt: parsed.completedAt,
      sentEmails: Array.isArray(parsed.sentEmails) ? parsed.sentEmails : [],
      sentCount: parsed.sentCount ?? 0,
      failedCount: parsed.failedCount ?? 0,
    };
  } catch {
    return {
      campaignId: CAMPAIGN_ID,
      status: "in_progress",
      sentEmails: [],
      sentCount: 0,
      failedCount: 0,
    };
  }
}

async function saveMarker(marker: CampaignMarker): Promise<void> {
  await mkdir(path.dirname(MARKER_PATH), { recursive: true });
  await writeFile(MARKER_PATH, `${JSON.stringify(marker, null, 2)}\n`, "utf8");
}

function freeEndsAt(): Date {
  const raw =
    process.env.NEXT_PUBLIC_WORLD_CUP_FREE_UNTIL?.trim() || DEFAULT_FREE_UNTIL;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid end date: ${raw}`);
  return d;
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
      subject: "Premier League is a few weeks away — keep your Statmanac edge",
      html: `
        <p>${greeting}</p>
        <p>With the <strong>Premier League</strong> season just a few weeks away, Statmanac is ready for it.</p>
        <p>Your free World Cup access ends on <strong>${endLabel}</strong>. After that, football Pro (Bet365 builders, underpriced gems, star players, matchups and stats) moves to paid plans — with a <strong>7-day free trial</strong> on All-Access Pro.</p>
        <p><strong>All-Access</strong> also unlocks horse racing (value naps, model scores, tipster intel) and NBA props — so one plan covers every sport on Statmanac.</p>
        <p>Lock in access now so you’re set for opening weekend: the same toolkit that covered the World Cup, now pointed at every EPL fixture.</p>
        <p><a href="https://statmanac.com/football/premier-league/">Explore the Premier League hub →</a></p>
        <p><a href="https://statmanac.com/subscribe/">View plans &amp; start your trial →</a></p>
        <p>See you for the new season.</p>
        <p style="color:#666;font-size:13px">If you’ve already purchased a subscription, you can safely ignore this email — you’re all set.</p>
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
  const testTo = process.env.REMINDER_TEST_TO?.trim();

  if (!resendKey) {
    console.error("Missing RESEND_API_KEY");
    process.exit(1);
  }
  if (!from) {
    console.error(
      "Missing REMINDER_FROM_EMAIL (e.g. Statmanac <updates@statmanac.com>)"
    );
    process.exit(1);
  }

  // One-off proofread send — does not touch the campaign marker.
  if (testTo) {
    console.log(`Sending test email to ${testTo} (campaign not updated)…`);
    await sendReminder(resendKey, from, testTo, null, freeEndsAt());
    console.log("Test sent. Check that inbox (and spam).");
    return;
  }

  if (!clerkSecret) {
    console.error("Missing CLERK_SECRET_KEY");
    process.exit(1);
  }

  const marker = await loadMarker();
  if (marker.status === "complete") {
    console.log(
      `Campaign ${CAMPAIGN_ID} already complete (${marker.sentCount} sent at ${marker.completedAt}). Skipping.`
    );
    return;
  }

  const alreadySent = new Set(
    marker.sentEmails.map((e) => e.trim().toLowerCase())
  );
  const ends = freeEndsAt();
  const users = await listClerkUsers(clerkSecret);
  const emails = [
    ...new Set(
      users
        .flatMap((u) => (u.email_addresses ?? []).map((e) => e.email_address))
        .filter(Boolean)
    ),
  ];

  const pending = emails.filter(
    (e) => !alreadySent.has(e.trim().toLowerCase())
  );

  if (!emails.length) {
    console.log("No user emails to notify");
    return;
  }

  if (!pending.length) {
    marker.status = "complete";
    marker.completedAt = new Date().toISOString();
    marker.sentCount = marker.sentEmails.length;
    await saveMarker(marker);
    console.log(
      `All ${emails.length} user(s) already emailed for ${CAMPAIGN_ID}. Marked complete.`
    );
    return;
  }

  console.log(
    `Campaign ${CAMPAIGN_ID}: sending to ${pending.length} user(s) (${alreadySent.size} already sent)…`
  );

  if (!marker.sentAt) marker.sentAt = new Date().toISOString();
  let sent = 0;
  let failed = 0;

  for (const email of pending) {
    const user = users.find((u) =>
      u.email_addresses?.some((e) => e.email_address === email)
    );
    try {
      await sendReminder(resendKey, from, email, user?.first_name, ends);
      sent += 1;
      marker.sentEmails.push(email);
      marker.sentCount = marker.sentEmails.length;
      alreadySent.add(email.trim().toLowerCase());
      await saveMarker(marker);
      console.log(`  sent ${email}`);
      await new Promise((r) => setTimeout(r, 200));
    } catch (e) {
      failed += 1;
      marker.failedCount = (marker.failedCount ?? 0) + 1;
      await saveMarker(marker);
      console.warn(`  failed ${email}:`, e);
    }
  }

  const remaining = emails.filter(
    (e) => !alreadySent.has(e.trim().toLowerCase())
  );
  if (remaining.length === 0) {
    marker.status = "complete";
    marker.completedAt = new Date().toISOString();
    await saveMarker(marker);
  }

  console.log(
    `Done — ${sent} sent this run, ${failed} failed, ${marker.sentEmails.length} total for campaign` +
      (marker.status === "complete"
        ? " (complete)"
        : " (incomplete — re-run to finish)")
  );
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
