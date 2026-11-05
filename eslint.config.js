// INFO: root entry so `pnpm exec eslint <path>` works on any workspace file
// and on the root files. The rules live in apps/mobile. The alias resolver
// points at the app's tsconfig by absolute path, so `@/` resolves when ESLint
// runs from the root, where there is no tsconfig.
const { defineConfig } = require("eslint/config");
const mobile = require("./apps/mobile/eslint.config.js");

module.exports = defineConfig([
  mobile,
  {
    files: ["apps/mobile/**"],
    settings: {
      "import/resolver": {
        typescript: { project: require.resolve("./apps/mobile/tsconfig.json") },
      },
    },
  },
  { ignores: ["**/dist/*", "**/.expo/*", "**/coverage/*"] },
]);
