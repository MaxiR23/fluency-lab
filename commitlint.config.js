// INFO: commit message rules. One line, `type(scope): description`, with
// the type equal to the issue's label. No body and no trailers: the
// reasoning goes in the pull request. The header stops at 64 so that a
// pull request title plus the ` (#9999)` GitHub appends on squash still
// fits in 72 on main. No attribution to tools or AI anywhere.

const ATTRIBUTION = /claude|anthropic|co-authored-by|generated with|claude-session/i;

export default {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        "no-attribution": ({ raw }) => [
          !ATTRIBUTION.test(raw ?? ""),
          "the message must not mention Claude, Anthropic, Co-Authored-By or Generated with",
        ],
      },
    },
  ],
  rules: {
    "type-enum": [2, "always", ["feat", "fix", "chore", "docs", "test", "refactor", "ci"]],
    "scope-empty": [2, "never"],
    "header-max-length": [2, "always", 64],
    "body-empty": [2, "always"],
    "footer-empty": [2, "always"],
    "no-attribution": [2, "always"],
  },
};
