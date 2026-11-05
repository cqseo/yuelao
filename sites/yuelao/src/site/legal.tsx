import type { ReactNode } from 'react';
import { m } from '~/paraglide/messages.js';
import site from '../../site.config';

// Shared layout for the privacy, terms, refunds and DMCA pages. Text lives in messages/legal.
export const SUPPORT_EMAIL = site.supportEmail;

export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <article className="legal">
      <h1>{title}</h1>
      <p className="muted">{m.common_legal_updated({ date: m.common_legal_policy_date() })}</p>
      <p>{intro}</p>
      {children}
      <p>
        {m.common_legal_questions()} <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>。
      </p>
    </article>
  );
}
