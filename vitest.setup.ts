import { afterEach } from "vitest";

// H5 component tests render pages whose copy resolves through the app i18n
// runtime; initialise it once so they see real zh-CN text instead of raw keys.
import "./apps/sdkwork-mall-h5/src/i18n";

if (typeof window !== "undefined" && typeof document !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
  const { cleanup } = await import("@testing-library/react");

  afterEach(() => {
    cleanup();
  });
}

