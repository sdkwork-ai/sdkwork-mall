/**
 * Mini-program i18n runtime.
 *
 * Copy is authored as plain-object fragments under
 * `src/i18n/<locale>/<domain>/<capability>/messages.js` (with a sibling
 * `messages.d.ts` for typing). The fragments are flattened once at module load
 * into `a.b.c` keys; `t()` is synchronous and degrades to the key when a message
 * is missing. JavaScript rather than JSON because the mini-program module system
 * resolves only JavaScript at runtime.
 */
import buyerHub from "./zh-CN/account/buyer-hub/messages";
import messagesFragment from "./zh-CN/account/messages/messages";
import invoices from "./zh-CN/account/invoices/messages";
import membership from "./zh-CN/account/membership/messages";
import partner from "./zh-CN/account/partner/messages";
import checkout from "./zh-CN/checkout/confirm-order/messages";
import cashier from "./zh-CN/checkout/cashier/messages";
import paymentResult from "./zh-CN/checkout/payment-result/messages";
import help from "./zh-CN/support/help/messages";
import afterSales from "./zh-CN/support/after-sales/messages";
import home from "./zh-CN/storefront/home/messages";
import orderList from "./zh-CN/order/list/messages";

const messages: Record<string, string> = {};

function collect(node: Record<string, unknown>, prefix: string): void {
  for (const key of Object.keys(node)) {
    const value = node[key];
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object") {
      collect(value as Record<string, unknown>, path);
    } else if (value !== null && value !== undefined) {
      messages[path] = String(value);
    }
  }
}

collect(buyerHub as Record<string, unknown>, "");
collect(messagesFragment as Record<string, unknown>, "");
collect(invoices as Record<string, unknown>, "");
collect(membership as Record<string, unknown>, "");
collect(partner as Record<string, unknown>, "");
collect(checkout as Record<string, unknown>, "");
collect(cashier as Record<string, unknown>, "");
collect(paymentResult as Record<string, unknown>, "");
collect(help as Record<string, unknown>, "");
collect(afterSales as Record<string, unknown>, "");
collect(home as Record<string, unknown>, "");
collect(orderList as Record<string, unknown>, "");

/** Resolves `key` with `{{name}}` placeholder interpolation. */
export function t(
  key: string,
  params?: Record<string, string | number>,
): string {
  let value = messages[key] ?? key;
  if (params) {
    for (const name of Object.keys(params)) {
      value = value.split(`{{${name}}}`).join(String(params[name]));
    }
  }
  return value;
}

/** True when the catalogue carries the key (used by tests and tooling). */
export function hasMessage(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(messages, key);
}
