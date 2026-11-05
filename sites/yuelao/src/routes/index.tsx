import { createFileRoute } from '@tanstack/react-router';
import { pageHead } from '@yuelao/core/seo';
import { m } from '~/paraglide/messages.js';
import site from '../../site.config';

// P0 skeleton homepage: the 問事總目 layout with the four categories.
// Ritual entries are static for now (no dead links); P1 wires them to /ritual.
export const Route = createFileRoute('/')({
  head: () =>
    pageHead(site, {
      title: m.home_meta_title({ name: site.name }),
      description: m.home_meta_description(),
      path: '/',
      jsonLd: [
        {
          '@type': 'WebApplication',
          name: site.name,
          url: site.url,
          applicationCategory: 'LifestyleApplication',
          operatingSystem: 'Web',
        },
      ],
    }),
  component: HomePage,
});

const CATEGORIES = [
  { key: 'him', title: () => m.home_category_him(), desc: () => m.home_category_him_desc() },
  { key: 'single', title: () => m.home_category_single(), desc: () => m.home_category_single_desc() },
  { key: 'reunion', title: () => m.home_category_reunion(), desc: () => m.home_category_reunion_desc() },
  { key: 'daily', title: () => m.home_category_daily(), desc: () => m.home_category_daily_desc() },
] as const;

function HomePage() {
  return (
    <>
      <section className="hero">
        <h1>{m.home_title()}</h1>
        <p className="lead">{m.home_lead()}</p>
      </section>
      <section className="categories">
        <h2>{m.home_categories_heading()}</h2>
        <div className="category-grid">
          {CATEGORIES.map((c) => (
            <article key={c.key} className="category-card">
              <h3>{c.title()}</h3>
              <p>{c.desc()}</p>
              <span className="soon">{m.home_coming_soon()}</span>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
