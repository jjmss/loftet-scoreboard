import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeName, pickWinner } from "./spin.js";

test("pickWinner velger bare blant de som er til stede", () => {
  const people = ["Ada", "Bo", "Cato"];
  assert.equal(pickWinner(people, () => 0), "Ada");
  assert.equal(pickWinner(people, () => 0.34), "Bo");
  assert.equal(pickWinner(people, () => 0.99), "Cato");
});

test("pickWinner avviser tom liste", () => {
  assert.throws(() => pickWinner([]), /Ingen til stede/);
});

test("normalizeName trimmer og tillater norske bokstaver", () => {
  assert.equal(normalizeName("  Anne-Marte Ø  "), "Anne-Marte Ø");
  assert.throws(() => normalizeName("x"), /minst to/);
  assert.throws(() => normalizeName("Ada <script>"), /ugyldige/);
});
