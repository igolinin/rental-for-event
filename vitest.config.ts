import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/schemas/**"],
      exclude: ["src/lib/prisma.ts", "src/lib/auth.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
      },
    },
  },
});
