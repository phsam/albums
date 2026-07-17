import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CollectionView } from '@/components/CollectionView';
import { db } from '@/libs/DB';
import { getUserCollection } from '@/libs/Discogs';
import { Link } from '@/libs/I18nNavigation';
import { discogsTokensSchema } from '@/models/Schema';

type CollectionPageProps = {
  params: Promise<{ locale: string }>;
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
    { perPage: '100' },
  );

  const seenInstances = new Set<number>();
  const uniqueReleases = collection.releases.filter((r) => {
    if (seenInstances.has(r.instance_id)) {
      return false;
    }
    seenInstances.add(r.instance_id);
    return true;
  });

  const avatarInitial = tokenRow.discogsUsername.charAt(0).toUpperCase();

  return (
    <div className="px-6 py-7">
      <header className="mb-6 flex items-center gap-3.5">
        <div className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-vinyl-gold text-[17px] font-bold text-vinyl-gold-foreground">
          {avatarInitial}
        </div>
        <div className="min-w-0">
          <div className="text-base leading-tight font-semibold">
            {t('header_title', { username: tokenRow.discogsUsername })}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {t('header_subtitle', {
              username: tokenRow.discogsUsername,
              count: collection.pagination.items,
            })}
          </div>
        </div>
      </header>

      <CollectionView
        initialReleases={uniqueReleases}
        totalCount={collection.pagination.items}
        totalPages={collection.pagination.pages}
      />
    </div>
  );
}
