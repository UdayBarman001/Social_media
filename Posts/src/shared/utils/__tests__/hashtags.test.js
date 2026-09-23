import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractHashtags, tagsFromCaption } from "../hashtags.js";

describe("extractHashtags & tagsFromCaption", () => {
  it("extracts standard ASCII hashtags", () => {
    const text = "Checking out #farming and modern #agriculture techniques!";
    assert.deepStrictEqual(extractHashtags(text), ["farming", "agriculture"]);
  });

  it("extracts Unicode and Indic script hashtags with vowel signs (matras)", () => {
    const text = "आज खेत में #खेती और #किसान भाई #धान की रोपाई कर रहे हैं";
    const tags = extractHashtags(text);

    assert.ok(tags.includes("खेती"), "Must include #खेती");
    assert.ok(tags.includes("किसान"), "Must include #किसान");
    assert.ok(tags.includes("धान"), "Must include #धान");
  });

  it("deduplicates case-insensitively while preserving original casing", () => {
    const text = "Loving #KrishiVerse and #krishiverse and #KRISHIVERSE!";
    assert.deepStrictEqual(extractHashtags(text), ["KrishiVerse"]);
  });

  it("handles empty or punctuation-only inputs safely", () => {
    assert.deepStrictEqual(extractHashtags(""), []);
    assert.deepStrictEqual(extractHashtags(null), []);
    assert.deepStrictEqual(extractHashtags("Hello world without tags"), []);
    assert.deepStrictEqual(extractHashtags("### !!! ???"), []);
  });

  it("tagsFromCaption clamps results to maxTags limit", () => {
    const text = "#one #two #three #four #five #six #seven #eight #nine #ten #eleven";
    const tags = tagsFromCaption(text, 5);

    assert.strictEqual(tags.length, 5);
    assert.deepStrictEqual(tags, ["one", "two", "three", "four", "five"]);
  });
});
