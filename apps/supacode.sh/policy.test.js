import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("./app/page.tsx", import.meta.url), "utf8");

test("pricing page states the final-sale policy and statutory exception", () => {
  assert.match(
    page,
    /const finalSalePolicy =\s+"All sales are final, except as our refund policy or the law provides\. Email license@supacode\.sh to request a refund required by law or to get payment help\."/,
  );
  assert.match(
    page,
    /answer: `\$\{finalSalePolicy\} Purchases made before 12 October 2026 remain subject to the refund terms shown at checkout\./,
  );
  assert.match(page, /Sold by SUPATERM LIMITED\.\s*\{finalSalePolicy\}/);
  assert.match(page, /question: "Can I get a refund\?"/);
  assert.doesNotMatch(page, /\b(?:seven|7)[\s-]days?\b[\s\S]{0,40}\brefund/i);
  assert.doesNotMatch(page, /refund[\s\S]{0,40}\b(?:seven|7)[\s-]days?\b/i);
});
