module.exports = {
  preset: "jest-expo",
  resolver: "<rootDir>/jest.resolver.js",
  // INFO: the library's own mocks, from its "Testing with Jest" guide; Jest appends them to the preset's setupFiles.
  setupFiles: ["react-native-gesture-handler/jestSetup.js"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  // INFO: jest-expo reads the tsconfig paths relative to the cwd, so they are
  // missing when jest runs from the repo root. Jest merges this with the preset.
  moduleNameMapper: {
    // INFO: the resolver in jest.resolver.js sends react-native-worklets to its web build, whose
    // getUIRuntimeHolder throws; the gesture handler calls it in a microtask on load. Its own web
    // file for this call does nothing.
    "^\\./installUIRuntimeBindings$":
      "<rootDir>/node_modules/react-native-gesture-handler/lib/module/handlers/gestures/installUIRuntimeBindings.web.js",
    "^@/assets/(.*)$": "<rootDir>/assets/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
