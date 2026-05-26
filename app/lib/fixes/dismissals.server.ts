import { randomUUID } from "node:crypto";

import prisma from "../prisma.server";

import type { FixId } from "./types";

import { FIX_RULE_CODES } from "./types";



type FixDismissalDelegate = {

  findMany: (args: {

    where: { storeId: string };

    select: { fixId: true };

  }) => Promise<Array<{ fixId: string }>>;

  upsert: (args: {

    where: { storeId_fixId: { storeId: string; fixId: string } };

    create: { storeId: string; fixId: string };

    update: { dismissedAt: Date };

  }) => Promise<unknown>;

  deleteMany: (args: {

    where: { storeId: string; fixId?: string };

  }) => Promise<unknown>;

};



type RuleDismissalDelegate = {

  findMany: (args: {

    where: { storeId: string };

    select: { ruleCode: true };

  }) => Promise<Array<{ ruleCode: string }>>;

  upsert: (args: {

    where: { storeId_ruleCode: { storeId: string; ruleCode: string } };

    create: { storeId: string; ruleCode: string };

    update: { dismissedAt: Date };

  }) => Promise<unknown>;

  deleteMany: (args: {

    where: { storeId: string; ruleCode?: string };

  }) => Promise<unknown>;

};



function fixDismissalDelegate(): FixDismissalDelegate | null {

  const delegate = (prisma as unknown as { fixDismissal?: FixDismissalDelegate })
    .fixDismissal;

  return delegate?.findMany ? delegate : null;

}



function ruleDismissalDelegate(): RuleDismissalDelegate | null {

  const delegate = (prisma as unknown as { ruleDismissal?: RuleDismissalDelegate })
    .ruleDismissal;

  return delegate?.findMany ? delegate : null;

}



async function readDismissedFixIds(storeId: string): Promise<FixId[]> {

  const delegate = fixDismissalDelegate();

  if (delegate) {

    const rows = await delegate.findMany({

      where: { storeId },

      select: { fixId: true },

    });

    return rows.map((row) => row.fixId as FixId);

  }



  const rows = await prisma.$queryRaw<Array<{ fixId: string }>>`

    SELECT "fixId" FROM "FixDismissal" WHERE "storeId" = ${storeId}

  `;

  return rows.map((row) => row.fixId as FixId);

}



async function readDismissedRuleCodesFromDb(storeId: string): Promise<string[]> {

  const delegate = ruleDismissalDelegate();

  if (delegate) {

    const rows = await delegate.findMany({

      where: { storeId },

      select: { ruleCode: true },

    });

    return rows.map((row) => row.ruleCode);

  }



  try {

    const rows = await prisma.$queryRaw<Array<{ ruleCode: string }>>`

      SELECT "ruleCode" FROM "RuleDismissal" WHERE "storeId" = ${storeId}

    `;

    return rows.map((row) => row.ruleCode);

  } catch {

    return [];

  }

}



function ruleCodesFromFixIds(fixIds: Iterable<FixId>): Set<string> {

  const ruleCodes = new Set<string>();

  for (const fixId of fixIds) {

    for (const ruleCode of FIX_RULE_CODES[fixId] ?? []) {

      ruleCodes.add(ruleCode);

    }

  }

  return ruleCodes;

}



export async function getDismissedFixIds(storeId: string): Promise<Set<FixId>> {

  return new Set(await readDismissedFixIds(storeId));

}



export async function getDismissedRuleCodes(storeId: string): Promise<Set<string>> {

  const ruleCodes = new Set(await readDismissedRuleCodesFromDb(storeId));

  for (const code of ruleCodesFromFixIds(await readDismissedFixIds(storeId))) {

    ruleCodes.add(code);

  }

  return ruleCodes;

}



async function upsertRuleDismissal(storeId: string, ruleCode: string): Promise<void> {

  const delegate = ruleDismissalDelegate();

  if (delegate) {

    await delegate.upsert({

      where: { storeId_ruleCode: { storeId, ruleCode } },

      create: { storeId, ruleCode },

      update: { dismissedAt: new Date() },

    });

    return;

  }



  await prisma.$executeRaw`

    INSERT INTO "RuleDismissal" ("id", "storeId", "ruleCode", "dismissedAt")

    VALUES (${randomUUID()}, ${storeId}, ${ruleCode}, NOW())

    ON CONFLICT ("storeId", "ruleCode")

    DO UPDATE SET "dismissedAt" = NOW()

  `;

}



async function deleteRuleDismissal(storeId: string, ruleCode: string): Promise<void> {

  const delegate = ruleDismissalDelegate();

  if (delegate) {

    await delegate.deleteMany({ where: { storeId, ruleCode } });

    return;

  }



  await prisma.$executeRaw`

    DELETE FROM "RuleDismissal" WHERE "storeId" = ${storeId} AND "ruleCode" = ${ruleCode}

  `;

}



export async function dismissRuleCode(storeId: string, ruleCode: string): Promise<void> {

  await upsertRuleDismissal(storeId, ruleCode);

}



export async function dismissRuleCodes(

  storeId: string,

  ruleCodes: Iterable<string>,

): Promise<void> {

  for (const ruleCode of new Set(ruleCodes)) {

    await upsertRuleDismissal(storeId, ruleCode);

  }

}



export async function dismissFix(storeId: string, fixId: FixId): Promise<void> {

  if (!(fixId in FIX_RULE_CODES)) {

    throw new Error("Unknown fix type.");

  }



  await dismissRuleCodes(storeId, FIX_RULE_CODES[fixId]);



  const delegate = fixDismissalDelegate();

  if (delegate) {

    await delegate.upsert({

      where: { storeId_fixId: { storeId, fixId } },

      create: { storeId, fixId },

      update: { dismissedAt: new Date() },

    });

    return;

  }



  await prisma.$executeRaw`

    INSERT INTO "FixDismissal" ("id", "storeId", "fixId", "dismissedAt")

    VALUES (${randomUUID()}, ${storeId}, ${fixId}, NOW())

    ON CONFLICT ("storeId", "fixId")

    DO UPDATE SET "dismissedAt" = NOW()

  `;

}



async function deleteFixDismissal(storeId: string, fixId: FixId): Promise<void> {

  const delegate = fixDismissalDelegate();

  if (delegate) {

    await delegate.deleteMany({ where: { storeId, fixId } });

    return;

  }



  await prisma.$executeRaw`

    DELETE FROM "FixDismissal" WHERE "storeId" = ${storeId} AND "fixId" = ${fixId}

  `;

}



export async function restoreRuleCode(storeId: string, ruleCode: string): Promise<void> {

  await deleteRuleDismissal(storeId, ruleCode);



  for (const fixId of await readDismissedFixIds(storeId)) {

    if ((FIX_RULE_CODES[fixId] ?? []).includes(ruleCode)) {

      await deleteFixDismissal(storeId, fixId);

    }

  }

}



export async function restoreFix(storeId: string, fixId: FixId): Promise<void> {

  if (!(fixId in FIX_RULE_CODES)) {

    throw new Error("Unknown fix type.");

  }



  for (const ruleCode of FIX_RULE_CODES[fixId]) {

    await deleteRuleDismissal(storeId, ruleCode);

  }



  await deleteFixDismissal(storeId, fixId);

}



export async function restoreAllDismissals(storeId: string): Promise<void> {

  const ruleDelegate = ruleDismissalDelegate();

  const fixDelegate = fixDismissalDelegate();



  if (ruleDelegate) {

    await ruleDelegate.deleteMany({ where: { storeId } });

  } else {

    await prisma.$executeRaw`DELETE FROM "RuleDismissal" WHERE "storeId" = ${storeId}`;

  }



  if (fixDelegate) {

    await fixDelegate.deleteMany({ where: { storeId } });

  } else {

    await prisma.$executeRaw`DELETE FROM "FixDismissal" WHERE "storeId" = ${storeId}`;

  }

}



export async function dismissAllFindings(

  storeId: string,

  ruleCodes: Iterable<string>,

  fixIds: Iterable<FixId> = [],

): Promise<void> {

  await dismissRuleCodes(storeId, ruleCodes);

  for (const fixId of new Set(fixIds)) {

    if (fixId in FIX_RULE_CODES) {

      await dismissFix(storeId, fixId);

    }

  }

}



export function filterFindingsByDismissals<T extends { ruleCode: string }>(

  findings: ReadonlyArray<T>,

  dismissedRuleCodes: ReadonlySet<string>,

): T[] {

  if (dismissedRuleCodes.size === 0) return [...findings];

  return findings.filter((finding) => !dismissedRuleCodes.has(finding.ruleCode));

}



export type DismissedFindingSummary = {

  ruleCode: string;

  title: string;

  severity: string;

};



export function summarizeDismissedFindings<

  T extends { ruleCode: string; title: string; severity: string },

>(findings: ReadonlyArray<T>, dismissedRuleCodes: ReadonlySet<string>): DismissedFindingSummary[] {

  const seen = new Set<string>();

  const summaries: DismissedFindingSummary[] = [];



  for (const finding of findings) {

    if (!dismissedRuleCodes.has(finding.ruleCode) || seen.has(finding.ruleCode)) {

      continue;

    }

    seen.add(finding.ruleCode);

    summaries.push({

      ruleCode: finding.ruleCode,

      title: finding.title,

      severity: finding.severity,

    });

  }



  return summaries;

}


