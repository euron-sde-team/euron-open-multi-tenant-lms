import { describe, expect, it } from "vitest";

import { servedQuestionOrder, shuffleArray } from "../../src/utils/shuffle.util";

// The staff attempt review must reproduce the order the learner was served by
// learner-api. These values are pinned in BOTH repos' tests.
describe("learner shuffle parity", () => {
  it("matches the learner-api shuffle output", () => {
    expect(shuffleArray(["A", "B", "C", "D"], "01M5ATTEMPT01Q1")).toEqual(["C", "D", "A", "B"]);
    expect(shuffleArray(["q1", "q2", "q3", "q4", "q5"], "01M5ATTEMPTS1")).toEqual([
      "q4",
      "q3",
      "q1",
      "q5",
      "q2",
    ]);
  });

  it("orders served questions per section with seed attemptId + sectionId", () => {
    const sectionQuestions = [
      { section_id: "S1", question_id: "q1" },
      { section_id: "S1", question_id: "q2" },
      { section_id: "S1", question_id: "q3" },
      { section_id: "S2", question_id: "q4" },
      { section_id: "S2", question_id: "q5" },
    ];
    const served = new Set(["q1", "q2", "q3", "q5"]);
    expect(
      servedQuestionOrder({
        attemptId: "A1",
        sections: [{ id: "S1" }, { id: "S2" }],
        sectionQuestions,
        isServed: (id) => served.has(id),
        shuffleQuestions: true,
      })
    ).toEqual([...shuffleArray(["q1", "q2", "q3"], "A1S1"), "q5"]);
  });
});
