interface RichTextProps {
  html: string;
}

/**
 * Renders sanitized rich-text HTML from Kast CMS.
 * Content is sanitized at write-time by the API.
 */
export function RichText({ html }: RichTextProps) {
  return (
    <div
      className="prose max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
