import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Image from 'next/image';
import { ReleaseDetails } from '@/app/[locale]/releases/[id]/ReleaseDetails';
import { getRelease } from '@/libs/Discogs';
import { Link } from '@/libs/I18nNavigation';

type ReleasePageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata(props: ReleasePageProps): Promise<Metadata> {
  const { id } = await props.params;
  const release = await getRelease(id);
  return {
    title: release.title,
    description: `${release.artists?.map((a) => a.name).join(', ')} — ${release.year}`,
  };
}

export default async function ReleasePage(props: ReleasePageProps) {
  const { locale, id } = await props.params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'ReleasePage' });
  const release = await getRelease(id);

  const primaryImage = release.images?.find((img) => img.type === 'primary') ?? release.images?.[0];
  const artists = release.artists?.map((a) => a.anv ?? a.name).join(', ') ?? '';

  return (
    <div className="px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-900">
          {t('back_link')}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-gray-900">{release.title}</span>
      </nav>

      <div className="flex flex-col gap-8 sm:flex-row">
        <div className="shrink-0">
          {primaryImage ? (
            <div className="relative h-64 w-64 overflow-hidden rounded">
              <Image
                src={primaryImage.uri}
                alt={release.title}
                fill
                sizes="256px"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="flex h-64 w-64 items-center justify-center rounded bg-gray-100 text-5xl text-gray-300">
              ♪
            </div>
          )}
        </div>

        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{release.title}</h1>
          {artists && <p className="mt-1 text-lg text-gray-600">{artists}</p>}

          <ReleaseDetails
            release={release}
            labels={{
              year: t('year'),
              country: t('country'),
              label: t('label'),
              format: t('format'),
              genre: t('genre'),
              style: t('style'),
              community: t('community'),
            }}
            communityText={
              release.community
                ? t('have_want', {
                    have: release.community.have,
                    want: release.community.want,
                  })
                : undefined
            }
          />
        </div>
      </div>

      {release.tracklist?.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">{t('tracklist')}</h2>
          <ol className="divide-y divide-gray-100">
            {release.tracklist.map((track, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-sm">
                <div className="flex gap-3">
                  <span className="w-8 text-right text-gray-400">{track.position}</span>
                  <span className="text-gray-900">{track.title}</span>
                </div>
                {track.duration && <span className="text-gray-400">{track.duration}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {release.notes && (
        <div className="mt-8">
          <h2 className="mb-2 text-lg font-semibold text-gray-900">{t('notes')}</h2>
          <p className="text-sm whitespace-pre-line text-gray-600">{release.notes}</p>
        </div>
      )}
    </div>
  );
}
