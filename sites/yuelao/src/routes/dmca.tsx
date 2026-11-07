import { createFileRoute } from '@tanstack/react-router';
import { pageHead } from '@yuelao/core/seo';
import { m } from '~/paraglide/messages.js';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import { LegalPage } from '~/site/legal';
import site from '../../site.config';

export const Route = createFileRoute('/dmca')({
  head: () =>
    pageHead(site, {
      title: m.legal_dmca_meta_title({ siteName: site.name }),
      description: m.legal_dmca_meta_description({ siteName: site.name }),
      path: localizeHref('/dmca', { locale: getLocale() }),
    }),
  component: DmcaPage,
});

function DmcaPage() {
  return (
    <LegalPage title={m.legal_dmca_title()} intro={m.legal_dmca_intro({ siteName: site.name })}>
      <h2>{m.legal_dmca_heading()}</h2>
      <p>{m.legal_dmca_body()}</p>
    </LegalPage>
  );
}
