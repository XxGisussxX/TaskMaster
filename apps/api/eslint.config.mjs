import { nodeConfig } from "@taskmaster/config/eslint";

export default [
  ...nodeConfig,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        sourceType: "module",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
