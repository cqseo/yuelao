import { createFileRoute } from '@tanstack/react-router';
import { pageHead } from '@yuelao/core/seo';
import { m } from '~/paraglide/messages.js';
import { LegalPage } from '~/site/legal';
import site from '../../site.config';

export const Route = createFileRoute('/terms')({
  head: () =>
    pageHead(site, {
      title: m.legal_terms_meta_title({ siteName: site.name }),
      description: m.legal_terms_meta_description({ siteName: site.name }),
      path: '/terms',
    }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage title={m.legal_terms_title()} intro={m.legal_terms_intro({ siteName: site.name })}>
      <h2>{m.legal_terms_use_heading()}</h2>
      <p>{m.legal_terms_use_body()}</p>

      <h2>{m.legal_terms_content_heading()}</h2>
      <p>{m.legal_terms_body()}</p>

      <h2>{m.legal_terms_payment_heading()}</h2>
      <p>{m.legal_terms_payment_body()}</p>

      <h2>{m.legal_terms_liability_heading()}</h2>
      <p>{m.legal_terms_liability_body()}</p>
    </LegalPage>
  );
}
