import { useState } from "react";
import { Button } from "@sdkwork/ui-pc-react";
import { Copy, Link2, ShieldCheck, ShieldX } from "lucide-react";

import {
  buildSdkworkPartnerInviteLink,
  type SdkworkPartnerInviteCodePreview,
} from "@sdkwork/mall-partner-service";

import type { SdkworkPartnerIntlValue } from "../partner-intl.ts";

export interface SdkworkPartnerInviteCardProps {
  readonly intl: SdkworkPartnerIntlValue;
  readonly isValidating: boolean;
  readonly onValidate: (code: string) => Promise<SdkworkPartnerInviteCodePreview | null>;
  readonly ownedInviteCode?: string;
  readonly preview: SdkworkPartnerInviteCodePreview | null;
}

export function SdkworkPartnerInviteCard({
  intl,
  isValidating,
  onValidate,
  ownedInviteCode,
  preview,
}: SdkworkPartnerInviteCardProps) {
  const { copy } = intl;
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  const shareLink = ownedInviteCode
    ? buildSdkworkPartnerInviteLink(resolveShareOrigin(), ownedInviteCode)
    : "";

  const copyShareLink = async (): Promise<void> => {
    if (!shareLink || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
  };

  return (
    <section
      className="rounded-[var(--sdk-radius-panel)] border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] p-4 shadow-[var(--sdk-shadow-sm)]"
      data-slot="partner-invite"
    >
      <header className="flex items-start gap-2">
        <Link2 aria-hidden="true" className="mt-0.5 text-[var(--sdk-color-brand-primary)]" size={18} />
        <div>
          <h2 className="text-base font-semibold text-[var(--sdk-color-text-primary)]">
            {copy.invite.title}
          </h2>
          <p className="text-sm text-[var(--sdk-color-text-secondary)]">
            {copy.invite.description}
          </p>
        </div>
      </header>

      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void onValidate(code);
        }}
      >
        <label className="sr-only" htmlFor="sdkwork-partner-invite-code">
          {copy.invite.placeholder}
        </label>
        <input
          className="h-10 flex-1 rounded-[var(--sdk-radius-control)] border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] px-3 text-sm text-[var(--sdk-color-text-primary)] outline-none focus:border-[var(--sdk-color-border-focus)]"
          id="sdkwork-partner-invite-code"
          onChange={(event) => setCode(event.target.value)}
          placeholder={copy.invite.placeholder}
          value={code}
        />
        <Button disabled={!code.trim()} loading={isValidating} type="submit">
          {copy.actions.validate}
        </Button>
      </form>

      {preview ? (
        <div
          className={`mt-3 flex items-start gap-2 rounded-[var(--sdk-radius-control)] border px-3 py-2 text-sm ${
            preview.valid
              ? "border-[color-mix(in_srgb,var(--sdk-color-state-success)_30%,transparent)] bg-[color-mix(in_srgb,var(--sdk-color-state-success)_10%,transparent)]"
              : "border-[color-mix(in_srgb,var(--sdk-color-state-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--sdk-color-state-danger)_10%,transparent)]"
          }`}
          role="status"
        >
          {preview.valid ? (
            <ShieldCheck aria-hidden="true" className="mt-0.5 text-[var(--sdk-color-state-success)]" size={16} />
          ) : (
            <ShieldX aria-hidden="true" className="mt-0.5 text-[var(--sdk-color-state-danger)]" size={16} />
          )}
          <div>
            <p className="font-medium">
              {preview.valid ? copy.invite.valid : copy.invite.invalid}
            </p>
            {preview.valid ? (
              <p className="text-[var(--sdk-color-text-secondary)]">
                {copy.invite.inviter}: {preview.partnerName || "—"}
                {preview.levelNo !== null ? ` · ${copy.invite.level} ${preview.levelNo}` : ""}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {shareLink ? (
        <div className="mt-3 rounded-[var(--sdk-radius-control)] border border-dashed border-[var(--sdk-color-border-subtle)] p-3">
          <p className="text-xs text-[var(--sdk-color-text-secondary)]">
            {copy.center.inviteCode}: <span className="font-semibold">{ownedInviteCode}</span>
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-[var(--sdk-color-surface-panel-muted)] px-2 py-1 text-xs">
              {shareLink}
            </code>
            <Button onClick={() => void copyShareLink()} size="sm" variant="outline">
              <Copy aria-hidden="true" size={14} />
              {copied ? copy.actions.copied : copy.actions.copy}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function resolveShareOrigin(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.location.origin;
}
