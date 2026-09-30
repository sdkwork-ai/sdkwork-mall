import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Boxes,
  Truck,
} from "lucide-react";
import { Button, EmptyState, LoadingBlock, StatusNotice } from "@sdkwork/ui-pc-react";
import type { SdkworkOrderMessagesOverrides } from "../order-copy";
import {
  createSdkworkLogisticsController,
  type SdkworkLogisticsController,
} from "../logistics-controller";
import {
  createSdkworkOrderPanelStyle,
  createSdkworkOrderToneStyle,
} from "../order-appearance";
import {
  SdkworkOrderIntlProvider,
  useSdkworkOrderIntl,
} from "../order-intl";

export interface SdkworkLogisticsPageProps {
  controller?: SdkworkLogisticsController;
  locale?: string | null;
  messages?: SdkworkOrderMessagesOverrides;
}

interface SdkworkLogisticsPageContentProps {
  controller?: SdkworkLogisticsController;
  locale?: string | null;
  messages?: SdkworkOrderMessagesOverrides;
}

function useSdkworkLogisticsController(
  controller?: SdkworkLogisticsController,
  options?: { locale?: string | null; messages?: SdkworkOrderMessagesOverrides },
): SdkworkLogisticsController {
  return useMemo(
    () => controller ?? createSdkworkLogisticsController({
      ...(options?.locale ? { locale: options.locale } : {}),
      ...(options?.messages ? { messages: options.messages } : {}),
    }),
    [controller, options?.locale, options?.messages],
  );
}

function SdkworkLogisticsPageContent({
  controller: controllerProp,
  locale,
  messages,
}: SdkworkLogisticsPageContentProps) {
  const [searchParams] = useSearchParams();
  const controller = useSdkworkLogisticsController(controllerProp, { locale, messages });
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  );
  const { copy, formatTimestamp } = useSdkworkOrderIntl();
  const orderId = searchParams.get("orderId") ?? undefined;
  const shipmentId = searchParams.get("shipmentId") ?? undefined;

  useEffect(() => {
    if (!state.isBootstrapped && !state.isLoading) {
      void controller.bootstrap({ orderId, shipmentId });
    }
  }, [controller, orderId, shipmentId, state.isBootstrapped, state.isLoading]);

  return (
    <div className="relative h-full overflow-y-auto">
      <div className="relative px-4 py-4 sm:px-5 sm:py-5">
        <div className="mx-auto max-w-[64rem] space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--sdk-color-text-primary)]">
                {copy.logistics.pageTitle}
              </h1>
              <p className="mt-1 text-sm text-[var(--sdk-color-text-secondary)]">
                {copy.logistics.description}
              </p>
            </div>
            <Link to="/buyer/orders">
              <Button size="sm" type="button" variant="ghost">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                {copy.logistics.backToList}
              </Button>
            </Link>
          </div>

          {state.isLoading && !state.isBootstrapped ? (
            <LoadingBlock label={copy.logistics.loading} />
          ) : null}

          {state.lastError ? (
            <StatusNotice title={copy.logistics.errorTitle} tone="danger">
              {state.lastError}
            </StatusNotice>
          ) : null}

          {!state.lastError && !orderId && !shipmentId ? (
            <StatusNotice title={copy.logistics.errorTitle} tone="warning">
              {copy.logistics.orderMissing}
            </StatusNotice>
          ) : null}

          {state.isBootstrapped && !state.lastError && state.logistics.shipments.length === 0 && (orderId || shipmentId) ? (
            <div
              className="rounded-[1.5rem] border p-8"
              style={createSdkworkOrderPanelStyle("neutral", { backgroundWeight: 6, borderWeight: 16 })}
            >
              <EmptyState
                description={copy.logistics.noShipment}
                title={copy.logistics.pageTitle}
              />
            </div>
          ) : null}

          {state.logistics.shipments.map((shipment) => (
            <section
              className="overflow-hidden rounded-[1.5rem] border shadow-[var(--sdk-shadow-sm)]"
              key={shipment.shipmentId}
              style={createSdkworkOrderPanelStyle("neutral", { backgroundWeight: 6, borderWeight: 16 })}
            >
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--sdk-color-border-subtle)] px-6 py-4">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-[0.85rem] border"
                    style={createSdkworkOrderToneStyle("accent", { backgroundWeight: 16, borderWeight: 26 })}
                  >
                    <Truck className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-[var(--sdk-color-text-primary)]">
                      {shipment.shipmentNo
                        ? `${copy.logistics.shipmentNo}: ${shipment.shipmentNo}`
                        : shipment.shipmentId}
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--sdk-color-text-secondary)]">
                      {shipment.carrier ? `${copy.logistics.carrier}: ${shipment.carrier}` : null}
                      {shipment.carrier && shipment.statusLabel ? " · " : null}
                      {shipment.statusLabel || shipment.status || ""}
                    </div>
                  </div>
                </div>
                {shipment.packages.length > 0 ? (
                  <div className="flex items-center gap-2 text-xs text-[var(--sdk-color-text-secondary)]">
                    <Boxes className="h-4 w-4" />
                    {copy.logistics.packages}: {shipment.packages.map((pkg) => pkg.name || pkg.id).join("、")}
                  </div>
                ) : null}
              </header>

              <div className="px-6 py-5">
                {shipment.trackingEvents.length === 0 ? (
                  <EmptyState
                    description={copy.logistics.noShipment}
                    title={copy.logistics.trackingTitle}
                  />
                ) : (
                  <ol className="relative space-y-5 border-l border-[var(--sdk-color-border-subtle)] pl-6">
                    {shipment.trackingEvents.map((event, index) => (
                      <li className="relative" key={`${event.occurredAt ?? "event"}-${index}`}>
                        <span
                          className="absolute -left-[1.72rem] top-1.5 h-2.5 w-2.5 rounded-full border"
                          style={createSdkworkOrderToneStyle(index === 0 ? "accent" : "neutral", {
                            backgroundWeight: index === 0 ? 90 : 20,
                            borderWeight: index === 0 ? 40 : 30,
                          })}
                        />
                        <div className="text-sm font-medium text-[var(--sdk-color-text-primary)]">
                          {event.description}
                        </div>
                        <div className="mt-1 text-xs text-[var(--sdk-color-text-secondary)]">
                          {[event.status, event.occurredAt ? formatTimestamp(event.occurredAt) : ""]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SdkworkLogisticsPage({
  locale,
  messages,
  ...props
}: SdkworkLogisticsPageProps) {
  const content = (
    <SdkworkLogisticsPageContent
      {...props}
      locale={locale}
      messages={messages}
    />
  );

  if (locale || messages) {
    return (
      <SdkworkOrderIntlProvider locale={locale} messages={messages}>
        {content}
      </SdkworkOrderIntlProvider>
    );
  }

  return content;
}
