// INFO: Reanimated's and Worklets' own Jest resolvers send a file to the web build when
// its folder path contains the package name. pnpm names store folders with their peers
// (.pnpm/expo-modules-core@58.0.30_react-native-worklets@0.13.0_...), so those resolvers
// also catch other packages, and they replace the preset's resolver. This one matches
// the package folder itself and chains to the preset's resolver.
const { resolver: presetResolverPath } = require("jest-expo/jest-preset");
const presetResolver = require(presetResolverPath);

// INFO: the list in react-native-reanimated/jest/resolver.js (4.7.1).
const REANIMATED_WEB_ONLY = [
  "initializers",
  "mutables",
  "mappers",
  "ConfigHelper",
  "UpdateLayoutAnimations",
  "useAnimatedRef",
  "useAnimatedStyle",
  "WorkletEventHandler",
  "JSPropsUpdater",
  "updateProps",
  "util",
  "css/component/AnimatedComponent",
];

function withoutNative(options) {
  return {
    ...options,
    extensions: options.extensions?.filter((ext) => !ext.includes("native")),
  };
}

module.exports = (request, options) => {
  const inReanimated = options.basedir.includes("/node_modules/react-native-reanimated/");
  const isWorklets =
    options.basedir.includes("/node_modules/react-native-worklets/") ||
    request === "react-native-worklets" ||
    request.startsWith("react-native-worklets/");
  const name = request.split("/").pop();
  const reanimatedWeb =
    request.startsWith(".") &&
    inReanimated &&
    REANIMATED_WEB_ONLY.some((entry) =>
      entry.includes("/") ? request.endsWith(entry) : name === entry,
    );
  return presetResolver(request, reanimatedWeb || isWorklets ? withoutNative(options) : options);
};
