export function buildEntryUrl(
  siteUrl: string,
  contentTypeName: string,
  slug: string,
  localeCode: string,
  defaultCode: string,
): string {
  const prefix = localeCode === defaultCode ? '' : `/${localeCode}`;
  return `${siteUrl}${prefix}/${contentTypeName}/${slug}`;
}
