import type { ReactNode } from "react";
import { Inbox, type LucideIcon } from "lucide-react";

/**
 * Shared empty state for list and detail surfaces.
 *
 * Every page used to render a bare `div` with one line of text, so "no rows"
 * looked like a rendering failure and the tone differed page by page. This
 * primitive keeps one flat, calm composition everywhere: a muted glyph, a
 * short headline, an optional hint and an optional action.
 */
export interface SdkworkMallH5EmptyStateProps {
  /** Optional call to action (a Link, a button, or a retry control). */
  action?: ReactNode;
  /**
   * Headline for copy that already lives in a catalogue. Surfaces whose copy is
   * still authored inline pass it as children instead, so the migration to
   * catalogue keys happens page by page.
   */
  children?: ReactNode;
  /** Muted second line, already localised. */
  hint?: string;
  /** Glyph above the title; defaults to a neutral inbox. */
  icon?: LucideIcon;
  /** Short, already localised headline. */
  title?: string;
}

export function SdkworkMallH5EmptyState({
  action,
  children,
  hint,
  icon: Icon = Inbox,
  title,
}: SdkworkMallH5EmptyStateProps) {
  const headline = title ?? children;
  return (
    <div className="sdk-h5-empty-state" role="status">
      <span aria-hidden="true" className="sdk-h5-empty-state-icon">
        <Icon size={26} />
      </span>
      {headline ? <p className="sdk-h5-empty-state-title">{headline}</p> : null}
      {hint ? <p className="sdk-h5-empty-state-hint">{hint}</p> : null}
      {action ? <div className="sdk-h5-empty-state-action">{action}</div> : null}
    </div>
  );
}
