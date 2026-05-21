import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CollectionView } from '@/components/CollectionView';
import { db } from '@/libs/DB';
import { getUserCollection } from '@/libs/Discogs';

type IndexPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: IndexPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'Index',
  });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function IndexPage(props: IndexPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Index' });

  const tokenRow = await db.query.discogsTokensSchema.findFirst();

  if (!tokenRow) {
    return <p className="px-4 py-10 text-center text-gray-500">{t('no_collection')}</p>;
  }

  const collection = await getUserCollection(
    tokenRow.discogsUsername,
    tokenRow.accessToken,
    tokenRow.accessTokenSecret,
    { page: '1', perPage: '100' },
  );

  const seenInstances = new Set<number>();
  const uniqueReleases = collection.releases.filter((r) => {
    if (seenInstances.has(r.instance_id)) {
      return false;
    }
    seenInstances.add(r.instance_id);
    return true;
  });

  return (
    <CollectionView
      initialReleases={uniqueReleases}
      totalCount={collection.pagination.items}
      totalPages={collection.pagination.pages}
    />
  );
}
