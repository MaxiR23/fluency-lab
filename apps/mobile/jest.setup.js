const { jest } = require("@jest/globals");

// INFO: the library's own Jest mock, from its "Jest testing guide": the provider and the
// views become plain host components, so their props stay readable in tests.
jest.mock("react-native-keyboard-controller", () =>
  require("react-native-keyboard-controller/jest"),
);
