// INFO: root entry so `pnpm exec jest <path>` finds a test in apps/mobile.
// packages/shared and apps/api run under vitest; scripts/ under node --test.
module.exports = {
  projects: ["<rootDir>/apps/mobile"],
};
