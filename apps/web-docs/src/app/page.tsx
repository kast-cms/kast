import { buildSidebar } from '@/lib/content';
import { redirect } from 'next/navigation';

export const revalidate = 60;

export default async function HomePage(): Promise<React.JSX.Element> {
  const sidebar = await buildSidebar();
  // Redirect to first doc page if available
  const firstCat = sidebar[0];
  const first = firstCat?.items[0];
  if (firstCat && first) {
    redirect(`/docs/${first.categorySlug}/${first.slug}`);
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Welcome to the docs</h1>
        <p className="text-gray-500">No documentation pages found yet.</p>
        <p className="mt-2 text-sm text-gray-400">
          Run{' '}
          <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono">
            pnpm seed
          </code>{' '}
          to create the initial content types.
        </p>
      </div>
    </div>
  );
}
