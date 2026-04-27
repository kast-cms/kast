export function buildSitemapXml(entries: Array<{ canonicalUrl: string; updatedAt: Date }>): string {
  const urls = entries
    .map((e) => {
      const lastmod = e.updatedAt.toISOString().split('T')[0] ?? '';
      return [
        '  <url>',
        `    <loc>${escapeXml(e.canonicalUrl)}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        '  </url>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
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
