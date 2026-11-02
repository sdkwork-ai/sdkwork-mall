import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Message centre contract: every root reads the real notifications plane.
 *
 * The pages used to synthesize rows from the latest orders and after-sales
 * requests. That local feed is gone; the notifications API is the only source.
 */
const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");

function read(relativePath) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  assert.ok(existsSync(absolutePath), `missing ${relativePath}`);
  return readFileSync(absolutePath, "utf8");
}

test("the PC message centre reads the IM notifications client", () => {
  const remote = read("apps/sdkwork-mall-pc/src/bootstrap/buyer-commerce-remote.ts");
  assert.match(remote, /configureSdkworkMessagesNotificationsPort/u);
  assert.match(remote, /loadSdkworkMallPcImAppClient/u);
  assert.match(remote, /client\.notifications\.list/u);
  assert.match(remote, /client\.notifications\.retrieve/u);

  const service = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-messages/src/messages-service.ts");
  assert.match(service, /getSdkworkMessagesNotificationsPort/u);
  assert.doesNotMatch(service, /listAfterSalesRequests/u);

  const page = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-messages/src/pages/MessagesPage.tsx");
  assert.match(page, /loadMallMessageCenterPage/u);
  assert.match(page, /重试/u);
});

test("the H5 message route renders the real notifications page", () => {
  const routes = read("apps/sdkwork-mall-h5/src/routes/AppRoutes.tsx");
  const messagesRoute = routes.slice(routes.indexOf('path="/buyer/messages"') - 300, routes.indexOf('path="/buyer/messages"'));
  assert.match(messagesRoute, /SdkworkMallH5NoticesPage/u);
  assert.ok(
    !existsSync(
      path.join(
        workspaceRoot,
        "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-buyer/src/messages-service.ts",
      ),
    ),
    "the synthesized H5 message service must stay deleted",
  );
});

test("the mini program message centre reads GET /notifications", () => {
  const page = read("apps/sdkwork-mall-mini-program/src/pages/messages/index.ts");
  assert.match(page, /listNotices/u);
  assert.match(page, /from "\.\.\/\.\.\/services\/im-service"/u);
  assert.ok(
    !existsSync(
      path.join(
        workspaceRoot,
        "apps/sdkwork-mall-mini-program/src/services/messages-service.ts",
      ),
    ),
    "the synthesized mini-program message service must stay deleted",
  );
});

test("the Flutter message centre reads the IM notices service", () => {
  const page = read("apps/sdkwork-mall-flutter-mobile/lib/pages/messages_page.dart");
  assert.match(page, /im\.listNotices\(\)/u);
  assert.ok(
    !existsSync(
      path.join(
        workspaceRoot,
        "apps/sdkwork-mall-flutter-mobile/lib/services/messages_service.dart",
      ),
    ),
    "the synthesized Flutter message service must stay deleted",
  );
});
