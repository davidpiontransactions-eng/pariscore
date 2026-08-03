import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  rules: {
    // TypeScript rules
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/prefer-as-const": "off",
    "@typescript-eslint/no-unused-disable-directive": "off",
    
    // React rules
    "react-hooks/exhaustive-deps": "off",
    "react-hooks/purity": "off",
    // React Compiler-era diagnostics (eslint-plugin-react-hooks v7) —
    // off pour la tolérance legacy (43 refs, 8 memo, 3 set-state, 1 incompatible).
    // TODO: réactiver pour src/** une fois les patterns compiler-era en place.
    "react-hooks/refs": "off",
    "react-hooks/preserve-manual-memoization": "off",
    "react-hooks/set-state-in-effect": "off",
    "react-hooks/incompatible-library": "off",
    "react-hooks/immutability": "off",
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/prop-types": "off",
    "react-compiler/react-compiler": "off",
    
    // Next.js rules
    "@next/next/no-img-element": "off",
    "@next/next/no-html-link-for-pages": "off",
    
    // General JavaScript rules
    "prefer-const": "off",
    "no-unused-vars": "off",
    "no-console": "off",
    "no-debugger": "off",
    "no-empty": "off",
    "no-irregular-whitespace": "off",
    "no-case-declarations": "off",
    "no-fallthrough": "off",
    "no-mixed-spaces-and-tabs": "off",
    "no-redeclare": "off",
    "no-undef": "off",
    "no-unreachable": "off",
    "no-useless-escape": "off",
  },
}, {
  // Legacy CommonJS / bridge files — `require()` est le pattern natif (scripts .js legacy,
  // package bridge pariscore-services, routes API Next qui chargent les services legacy).
  // Garder la règle ON pour le reste de src/** (code Next.js moderne en ESM).
  files: ["scripts/**/*.{js,ts,tsx,mjs,cjs}", "packages/pariscore-services/**/*.{js,ts}", "src/app/api/f1/**", "src/app/api/cs2/**", "src/app/api/cycling/**", "src/app/api/mma/**", "src/app/api/nba/**", "src/app/api/wnba/**"],
  rules: {
    "@typescript-eslint/no-require-imports": "off",
  },
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills", "tests/**", "playwright.config.ts", "e2e/**", ".graphify/**", ".agents/**", ".context/**", ".claude/**", ".archive/**", ".opencode/**", ".stitch/**", ".mcp/**", "cache/**", "docs/**", "download/**", "data/**", "export/**", "markdown/**", "models/**", "ml/**", "mobile/**", "legacy/**", "graphify-out/**"]
}];

export default eslintConfig;
