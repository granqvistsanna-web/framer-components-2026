import js from "@eslint/js"
import tseslint from "@typescript-eslint/eslint-plugin"
import tsParser from "@typescript-eslint/parser"
import reactHooks from "eslint-plugin-react-hooks"

export default [
  {
    ignores: ["node_modules/**", ".git/**", ".playwright-mcp/**", "shipped/**"],
  },
  js.configs.recommended,
  {
    files: ["BL/**/*.ts", "BL/**/*.tsx", "WIP/**/*.ts", "WIP/**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
      },
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        React: "readonly",
        window: "readonly",
        document: "readonly",
        console: "readonly",
        performance: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        cancelAnimationFrame: "readonly",
        requestAnimationFrame: "readonly",
        getComputedStyle: "readonly",
        ResizeObserver: "readonly",
        IntersectionObserver: "readonly",
        DOMParser: "readonly",
        HTMLElement: "readonly",
        KeyboardEvent: "readonly",
        MediaQueryListEvent: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "react-hooks": reactHooks,
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn"
    },
  },
]
