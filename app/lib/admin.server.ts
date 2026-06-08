import prisma from "./prisma.server";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "leveris.sigitas@gmail.com,northwardsystems@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase());

/** Returns true if the current session email is in the admin list. */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

/** Read a global app setting (key-value). Returns null if not set. */
export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

/** Write (upsert) a global app setting. */
export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

/** Delete a global app setting. */
export async function deleteSetting(key: string): Promise<void> {
  await prisma.appSetting.deleteMany({ where: { key } });
}

/** Check if promotion mode is currently active. */
export async function isPromotionActive(): Promise<boolean> {
  const active = await getSetting("promotion_active");
  if (active !== "true") return false;

  const endsAt = await getSetting("promotion_ends_at");
  if (!endsAt) return true; // No end date = indefinite

  return new Date(endsAt) > new Date();
}

/** Enable promotion mode. Pass `endsAt` as an ISO date string or null for indefinite. */
export async function enablePromotion(endsAt?: string | null): Promise<void> {
  await setSetting("promotion_active", "true");
  if (endsAt) {
    await setSetting("promotion_ends_at", endsAt);
  } else {
    await deleteSetting("promotion_ends_at");
  }
}

/** Disable promotion mode immediately. */
export async function disablePromotion(): Promise<void> {
  await setSetting("promotion_active", "false");
}
