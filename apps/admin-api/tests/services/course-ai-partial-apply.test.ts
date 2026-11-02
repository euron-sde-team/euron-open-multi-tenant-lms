/**
 * A partial AI generation must never blank a course's landing page.
 *
 * THE BUG THIS PINS DOWN
 * ----------------------
 * `buildPageSections` composes the entire page out of the generated content.
 * That is correct for a full build and destructive for a partial one. A run
 * that asked only for thumbnails arrived with no curriculum, no outcomes and no
 * FAQs, and rebuilding the page from it replaced a real 7-module curriculum
 * with an empty list. The course kept all 50 lessons in the LMS tables while
 * its public page showed nothing: a page that looks broken sitting on top of
 * data that is perfectly fine, which is the hardest kind of failure to trace.
 */
import { describe, expect, it } from "vitest";
import { mergeGeneratedSections } from "../../src/services/course-ai-apply.service";

type Section = { id: string; type: string; order: number; content: Record<string, unknown> };

const section = (type: string, order: number, content: Record<string, unknown>): Section => ({
  id: `existing-${type}`,
  type,
  order,
  content,
});

/** A page as it looks once a course is properly filled in. */
function livePage(): Section[] {
  return [
    section("course-hero", 0, { title: "Rust for Systems Programmers", thumbnail: "s3://old" }),
    section("course-learning-outcomes", 1, { outcomes: ["Read idiomatic Rust", "Reason about ownership"] }),
    section("course-curriculum", 2, {
      sections: [{ id: "m1", title: "Ownership and Borrowing" }, { id: "m2", title: "Concurrency" }],
      totalLectures: 50,
    }),
    section("faq", 5, { faqs: [{ id: "f1", question: "Do I need experience?", answer: "No." }] }),
  ];
}

/** What buildPageSections emits when only thumbnails were generated. */
function builtFromThumbnailsOnly(): Section[] {
  return [
    section("course-hero", 0, { title: "Rust for Systems Programmers", thumbnail: "s3://new" }),
    section("course-learning-outcomes", 1, { outcomes: [] }),
    section("course-curriculum", 2, { sections: [], totalLectures: 0 }),
    section("faq", 5, { faqs: [] }),
  ];
}

describe("a thumbnails-only generation", () => {
  const generated = { webThumbnailDataUrl: "data:image/webp;base64,AAAA" } as never;

  it("keeps the curriculum it did not generate", () => {
    const merged = mergeGeneratedSections(livePage() as never, builtFromThumbnailsOnly() as never, generated) as unknown as Section[];
    const curriculum = merged.find((s) => s.type === "course-curriculum")!;
    expect(curriculum.content.sections, "curriculum must survive a thumbnail run").toHaveLength(2);
    expect(curriculum.content.totalLectures).toBe(50);
  });

  it("keeps the outcomes and FAQs it did not generate", () => {
    const merged = mergeGeneratedSections(livePage() as never, builtFromThumbnailsOnly() as never, generated) as unknown as Section[];
    expect((merged.find((s) => s.type === "course-learning-outcomes")!.content.outcomes as unknown[])).toHaveLength(2);
    expect((merged.find((s) => s.type === "faq")!.content.faqs as unknown[])).toHaveLength(1);
  });

  it("still applies the thumbnail it DID generate", () => {
    const merged = mergeGeneratedSections(livePage() as never, builtFromThumbnailsOnly() as never, generated) as unknown as Section[];
    expect(merged.find((s) => s.type === "course-hero")!.content.thumbnail).toBe("s3://new");
  });

  it("leaves the page's own ids and ordering alone", () => {
    const merged = mergeGeneratedSections(livePage() as never, builtFromThumbnailsOnly() as never, generated) as unknown as Section[];
    expect(merged.map((s) => s.id)).toEqual([
      "existing-course-hero",
      "existing-course-learning-outcomes",
      "existing-course-curriculum",
      "existing-faq",
    ]);
    expect(merged.map((s) => s.order)).toEqual([0, 1, 2, 5]);
  });
});

describe("a full generation", () => {
  it("replaces the sections it generated", () => {
    const generated = {
      learningOutcomes: ["A", "B", "C"],
      sections: [{ title: "New module", modules: [] }],
      faqs: [{ question: "q", answer: "a" }],
    } as never;
    const built = [
      section("course-learning-outcomes", 1, { outcomes: ["A", "B", "C"] }),
      section("course-curriculum", 2, { sections: [{ id: "n1", title: "New module" }], totalLectures: 9 }),
      section("faq", 5, { faqs: [{ id: "n", question: "q", answer: "a" }] }),
    ];
    const merged = mergeGeneratedSections(livePage() as never, built as never, generated) as unknown as Section[];
    expect((merged.find((s) => s.type === "course-learning-outcomes")!.content.outcomes as unknown[])).toHaveLength(3);
    expect((merged.find((s) => s.type === "course-curriculum")!.content.sections as unknown[])).toHaveLength(1);
  });
});

describe("sections the generator does not drive", () => {
  it("never touches ratings, recommendations or instructors", () => {
    const previous = [
      ...livePage(),
      section("course-instructor", 8, { instructors: [{ id: "i1", name: "Ananya Rao" }] }),
      section("course-ratings", 6, { some: "state" }),
    ];
    const built = [...builtFromThumbnailsOnly(), section("course-instructor", 8, { instructors: [] })];
    const merged = mergeGeneratedSections(previous as never, built as never, { webThumbnailDataUrl: "x" } as never) as unknown as Section[];
    expect((merged.find((s) => s.type === "course-instructor")!.content.instructors as unknown[])).toHaveLength(1);
    expect(merged.find((s) => s.type === "course-ratings")!.content).toEqual({ some: "state" });
  });
});

describe("a page that has no sections yet", () => {
  it("is left to the caller's full build rather than merged into nothing", () => {
    const built = builtFromThumbnailsOnly();
    const merged = mergeGeneratedSections([] as never, built as never, { webThumbnailDataUrl: "x" } as never) as unknown as Section[];
    // Nothing to preserve, so only the sections with real content are appended.
    expect(merged.map((s) => s.type)).toEqual(["course-hero"]);
  });
});

describe("field-level protection inside a section", () => {
  // Section-level gating alone was not enough. `course-hero` carries a
  // subtitle, a description and a thumbnail independently, so a run that
  // regenerated the copy arrived with `thumbnail: ""`, passed the section
  // check on the strength of the subtitle, and blanked a thumbnail the
  // previous run had just generated.
  it("does not blank a thumbnail when only the copy was regenerated", () => {
    const previous = [
      section("course-hero", 0, {
        title: "Rust for Systems Programmers",
        subtitle: "old subtitle",
        thumbnail: "s3://generated-last-run",
      }),
    ];
    const built = [
      section("course-hero", 0, {
        title: "Rust for Systems Programmers",
        subtitle: "a freshly written subtitle",
        thumbnail: "",
      }),
    ];
    const merged = mergeGeneratedSections(previous as never, built as never, {
      subTitle: "a freshly written subtitle",
    } as never) as unknown as Section[];

    const hero = merged.find((s) => s.type === "course-hero")!;
    expect(hero.content.subtitle, "new copy applies").toBe("a freshly written subtitle");
    expect(hero.content.thumbnail, "existing image survives").toBe("s3://generated-last-run");
  });

  it("still lets a real new value replace an old one", () => {
    const previous = [section("course-hero", 0, { thumbnail: "s3://old", subtitle: "old" })];
    const built = [section("course-hero", 0, { thumbnail: "s3://new", subtitle: "new" })];
    const merged = mergeGeneratedSections(previous as never, built as never, {
      subTitle: "new",
      webThumbnailDataUrl: "data:...",
    } as never) as unknown as Section[];
    expect(merged[0]!.content.thumbnail).toBe("s3://new");
    expect(merged[0]!.content.subtitle).toBe("new");
  });
});
