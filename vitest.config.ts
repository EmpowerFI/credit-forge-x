import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "packages/**/*.{test,spec}.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@empowerfi/audit-commitments": path.resolve(__dirname, "./packages/audit-commitments/src/index.ts"),
      "@empowerfi/audit-client": path.resolve(__dirname, "./packages/audit-client/src/generated/index.ts"),
      "@empowerfi/readiness-engine": path.resolve(__dirname, "./packages/readiness-engine/src/index.ts"),
      "@empowerfi/eligibility-engine": path.resolve(__dirname, "./packages/eligibility-engine/src/index.ts"),
      "@empowerfi/capital-allocation": path.resolve(__dirname, "./packages/capital-allocation/src/index.ts"),
    },
  },
});
