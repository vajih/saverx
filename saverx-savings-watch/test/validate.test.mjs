import test from "node:test";
import assert from "node:assert/strict";
import { normalizeUsPhone, isValidSlug, isValidCode } from "../src/validate.js";

test("normalizes common US formats to E.164", () => {
  for (const v of ["(415) 555-0100", "415-555-0100", "4155550100", "1 415 555 0100", "+1 (415) 555-0100"])
    assert.equal(normalizeUsPhone(v), "+14155550100", v);
});
test("rejects invalid phones", () => {
  for (const v of ["", "abc", "12345", "(015) 555-0100", "(415) 055-0100", "+44 20 7946 0958", "415555010", "41555501000", null, undefined, 4155550100, "1".repeat(40)])
    assert.equal(normalizeUsPhone(v), null, String(v));
});
test("slug and code validation", () => {
  assert.ok(isValidSlug("repatha")); assert.ok(isValidSlug("a-b-1"));
  for (const s of ["", "../x", "Repatha", "a b", "-x", "x".repeat(61), 5]) assert.ok(!isValidSlug(s), String(s));
  assert.ok(isValidCode("123456"));
  for (const c of ["12", "abcdef", "", "123456789012", 123456]) assert.ok(!isValidCode(c), String(c));
});
