import test from "node:test";
import assert from "node:assert/strict";
import snapshot from "../data/snapshots/ifind-close-20261106.json";
import { verifyIfindClose } from "../lib/integrations/ifind";
test("saved actual iFinD evidence supports a scoped comparison without inventing a new query time", async () => {
  const result = await verifyIfindClose(snapshot, { symbol: snapshot.symbol, date: snapshot.date, field: "close" }, 210, "元");
  assert.equal(result.status, "MISMATCH"); assert.equal(result.referenceValue, 202.7);
  assert.equal(snapshot.retrievedAt, "2026-11-09T18:04:55.599Z");
  assert.ok(snapshot.content[0].text.includes("20261106"));
});
