// ESLint setup: strict type-checked rules plus the size limits (500-line files, 80-line functions,
// complexity 10, depth 4, 5 parameters), with inline disable comments turned off.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "coverage/", "node_modules/"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ["eslint.config.js"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "error" },
    rules: {
      "max-lines": ["error", { max: 500, skipBlankLines: false, skipComments: false }],
      "max-lines-per-function": ["error", { max: 80, skipBlankLines: false, skipComments: false }],
      complexity: ["error", 10],
      "max-depth": ["error", 4],
      "max-params": ["error", 5],
      "no-warning-comments": "off",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
  { files: ["**/*.js"], ...tseslint.configs.disableTypeChecked },
);
