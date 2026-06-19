export interface SitemapLocaleUrl {
  hreflang: string;
  href: string;
}

export interface SitemapEntry {
  /** Canonical URL used for the <loc> element. */
  loc: string;
  lastmod: Date;
  /** Per-locale alternates for hreflang annotations (may be empty). */
  alternates: SitemapLocaleUrl[];
}

export function buildSitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map((e) => {
      const lastmod = e.lastmod.toISOString().split('T')[0] ?? '';
      const lines = [
        '  <url>',
        `    <loc>${escapeXml(e.loc)}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
      ];
      for (const alt of e.alternates) {
        lines.push(
          `    <xhtml:link rel="alternate" hreflang="${escapeXml(alt.hreflang)}" href="${escapeXml(alt.href)}"/>`,
        );
      }
      lines.push('  </url>');
      return lines.join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    urls,
    '</urlset>',
  ].join('\n');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
