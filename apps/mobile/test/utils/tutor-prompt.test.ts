// apps/mobile/test/utils/tutor-prompt.test.ts
//
// Tests for the tutor's system prompt builder.
//
// Tested:
// - tutorPrompt includes each rule, the level, the learner, the topic and the opening line
// - tutorPrompt explains a quoted reply and tells the tutor not to correct the quote
// - tutorPrompt names a topic outside the catalog by its raw id
// - tutorPrompt asks for a rule label on each correction
// - tutorPrompt asks for a note only when the learner asks for a table, a summary or a study note
// - tutorPrompt requires originals copied exactly from the learner's last message
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/tutor-prompt.test.ts
//
// SEE: apps/mobile/src/utils/tutor-prompt.ts

import { describe, expect, it } from "@jest/globals";

import {
  NOTE_GUIDE,
  NOTE_SHAPE,
  OUTPUT_GUIDE,
  RULE_CORRECT_AND_ASK,
  RULE_DECLINE,
  RULE_ENGLISH_ONLY,
  RULE_NO_KEY,
  RULE_OTHER_LANGUAGE,
  RULE_REPLY_QUOTE,
  tutorPrompt,
  type TutorPromptInput,
} from "@/utils/tutor-prompt";

const input: TutorPromptInput = {
  displayName: "Ada",
  level: "intermediate",
  goals: ["work", "travel"],
  topics: ["food", "music"],
  topicTitle: "The app you use most",
  openingLine: "Which app do you open most every day?",
};

describe("tutorPrompt", () => {
  it("asks for a short rule label naming the grammar point on each correction", () => {
    expect(OUTPUT_GUIDE).toContain("rule");
    expect(OUTPUT_GUIDE).toContain("Present perfect for experiences");
    expect(tutorPrompt(input)).toContain(OUTPUT_GUIDE);
  });

  it("requires each original to be copied exactly from the learner's last message and nothing else to be corrected", () => {
    expect(OUTPUT_GUIDE).toContain(
      "copied exactly, character for character, from the learner's last message",
    );
    expect(OUTPUT_GUIDE).toContain("Never correct anything outside the learner's last message");
    expect(tutorPrompt(input)).toContain(OUTPUT_GUIDE);
  });

  it("tells the tutor to fill note only when the learner asks for a table, a summary or a study note", () => {
    expect(NOTE_GUIDE).toContain(
      "Only when the learner asks for a table, a summary or a study note",
    );
    expect(NOTE_GUIDE).toContain("Leave note out otherwise");
    const prompt = tutorPrompt(input);
    expect(prompt).toContain(NOTE_GUIDE);
    expect(prompt.indexOf(NOTE_GUIDE)).toBeGreaterThan(prompt.indexOf(OUTPUT_GUIDE));
  });

  it("describes both note shapes", () => {
    expect(NOTE_SHAPE).toContain('"table"');
    expect(NOTE_SHAPE).toContain('"summary"');
    expect(NOTE_SHAPE).toContain("exactly three columns");
    expect(NOTE_GUIDE).toContain(NOTE_SHAPE);
  });

  it("includes the English-only rule", () => {
    expect(tutorPrompt(input)).toContain(RULE_ENGLISH_ONLY);
  });

  it("includes the other-language rule", () => {
    expect(tutorPrompt(input)).toContain(RULE_OTHER_LANGUAGE);
  });

  it("includes the decline rule", () => {
    expect(tutorPrompt(input)).toContain(RULE_DECLINE);
  });

  it("includes the correct-briefly-and-ask rule", () => {
    expect(tutorPrompt(input)).toContain(RULE_CORRECT_AND_ASK);
  });

  it("tells the tutor what a quoted reply is and not to correct the quote", () => {
    expect(tutorPrompt(input)).toContain(RULE_REPLY_QUOTE);
    expect(
      tutorPrompt({
        displayName: null,
        level: null,
        goals: [],
        topics: [],
        topicTitle: null,
        openingLine: null,
      }),
    ).toContain(RULE_REPLY_QUOTE);
    expect(RULE_REPLY_QUOTE).toContain('"> "');
    expect(RULE_REPLY_QUOTE).toContain("never correct them");
  });

  it("includes the never-mention-the-key rule", () => {
    expect(tutorPrompt(input)).toContain(RULE_NO_KEY);
  });

  it("includes the output guide", () => {
    expect(tutorPrompt(input)).toContain(OUTPUT_GUIDE);
  });

  it("states the rules in the exact words", () => {
    expect(RULE_NO_KEY).toBe("Never ask for or mention an API key.");
    expect(RULE_OTHER_LANGUAGE).toBe(
      "If the learner writes in Spanish or another language, answer in English and help them say it in English.",
    );
  });

  it("states the beginner level", () => {
    expect(tutorPrompt({ ...input, level: "beginner" })).toContain(
      "The learner is a beginner: use short sentences and common words.",
    );
  });

  it("states the intermediate level", () => {
    expect(tutorPrompt(input)).toContain(
      "The learner is intermediate: use natural everyday English and a few new expressions.",
    );
  });

  it("states the advanced level", () => {
    expect(tutorPrompt({ ...input, level: "advanced" })).toContain(
      "The learner is advanced: use rich, natural English, idioms included.",
    );
  });

  it("states an unset level", () => {
    expect(tutorPrompt({ ...input, level: null })).toContain(
      "The learner's level is not set: start simple and adjust to how they write.",
    );
  });

  it("names the learner, the goals and the interests", () => {
    const prompt = tutorPrompt(input);
    expect(prompt).toContain("The learner's name is Ada.");
    expect(prompt).toContain("Their goals: Work, Travel.");
    expect(prompt).toContain("They are interested in: Food, Music.");
  });

  it("names a topic outside the catalog by its raw id", () => {
    expect(tutorPrompt({ ...input, topics: ["food", "cooking"] })).toContain(
      "They are interested in: Food, cooking.",
    );
  });

  it("names the starter topic and draws the opening line", () => {
    const prompt = tutorPrompt(input);
    expect(prompt).toContain(
      "Today's topic: The app you use most. Keep to it unless the learner changes it.",
    );
    expect(prompt).toContain(
      'You opened the conversation with: "Which app do you open most every day?"',
    );
  });

  it("follows the learner's lead in a free chat and names no topic", () => {
    const prompt = tutorPrompt({ ...input, topicTitle: null });
    expect(prompt).toContain("This is a free chat: follow the learner's lead.");
    expect(prompt).not.toContain("Today's topic");
  });

  it("leaves out the name, goals, interests and opening line when empty", () => {
    const prompt = tutorPrompt({
      displayName: null,
      level: null,
      goals: [],
      topics: [],
      topicTitle: null,
      openingLine: null,
    });
    expect(prompt).not.toContain("name is");
    expect(prompt).not.toContain("Their goals");
    expect(prompt).not.toContain("interested in");
    expect(prompt).not.toContain("You opened the conversation");
    expect(prompt).toContain(RULE_ENGLISH_ONLY);
  });

  it("leaves out a blank name", () => {
    expect(tutorPrompt({ ...input, displayName: "   " })).not.toContain("name is");
  });

  it("trims the name", () => {
    expect(tutorPrompt({ ...input, displayName: "  Ada " })).toContain(
      "The learner's name is Ada.",
    );
  });

  it("gives the same prompt for the same input", () => {
    expect(tutorPrompt(input)).toBe(tutorPrompt({ ...input }));
  });
});
