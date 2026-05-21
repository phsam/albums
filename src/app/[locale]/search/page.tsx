import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Image from 'next/image';
import { searchReleases } from '@/libs/Discogs';
import { Link } from '@/libs/I18nNavigation';

type SearchPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
};

export async function generateMetadata(props: SearchPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'SearchPage' });
  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function SearchPage(props: SearchPageProps) {
  const { locale } = await props.params;
  const { q = '', page = '1' } = await props.searchParams;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'SearchPage' });

  const results = q ? await searchReleases(q, { page }) : null;

  return (
    <div className="py-8">
      <form method="GET" className="mb-8 flex gap-3">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={t('placeholder')}
          className="flex-1 rounded border border-gray-300 px-4 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded bg-black px-5 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          {t('search_button')}
        </button>
      </form>

      {results && (
        <>
          <p className="mb-4 text-sm text-gray-500">
            {t('results_count', { count: results.pagination.items })}
          </p>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {results.results
              .filter((r, i, arr) => {
                const key = r.master_url ?? String(r.id);
                return arr.findIndex((x) => (x.master_url ?? String(x.id)) === key) === i;
              })
              .map((release) => (
                <Link key={release.id} href={`/releases/${release.id}`} className="group block">
                  <div className="relative aspect-square overflow-hidden rounded bg-gray-100">
                    {release.cover_image ? (
                      <Image
                        src={release.cover_image}
                        alt={release.title}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                        className="object-cover transition-opacity group-hover:opacity-80"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-400">♪</div>
                    )}
                  </div>
                  <p className="mt-2 truncate text-sm font-medium text-gray-900">{release.title}</p>
                  {release.year && <p className="text-xs text-gray-500">{release.year}</p>}
                  {release.label && release.label.length > 0 && (
                    <p className="truncate text-xs text-gray-400">{release.label[0]}</p>
                  )}
                </Link>
              ))}
          </div>

          {results.pagination.pages > 1 && (
            <div className="mt-8 flex justify-center gap-4">
              {results.pagination.page > 1 && (
                <Link
                  href={`/search?q=${encodeURIComponent(q)}&page=${results.pagination.page - 1}`}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  {t('prev')}
                </Link>
              )}
              <span className="text-sm text-gray-500">
                {t('page_of', { page: results.pagination.page, pages: results.pagination.pages })}
              </span>
              {results.pagination.page < results.pagination.pages && (
                <Link
                  href={`/search?q=${encodeURIComponent(q)}&page=${results.pagination.page + 1}`}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  {t('next')}
                </Link>
              )}
            </div>
          )}
        </>
      )}

      {!results && <p className="text-center text-gray-400">{t('empty_state')}</p>}
    </div>
  );
}
