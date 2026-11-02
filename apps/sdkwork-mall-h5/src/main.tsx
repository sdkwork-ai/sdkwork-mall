import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./i18n";
import "./index.css";

/**
 * Bridges the served runtime-env document into `globalThis.SDKWORK_RUNTIME_ENV`.
 *
 * The shared SDK resolver reads `SDKWORK_API_BASE_URL` (a bare origin) and
 * appends its own `/app/v3/api` prefix. Same-origin profiles (`standalone.*`)
 * deliberately leave it unset so requests stay on the page origin.
 */
function toRuntimeEnvBridge(document: Record<string, unknown>): Record<string, unknown> {
  const bridge: Record<string, unknown> = { ...document };
  const appApiBaseUrl = typeof document.appApiBaseUrl === "string" ? document.appApiBaseUrl.trim() : "";
  if (/^https?:\/\//u.test(appApiBaseUrl)) {
    bridge.SDKWORK_API_BASE_URL = appApiBaseUrl;
  }
  return bridge;
}

async function installRuntimeEnv(): Promise<void> {
  try {
    const response = await fetch("/runtime-env.json", { cache: "no-store" });
    if (!response.ok) {
      return;
    }
    const document = (await response.json()) as Record<string, unknown>;
    (globalThis as Record<string, unknown>).SDKWORK_RUNTIME_ENV = Object.freeze(
      toRuntimeEnvBridge(document),
    );
  } catch {
    // A missing runtime-env document falls back to same-origin API paths.
  }
}

async function boot(): Promise<void> {
  await installRuntimeEnv();
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("SDKWork Mall H5 root element was not found.");
  }
  const { App } = await import("./App");
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
