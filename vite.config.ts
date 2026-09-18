import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  // @solana/kit reads process.env.NODE_ENV to pick its dev checks; the browser
  // has no `process`, so give it the value at build time.
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode === "production" ? "production" : "development"),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@empowerfi/audit-commitments": path.resolve(__dirname, "./packages/audit-commitments/src/index.ts"),
      "@empowerfi/audit-client": path.resolve(__dirname, "./packages/audit-client/src/generated/index.ts"),
      "@empowerfi/readiness-engine": path.resolve(__dirname, "./packages/readiness-engine/src/index.ts"),
      "@empowerfi/eligibility-engine": path.resolve(__dirname, "./packages/eligibility-engine/src/index.ts"),
      "@empowerfi/capital-allocation": path.resolve(__dirname, "./packages/capital-allocation/src/index.ts"),
      "@empowerfi/settlement-route": path.resolve(__dirname, "./packages/settlement-route/src/index.ts"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
