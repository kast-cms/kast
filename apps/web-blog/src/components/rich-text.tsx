interface RichTextProps {
  html: string;
}

/**
 * Renders sanitized rich-text HTML from the Kast CMS.
 * Content is sanitized at write-time by the API — this component
 * just applies prose styling via a CSS class.
 */
export function RichText({ html }: RichTextProps) {
  return (
    <div
      className="prose max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
