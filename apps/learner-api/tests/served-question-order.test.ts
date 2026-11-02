import assert from "node:assert/strict";
import { test } from "node:test";

import { servedQuestionOrder, shuffleArray } from "../src/utils/shuffle.util";

const sections = [{ id: "S1" }, { id: "S2" }];
const sectionQuestions = [
  { section_id: "S1", question_id: "q1" },
  { section_id: "S1", question_id: "q2" },
  { section_id: "S1", question_id: "q3" },
  { section_id: "S2", question_id: "q4" },
  { section_id: "S2", question_id: "q5" },
  { section_id: "S2", question_id: "q6" },
];

test("unshuffled: section order, then question order", () => {
  const ids = servedQuestionOrder({
    attemptId: "A1",
    sections,
    sectionQuestions,
    isServed: () => true,
    shuffleQuestions: false,
  });
  assert.deepEqual(ids, ["q1", "q2", "q3", "q4", "q5", "q6"]);
});

test("shuffled: matches the player's per-section seed (attemptId + sectionId)", () => {
  const ids = servedQuestionOrder({
    attemptId: "A1",
    sections,
    sectionQuestions,
    isServed: () => true,
    shuffleQuestions: true,
  });
  assert.deepEqual(ids, [
    ...shuffleArray(["q1", "q2", "q3"], "A1S1"),
    ...shuffleArray(["q4", "q5", "q6"], "A1S2"),
  ]);
});

test("random-X: only served questions, filtered before shuffling", () => {
  const served = new Set(["q1", "q3", "q5"]);
  const ids = servedQuestionOrder({
    attemptId: "A1",
    sections,
    sectionQuestions,
    isServed: (id) => served.has(id),
    shuffleQuestions: true,
  });
  assert.deepEqual(ids, [
    ...shuffleArray(["q1", "q3"], "A1S1"),
    ...shuffleArray(["q5"], "A1S2"),
  ]);
});

test("a question in two sections is listed once", () => {
  const ids = servedQuestionOrder({
    attemptId: "A1",
    sections,
    sectionQuestions: [...sectionQuestions, { section_id: "S2", question_id: "q1" }],
    isServed: () => true,
    shuffleQuestions: false,
  });
  assert.equal(ids.filter((id) => id === "q1").length, 1);
});

// Pinned outputs. admin-api carries a copy of this shuffle for the
// staff attempt review and pins the SAME values; if either changes, both
// reviews stop matching what learners saw.
test("shuffle output is pinned (keep in sync with admin-api)", () => {
  assert.deepEqual(shuffleArray(["A", "B", "C", "D"], "01M5ATTEMPT01Q1"), ["C", "D", "A", "B"]);
  assert.deepEqual(
    shuffleArray(["q1", "q2", "q3", "q4", "q5"], "01M5ATTEMPTS1"),
    ["q4", "q3", "q1", "q5", "q2"]
  );
});
