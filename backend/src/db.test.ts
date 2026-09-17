import assert from "node:assert/strict";
import { test } from "node:test";
import { Store } from "./db.js";

test("gjøremål gir lodd og rangerer tavla", () => {
  const store = new Store(":memory:");
  const ada = store.createUser("Ada");
  const bo = store.createUser("Bo");

  store.completeChore(ada.id, "oppvask-ut");
  store.completeChore(ada.id, "planter");
  store.completeChore(bo.id, "kaffe");

  const board = store.leaderboard();
  assert.equal(board[0]?.name, "Ada");
  assert.equal(board[0]?.tickets, 2);
  assert.equal(board[1]?.name, "Bo");
  assert.equal(board[1]?.tickets, 1);

  const chores = store.listChores().map((c) => c.name);
  assert.deepEqual(chores, [
    "Ta ut av oppvaskmaskinen",
    "Sett inn i oppvaskmaskinen",
    "Vanne planter",
    "Fylle/fikse kaffemaskina",
    "Rydde",
  ]);

  store.close();
});

test("fredagshjulet lagrer vinner blant de fremmøtte", () => {
  const store = new Store(":memory:");
  const ada = store.createUser("Ada");
  const bo = store.createUser("Bo");
  store.createUser("Cato");

  const spin = store.recordSpin([ada.id, bo.id]);
  assert.ok([ada.id, bo.id].includes(spin.winnerId));
  assert.equal(spin.attendeeIds.length, 2);
  assert.equal(store.latestSpin()?.id, spin.id);
  assert.throws(() => store.recordSpin([]), /til stede/);

  store.close();
});
