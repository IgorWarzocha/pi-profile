import assert from "node:assert/strict";
import test from "node:test";
import { analyzeText } from "../src/analyzer.js";

test("recognises broader courtesy and collaboration phrases", () => {
  const result = analyzeText("alrighty mate, go ahead please — good catch, and cheers");
  assert.equal(result.courtesy.please, 1);
  assert.equal(result.courtesy.warmth, 2);
  assert.equal(result.collaboration.delegation, 1);
  assert.equal(result.collaboration.affirmation, 1);
  assert.equal(result.collaboration.greeting, 1);
});

test("ignores language inside fenced and inline code", () => {
  const result = analyzeText("```js\nconst shit = true\n``` use `wtf` please");
  assert.equal(result.friction.profanity, 0);
  assert.equal(result.courtesy.please, 1);
});

test("recognises DevRagio profanity variants", () => {
  const result = analyzeText("what the fuck, this is a shitshow and wtf");
  assert.equal(result.friction.profanity, 3);
});
