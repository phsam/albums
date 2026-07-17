'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import {
  assignBins,
  computeRecordGeometry,
  groupByArtist,
  resolveOrder,
  toBinRecords,
} from '@/libs/CollectionBins';
import type { DiscogsCollectionItem } from '@/libs/Discogs';
import { Link } from '@/libs/I18nNavigation';

const MAX_PEEK = 3;
const STRIP_HEIGHT = 22;
const CAPTION_HEIGHT = 58;
const NARROW_BREAKPOINT = 700;
const BIN_GAP = 24;
const TRANSITION = ['left', 'top', 'width', 'height', 'opacity', 'border-radius']
  .map((property) => `${property} 250ms cubic-bezier(0.4, 0, 0.2, 1)`)
  .join(', ');
const TAB_OFFSETS = [0, 30, 56];

type CollectionBinsProps = {
  items: DiscogsCollectionItem[];
};

export function CollectionBins(props: CollectionBinsProps) {
  const t = useTranslations('CollectionPage');
  const [width, setWidth] = useState(1128);
  const [openByBin, setOpenByBin] = useState<Record<number, string | null>>({});
  const [orderBySection, setOrderBySection] = useState<Record<string, string[]>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    let observer: ResizeObserver | undefined;
    if (el) {
      observer = new ResizeObserver((entries) => {
        const measured = entries[0]?.contentRect.width;
        if (measured) {
          setWidth(measured);
        }
      });
      observer.observe(el);
    }
    return () => {
      observer?.disconnect();
    };
  }, []);

  function toggleSection(binIndex: number, sectionKey: string) {
    setOpenByBin((prev) => ({
      ...prev,
      [binIndex]: prev[binIndex] === sectionKey ? null : sectionKey,
    }));
  }

  function promoteRecord(sectionKey: string, order: string[], recordKey: string) {
    setOrderBySection((prev) => ({
      ...prev,
      [sectionKey]: [recordKey, ...order.filter((key) => key !== recordKey)],
    }));
  }

  const bins = assignBins(groupByArtist(toBinRecords(props.items)));
  const cols = width < NARROW_BREAKPOINT ? 1 : 3;
  const colWidth = cols === 1 ? width : (width - BIN_GAP * 2) / 3;

  return (
    <div
      ref={containerRef}
      className="grid items-start gap-6"
      style={{ gridTemplateColumns: cols === 1 ? '1fr' : '1fr 1fr 1fr' }}
    >
      {bins.map((bin, binIndex) => (
        <div key={bin.label}>
          <div className="mb-3.5 font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
            {t('bin_label', { range: bin.label, count: bin.count })}
          </div>
          <div className="flex flex-col gap-6">
            {bin.sections.map((section, sectionIndex) => {
              const isOpen = openByBin[binIndex] === section.key;
              const order = resolveOrder(section, orderBySection[section.key] ?? []);
              const [displayKey] = order;
              const displayRecord = section.records.find((r) => r.key === displayKey);
              const recordCount = section.records.length;
              const visibleCount = isOpen ? Math.min(MAX_PEEK, recordCount - 1) : 0;
              const moreCount = isOpen ? Math.max(0, recordCount - 1 - visibleCount) : 0;
              const sectionHeight = isOpen
                ? visibleCount * STRIP_HEIGHT + colWidth + CAPTION_HEIGHT
                : STRIP_HEIGHT;
              const captionTop = isOpen ? visibleCount * STRIP_HEIGHT + colWidth : STRIP_HEIGHT;
              const tabOffset = TAB_OFFSETS[sectionIndex % TAB_OFFSETS.length];

              return (
                <div key={section.key}>
                  <button
                    type="button"
                    onClick={() => {
                      toggleSection(binIndex, section.key);
                    }}
                    className="flex max-w-[68%] items-center gap-2 rounded-t-lg bg-muted px-3 pt-1.5 pb-1.5 hover:bg-black/5 dark:hover:bg-white/10"
                    style={{ marginLeft: `${tabOffset}%` }}
                  >
                    <span className="truncate text-[13px] font-semibold">{section.artist}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {recordCount}
                    </span>
                  </button>
                  <div className="mb-2.5 h-0.5 rounded-full bg-border" />

                  <div
                    className="relative"
                    style={{
                      height: sectionHeight,
                      transition: 'height 250ms cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    {moreCount > 0 && (
                      <div
                        className="pointer-events-none absolute top-0.5 right-2 z-[70] rounded-full bg-vinyl-gold px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-vinyl-gold-foreground"
                        style={{ transition: TRANSITION }}
                      >
                        {t('more_count', { count: moreCount })}
                      </div>
                    )}

                    {section.records.map((record) => {
                      const orderIndex = order.indexOf(record.key);
                      const isDisplay = record.key === displayKey;
                      const geometry = computeRecordGeometry({
                        isOpen,
                        isDisplay,
                        orderIndex,
                        visibleCount,
                        colWidth,
                        stripHeight: STRIP_HEIGHT,
                        maxPeek: MAX_PEEK,
                      });
                      const style: React.CSSProperties = {
                        left: geometry.left,
                        top: geometry.top,
                        width: geometry.width,
                        height: geometry.height,
                        zIndex: geometry.zIndex,
                        opacity: geometry.opacity,
                        borderRadius: isOpen && isDisplay ? 6 : '4px 4px 0 0',
                        transition: TRANSITION,
                      };
                      const cover = record.cover && (
                        <Image
                          src={record.cover}
                          alt={record.title}
                          fill
                          sizes="(max-width: 700px) 90vw, 33vw"
                          className="object-cover"
                          style={{ objectPosition: 'top' }}
                        />
                      );

                      if (isOpen && isDisplay) {
                        return (
                          <Link
                            key={record.key}
                            href={`/releases/${record.releaseId}`}
                            title={t('opens_release_detail', { title: record.title })}
                            className="absolute box-border overflow-hidden border-t-2 border-background bg-muted hover:brightness-125"
                            style={style}
                          >
                            {cover}
                          </Link>
                        );
                      }

                      const isFrontClosedSpine = !isOpen && isDisplay;
                      return (
                        <button
                          key={record.key}
                          type="button"
                          disabled={!geometry.interactive}
                          onClick={() => {
                            if (isFrontClosedSpine) {
                              toggleSection(binIndex, section.key);
                            } else {
                              promoteRecord(section.key, order, record.key);
                            }
                          }}
                          title={
                            isFrontClosedSpine
                              ? t('open_artist', { artist: section.artist })
                              : t('bring_to_front', { title: record.title })
                          }
                          className="absolute box-border overflow-hidden border-t-2 border-background bg-muted p-0 text-left hover:brightness-125 disabled:cursor-default"
                          style={style}
                        >
                          {cover}
                        </button>
                      );
                    })}

                    <div
                      className="pointer-events-none absolute inset-x-0"
                      style={{ top: captionTop, opacity: isOpen ? 1 : 0, transition: TRANSITION }}
                    >
                      <p className="mt-2.5 truncate text-sm font-semibold">
                        {displayRecord?.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{displayRecord?.year}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
