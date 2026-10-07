import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve("apps/web/src"),
    },
  },
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/web/**/*.test.ts"],
    fileParallelism: false,
    env: {
      DATABASE_URL: "postgres://tfs:tfs@127.0.0.1:5432/tfs_test",
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-ok",
      BETTER_AUTH_URL: "http://127.0.0.1:3000",
      STORAGE_DIR: path.resolve(".data/test-objects"),
    },
  },
});
