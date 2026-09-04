import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Vendored third-party trees: agent skill installs and the whisper.cpp checkout used for
  // caption timing. None of it is our code, and all of it is gitignored.
  { ignores: ["dist", "bridge/src/**/web", "bridge/.venv", "playwright-report", "test-results", ".agents/skills", ".claude/skills", "video/edit/whisper.cpp"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-explicit-any": "off"
    },
  },
);
