import type { DiscogsCollectionItem } from '@/libs/Discogs';

export type BinRecord = {
  key: string;
  releaseId: number;
  artist: string;
  title: string;
  year: number;
  cover: string;
};

export type BinSection = {
  key: string;
  artist: string;
  records: BinRecord[];
};

export type Bin = {
  label: string;
  sections: BinSection[];
  count: number;
};

export type RecordGeometry = {
  left: number;
  top: number;
  width: number;
  height: number;
  zIndex: number;
  opacity: number;
  interactive: boolean;
};

const BIN_LABELS = ['A–F', 'G–N', 'O–Z'];
const PEEK_STEP = 7;

function sortableName(artist: string): string {
  return artist.replace(/^The /iu, '');
}

export function toBinRecords(items: DiscogsCollectionItem[]): BinRecord[] {
  return items.map((item) => ({
    key: String(item.instance_id),
    releaseId: item.basic_information.id,
    artist: item.basic_information.artists.map((a) => a.name).join(', '),
    title: item.basic_information.title,
    year: item.basic_information.year,
    cover: item.basic_information.cover_image,
  }));
}

export function groupByArtist(records: BinRecord[]): BinSection[] {
  const byArtist = new Map<string, BinSection>();
  for (const record of records) {
    const key = record.artist.toLowerCase();
    const section = byArtist.get(key);
    if (section) {
      section.records.push(record);
    } else {
      byArtist.set(key, { key, artist: record.artist, records: [record] });
    }
  }
  return [...byArtist.values()].toSorted((a, b) =>
    sortableName(a.artist).localeCompare(sortableName(b.artist)),
  );
}

export function binIndexForArtist(artist: string): number {
  const letter = sortableName(artist).charAt(0).toUpperCase();
  if (letter <= 'F') {
    return 0;
  }
  if (letter <= 'N') {
    return 1;
  }
  return 2;
}

export function assignBins(sections: BinSection[]): Bin[] {
  return BIN_LABELS.map((label, index) => {
    const binSections = sections.filter((section) => binIndexForArtist(section.artist) === index);
    return {
      label,
      sections: binSections,
      count: binSections.reduce((n, section) => n + section.records.length, 0),
    };
  });
}

/**
 * Resolves the ordered record keys for a section: the caller's saved promotions
 * first (minus any records no longer in the section), then any remaining
 * records in their original order.
 * @param section - The bin section whose records are being ordered.
 * @param savedOrder - Previously promoted record keys, most-recent first.
 * @returns The full list of record keys in display order.
 */
export function resolveOrder(section: BinSection, savedOrder: string[]): string[] {
  const order = savedOrder.filter((key) => section.records.some((r) => r.key === key));
  for (const record of section.records) {
    if (!order.includes(record.key)) {
      order.push(record.key);
    }
  }
  return order;
}

/**
 * Absolute-position geometry for one record within an open or closed section
 * stack. Mirrors the crate-digging metaphor: closed sections show only the
 * front record as a thin spine; open sections fan the next `maxPeek` records
 * out behind a full-size cover, each peek step nudged over by `PEEK_STEP`px.
 * @param input - The record's open/display state and the section's layout metrics.
 * @returns The record's left, top, width, height, stacking, and visibility.
 */
export function computeRecordGeometry(input: {
  isOpen: boolean;
  isDisplay: boolean;
  orderIndex: number;
  visibleCount: number;
  colWidth: number;
  stripHeight: number;
  maxPeek: number;
}): RecordGeometry {
  const hiddenWidth = input.colWidth - (input.maxPeek + 1) * (PEEK_STEP * 2);

  if (!input.isOpen) {
    return input.isDisplay
      ? {
          left: 0,
          top: 0,
          width: input.colWidth,
          height: input.stripHeight,
          zIndex: 50,
          opacity: 1,
          interactive: true,
        }
      : {
          left: (input.maxPeek + 1) * PEEK_STEP,
          top: 0,
          width: hiddenWidth,
          height: input.stripHeight,
          zIndex: 1,
          opacity: 0,
          interactive: false,
        };
  }

  if (input.isDisplay) {
    return {
      left: 0,
      top: input.visibleCount * input.stripHeight,
      width: input.colWidth,
      height: input.colWidth,
      zIndex: 50,
      opacity: 1,
      interactive: true,
    };
  }

  const peekIndex = input.orderIndex - 1;
  if (peekIndex < input.visibleCount) {
    return {
      left: (peekIndex + 1) * PEEK_STEP,
      top: (input.visibleCount - 1 - peekIndex) * input.stripHeight,
      width: input.colWidth - (peekIndex + 1) * (PEEK_STEP * 2),
      height: input.stripHeight,
      zIndex: 40 - peekIndex,
      opacity: 1,
      interactive: true,
    };
  }

  return {
    left: (input.maxPeek + 1) * PEEK_STEP,
    top: 0,
    width: hiddenWidth,
    height: input.stripHeight,
    zIndex: 2,
    opacity: 0,
    interactive: false,
  };
}
