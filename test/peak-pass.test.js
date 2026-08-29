import test from "node:test";
import assert from "node:assert/strict";
import { buildPassId, formatClock } from "../src/peak-pass.js";

test("Peak Pass genera un identificador estable y privado", () => {
  const first = buildPassId("1543227776742727702", "123456789012345678");
  const second = buildPassId("1543227776742727702", "123456789012345678");

  assert.equal(first, second);
  assert.match(first, /^PPA-[A-F0-9]{8}$/);
  assert.equal(first.includes("123456789012345678"), false);
  assert.notEqual(first, buildPassId("1543227776742727702", "987654321098765432"));
});

test("el reloj de acceso utiliza minutos y segundos", () => {
  assert.equal(formatClock(60), "01:00");
  assert.equal(formatClock(5), "00:05");
  assert.equal(formatClock(0), "00:00");
});
