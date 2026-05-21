import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Image from 'next/image';
import { db } from '@/libs/DB';
import { getUserCollection } from '@/libs/Discogs';
import { Link } from '@/libs/I18nNavigation';
import { discogsTokensSchema } from '@/models/Schema';

type CollectionPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
};

export async function generateMetadata(props: CollectionPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'CollectionPage' });
  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function CollectionPage(props: CollectionPageProps) {
  const { locale } = await props.params;
  const { page = '1', sort = 'added' } = await props.searchParams;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'CollectionPage' });
  const { userId } = await auth();

  const tokenRow = userId
    ? await db.query.discogsTokensSchema.findFirst({
        where: eq(discogsTokensSchema.userId, userId),
      })
    : null;

  if (!tokenRow) {
    return (
      <div className="py-10 text-center">
        <p className="mb-6 text-gray-600">{t('connect_prompt')}</p>
        <Link
          href="/api/discogs/oauth/start"
          className="rounded bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          {t('connect_button')}
        </Link>
      </div>
    );
  }

  const collection = await getUserCollection(
    tokenRow.discogsUsername,
    tokenRow.accessToken,
    tokenRow.accessTokenSecret,
    { page, sort },
  );

  const { releases, pagination } = collection;

  return (
    <div className="py-8">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {t('connected_as', { username: tokenRow.discogsUsername })}
          {' · '}
          {t('total_records', { count: pagination.items })}
        </p>
        <div className="flex gap-3 text-sm">
          <span className="text-gray-500">{t('sort_label')}</span>
          {(['added', 'artist', 'title', 'year'] as const).map((s) => (
            <Link
              key={s}
              href={`/dashboard/collection?sort=${s}&page=1`}
              className={
                sort === s ? 'font-semibold text-gray-900' : 'text-gray-500 hover:text-gray-900'
              }
            >
              {t(`sort_${s}`)}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {releases.map((item) => {
          const info = item.basic_information;
          const artist = info.artists.map((a) => a.name).join(', ');
          return (
            <Link key={item.id} href={`/releases/${info.id}`} className="group block">
              <div className="relative aspect-square overflow-hidden rounded bg-gray-100">
                {info.cover_image ? (
                  <Image
                    src={info.cover_image}
                    alt={info.title}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                    className="object-cover transition-opacity group-hover:opacity-80"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-400">♪</div>
                )}
              </div>
              <p className="mt-2 truncate text-sm font-medium text-gray-900">{info.title}</p>
              <p className="truncate text-xs text-gray-500">{artist}</p>
              {info.year > 0 && <p className="text-xs text-gray-400">{info.year}</p>}
            </Link>
          );
        })}
      </div>

      {pagination.pages > 1 && (
        <div className="mt-8 flex justify-center gap-4">
          {pagination.page > 1 && (
            <Link
              href={`/dashboard/collection?page=${pagination.page - 1}&sort=${sort}`}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              {t('prev')}
            </Link>
          )}
          <span className="text-sm text-gray-500">
            {t('page_of', { page: pagination.page, pages: pagination.pages })}
          </span>
          {pagination.page < pagination.pages && (
            <Link
              href={`/dashboard/collection?page=${pagination.page + 1}&sort=${sort}`}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              {t('next')}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
