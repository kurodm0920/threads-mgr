import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Server Component で Date.now() / new Date() を使うのは普通なので、
    // React Compiler の purity チェックを緩める
    rules: {
      "react-hooks/purity": "off",
    },
  },
]);

export default eslintConfig;
