const { beforeEach, jest } = require("@jest/globals");

// INFO: the library's own Jest mock, from its "Jest testing guide": the provider and the
// views become plain host components, so their props stay readable in tests.
jest.mock("react-native-keyboard-controller", () =>
  require("react-native-keyboard-controller/jest"),
);

// INFO: every test file gets the fake haptics ports. No route test programs haptics, and
// 14 route tests would each need the same mock line; the few tests that assert haptics import
// the fake and read it. test/haptics/index.test.ts unmocks it to test the real wiring.
jest.mock("@/haptics", () => {
  const fake = require("./test/helpers/fake-haptics");
  return { haptics: fake.fakeHaptics, hapticsSetting: fake.fakeHapticsSetting };
});

beforeEach(() => require("./test/helpers/fake-haptics").resetFakeHaptics());
