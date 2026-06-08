#!/usr/bin/env tsx
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { allRules } from "../audit-engine/rules";

const ROOT = join(import.meta.dirname, "..");
const RULES_DIR = join(ROOT, "audit-engine", "rules");
const FIXTURES_FILE = join(ROOT, "audit-engine", "__tests__", "fixtures", "rule-fixtures.ts");
const TEST_FILE = join(ROOT, "audit-engine", "__tests__", "rules.test.ts");

let errors = 0;

function fail(msg: string) {
  console.error(`ERROR: ${msg}`);
  errors++;
}

const ruleFiles = readdirSync(RULES_DIR).filter(
  (f) => f.endsWith(".ts") && f !== "index.ts",
);
if (ruleFiles.length !== 51) {
  fail(`Expected 51 rule files, found ${ruleFiles.length}`);
}

const ids = new Set<number>();
const codes = new Set<string>();
for (const rule of allRules) {
  if (ids.has(rule.id)) fail(`Duplicate rule id: ${rule.id}`);
  if (codes.has(rule.code)) fail(`Duplicate rule code: ${rule.code}`);
  ids.add(rule.id);
  codes.add(rule.code);

  const expectedFile = ruleFiles.find((f) => f.startsWith(String(rule.id).padStart(2, "0")));
  if (!expectedFile) {
    fail(`No file found for rule ${rule.id} (${rule.code})`);
  }
}

if (!existsSync(FIXTURES_FILE)) {
  fail("Missing rule-fixtures.ts");
}

if (!existsSync(TEST_FILE)) {
  fail("Missing rules.test.ts");
}

for (const rule of allRules) {
  if (!ruleFixturesHas(rule.code)) {
    fail(`Missing fixtures for rule ${rule.code}`);
  }
}

function ruleFixturesHas(code: string): boolean {
  const content = readdirSync(join(ROOT, "audit-engine", "__tests__", "fixtures"));
  return content.includes("rule-fixtures.ts");
}

if (errors > 0) {
  console.error(`\nlint-rules failed with ${errors} error(s)`);
  process.exit(1);
}

console.log(`lint-rules passed: ${allRules.length} rules validated`);
