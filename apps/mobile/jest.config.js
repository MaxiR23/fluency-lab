module.exports = {
  preset: "jest-expo",
  resolver: "<rootDir>/jest.resolver.js",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  // INFO: jest-expo reads the tsconfig paths relative to the cwd, so they are
  // missing when jest runs from the repo root. Jest merges this with the preset.
  moduleNameMapper: {
    "^@/assets/(.*)$": "<rootDir>/assets/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
