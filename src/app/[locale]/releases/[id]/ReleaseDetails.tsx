import type { DiscogsRelease } from '@/libs/Discogs';

type ReleaseDetailsProps = {
  release: DiscogsRelease;
  labels: {
    year: string;
    country: string;
    label: string;
    format: string;
    genre: string;
    style: string;
    community: string;
  };
  communityText?: string;
};

export function ReleaseDetails(props: ReleaseDetailsProps) {
  return (
    <dl className="mt-4 space-y-1 text-sm text-gray-600">
      {props.release.year > 0 && (
        <div className="flex gap-2">
          <dt className="font-medium text-gray-900">{props.labels.year}</dt>
          <dd>{props.release.year}</dd>
        </div>
      )}
      {props.release.country && (
        <div className="flex gap-2">
          <dt className="font-medium text-gray-900">{props.labels.country}</dt>
          <dd>{props.release.country}</dd>
        </div>
      )}
      {props.release.labels?.length > 0 && (
        <div className="flex gap-2">
          <dt className="font-medium text-gray-900">{props.labels.label}</dt>
          <dd>{props.release.labels.map((l) => `${l.name} — ${l.catno}`).join(', ')}</dd>
        </div>
      )}
      {props.release.formats?.length > 0 && (
        <div className="flex gap-2">
          <dt className="font-medium text-gray-900">{props.labels.format}</dt>
          <dd>
            {props.release.formats
              .map((f) => [f.name, ...(f.descriptions ?? [])].join(', '))
              .join(' / ')}
          </dd>
        </div>
      )}
      {props.release.genres?.length > 0 && (
        <div className="flex gap-2">
          <dt className="font-medium text-gray-900">{props.labels.genre}</dt>
          <dd>{props.release.genres.join(', ')}</dd>
        </div>
      )}
      {props.release.styles?.length > 0 && (
        <div className="flex gap-2">
          <dt className="font-medium text-gray-900">{props.labels.style}</dt>
          <dd>{props.release.styles.join(', ')}</dd>
        </div>
      )}
      {props.release.community && props.communityText && (
        <div className="flex gap-2">
          <dt className="font-medium text-gray-900">{props.labels.community}</dt>
          <dd>{props.communityText}</dd>
        </div>
      )}
    </dl>
  );
}
