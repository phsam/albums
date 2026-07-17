import { describe, expect, it } from 'vitest';
import {
  assignBins,
  binIndexForArtist,
  computeRecordGeometry,
  groupByArtist,
  resolveOrder,
  toBinRecords,
} from '@/libs/CollectionBins';
import type { DiscogsCollectionItem } from '@/libs/Discogs';

function makeItem(overrides: {
  instanceId: number;
  releaseId: number;
  artist: string;
  title: string;
  year: number;
  cover?: string;
}): DiscogsCollectionItem {
  return {
    id: overrides.releaseId,
    instance_id: overrides.instanceId,
    rating: 0,
    date_added: '2024-01-01T00:00:00Z',
    basic_information: {
      id: overrides.releaseId,
      master_id: 0,
      title: overrides.title,
      year: overrides.year,
      thumb: '',
      cover_image: overrides.cover ?? 'https://i.discogs.com/cover.jpg',
      artists: [{ name: overrides.artist }],
      labels: [],
      formats: [],
      genres: [],
      styles: [],
      resource_url: '',
    },
  };
}

describe(toBinRecords, () => {
  it('maps discogs collection items to flat bin records', () => {
    const items = [
      makeItem({ instanceId: 1, releaseId: 10, artist: 'Bonobo', title: 'Migration', year: 2017 }),
    ];

    expect(toBinRecords(items)).toStrictEqual([
      {
        key: '1',
        releaseId: 10,
        artist: 'Bonobo',
        title: 'Migration',
        year: 2017,
        cover: 'https://i.discogs.com/cover.jpg',
      },
    ]);
  });
});

describe(groupByArtist, () => {
  it('groups records by case-insensitive artist name', () => {
    const records = toBinRecords([
      makeItem({ instanceId: 1, releaseId: 10, artist: 'Beach House', title: 'Bloom', year: 2012 }),
      makeItem({
        instanceId: 2,
        releaseId: 11,
        artist: 'beach house',
        title: 'Teen Dream',
        year: 2010,
      }),
    ]);

    const sections = groupByArtist(records);

    expect(sections).toHaveLength(1);
    expect(sections[0]?.records).toHaveLength(2);
  });

  it('sorts sections alphabetically ignoring a leading "The"', () => {
    const records = toBinRecords([
      makeItem({
        instanceId: 1,
        releaseId: 10,
        artist: 'The Beatles',
        title: 'Abbey Road',
        year: 1969,
      }),
      makeItem({
        instanceId: 2,
        releaseId: 11,
        artist: 'Arthur Verocai',
        title: 'Arthur Verocai',
        year: 1972,
      }),
    ]);

    const sections = groupByArtist(records);

    expect(sections.map((s) => s.artist)).toStrictEqual(['Arthur Verocai', 'The Beatles']);
  });
});

describe(binIndexForArtist, () => {
  it.each([
    ['Alice Coltrane', 0],
    ['Fela Kuti', 0],
    ['Grace Jones', 1],
    ['Nina Simone', 1],
    ['Portishead', 2],
    ['Yo La Tengo', 2],
  ])('assigns %s to bin %i', (artist, expected) => {
    expect(binIndexForArtist(artist)).toBe(expected);
  });

  it('sorts by name with a leading "The" stripped', () => {
    expect(binIndexForArtist('The Zombies')).toBe(binIndexForArtist('Zombies'));
  });
});

describe(assignBins, () => {
  it('splits sections into three labeled bins', () => {
    const sections = groupByArtist(
      toBinRecords([
        makeItem({
          instanceId: 1,
          releaseId: 10,
          artist: 'Bonobo',
          title: 'Migration',
          year: 2017,
        }),
        makeItem({
          instanceId: 2,
          releaseId: 11,
          artist: 'Grace Jones',
          title: 'Nightclubbing',
          year: 1981,
        }),
        makeItem({ instanceId: 3, releaseId: 12, artist: 'Radiohead', title: 'Kid A', year: 2000 }),
      ]),
    );

    const bins = assignBins(sections);

    expect(bins.map((b) => b.label)).toStrictEqual(['A–F', 'G–N', 'O–Z']);
    expect(bins[0]?.sections.map((s) => s.artist)).toStrictEqual(['Bonobo']);
    expect(bins[1]?.sections.map((s) => s.artist)).toStrictEqual(['Grace Jones']);
    expect(bins[2]?.sections.map((s) => s.artist)).toStrictEqual(['Radiohead']);
  });

  it('returns empty sections for bins with no matching artists', () => {
    const bins = assignBins([]);

    expect(bins.every((b) => b.sections.length === 0)).toBeTruthy();
  });
});

describe(resolveOrder, () => {
  it('appends records missing from the saved order', () => {
    const section = {
      key: 'x',
      artist: 'X',
      records: [{ key: 'a' }, { key: 'b' }, { key: 'c' }].map((r) => ({
        ...r,
        releaseId: 0,
        artist: 'X',
        title: '',
        year: 0,
        cover: '',
      })),
    };

    expect(resolveOrder(section, ['b'])).toStrictEqual(['b', 'a', 'c']);
  });

  it('drops saved keys no longer present in the section', () => {
    const section = {
      key: 'x',
      artist: 'X',
      records: [{ key: 'a', releaseId: 0, artist: 'X', title: '', year: 0, cover: '' }],
    };

    expect(resolveOrder(section, ['stale', 'a'])).toStrictEqual(['a']);
  });
});

describe(computeRecordGeometry, () => {
  const base = { colWidth: 210, stripHeight: 22, maxPeek: 3 };

  it('shows the front record as a full-width spine when closed', () => {
    const geometry = computeRecordGeometry({
      ...base,
      isOpen: false,
      isDisplay: true,
      orderIndex: 0,
      visibleCount: 0,
    });

    expect(geometry).toMatchObject({
      left: 0,
      top: 0,
      width: 210,
      height: 22,
      opacity: 1,
      interactive: true,
    });
  });

  it('hides non-front records when closed', () => {
    const geometry = computeRecordGeometry({
      ...base,
      isOpen: false,
      isDisplay: false,
      orderIndex: 2,
      visibleCount: 0,
    });

    expect(geometry.opacity).toBe(0);
    expect(geometry.interactive).toBeFalsy();
  });

  it('expands the display record into a full square when open', () => {
    const geometry = computeRecordGeometry({
      ...base,
      isOpen: true,
      isDisplay: true,
      orderIndex: 0,
      visibleCount: 3,
    });

    expect(geometry).toMatchObject({ left: 0, top: 66, width: 210, height: 210, opacity: 1 });
  });

  it('fans out peek records within maxPeek behind the display record', () => {
    const geometry = computeRecordGeometry({
      ...base,
      isOpen: true,
      isDisplay: false,
      orderIndex: 1,
      visibleCount: 3,
    });

    expect(geometry).toMatchObject({ left: 7, top: 44, opacity: 1, interactive: true });
  });

  it('hides peek records beyond maxPeek', () => {
    const geometry = computeRecordGeometry({
      ...base,
      isOpen: true,
      isDisplay: false,
      orderIndex: 5,
      visibleCount: 3,
    });

    expect(geometry.opacity).toBe(0);
    expect(geometry.interactive).toBeFalsy();
  });
});
