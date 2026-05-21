'use client';

import { ChevronDown, Grid2X2, Grid3X3, LayoutGrid, Loader2, Search, X } from 'lucide-react';
import Image from 'next/image';
import { useState, useMemo, useEffect, useRef } from 'react';
import { fetchCollectionPage } from '@/app/[locale]/actions';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { DiscogsCollectionItem } from '@/libs/Discogs';
import { Link } from '@/libs/I18nNavigation';

const SORT_KEYS = ['artist', 'title', 'year'] as const;
type SortKey = (typeof SORT_KEYS)[number];

function isSortKey(value: string | null): value is SortKey {
  return value !== null && (SORT_KEYS as readonly string[]).includes(value);
}

type GridSize = 'sm' | 'md' | 'lg';

const GRID_CLASSES: Record<GridSize, string> = {
  sm: 'grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8',
  md: 'grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
  lg: 'grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
};

type ActiveFilters = {
  year: string[];
  genre: string[];
  style: string[];
  label: string[];
  format: string[];
};

const FILTER_KEYS: (keyof ActiveFilters)[] = ['year', 'genre', 'style', 'label', 'format'];

type FilterPopoverProps = {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
};

function FilterPopover(props: FilterPopoverProps) {
  if (props.options.length === 0) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger className={cn(buttonVariants({ variant: 'outline' }), 'gap-1.5')}>
        {props.label}
        {props.selected.length > 0 && (
          <Badge variant="secondary" className="h-4 rounded-sm px-1 text-xs">
            {props.selected.length}
          </Badge>
        )}
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1.5" align="start">
        <div className="max-h-60 space-y-px overflow-y-auto">
          {props.options.map((opt) => (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
            >
              <Checkbox
                checked={props.selected.includes(opt)}
                onCheckedChange={() => {
                  props.onToggle(opt);
                }}
              />
              <span className="truncate">{opt}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

type CollectionViewProps = {
  initialReleases: DiscogsCollectionItem[];
  totalCount: number;
  totalPages: number;
};

export function CollectionView(props: CollectionViewProps) {
  const [releases, setReleases] = useState(props.initialReleases);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('artist');
  const [filters, setFilters] = useState<ActiveFilters>({
    year: [],
    genre: [],
    style: [],
    label: [],
    format: [],
  });
  const [loading, setLoading] = useState(false);
  const [gridSize, setGridSize] = useState<GridSize>('md');

  const sentinelRef = useRef<HTMLDivElement>(null);
  // mutable scroll state kept in a ref to avoid stale closures inside the observer
  const scrollState = useRef({ page: 1, loading: false, totalPages: props.totalPages });

  useEffect(() => {
    const el = sentinelRef.current;
    let observer: IntersectionObserver | undefined;

    if (el) {
      observer = new IntersectionObserver(
        async (entries) => {
          if (!entries[0]?.isIntersecting) {
            return;
          }
          const s = scrollState.current;
          if (s.loading || s.page >= s.totalPages) {
            return;
          }

          s.loading = true;
          setLoading(true);
          const nextPage = s.page + 1;
          const result = await fetchCollectionPage(nextPage);
          if (result) {
            setReleases((prev) => {
              const seen = new Set(prev.map((r) => r.instance_id));
              return [...prev, ...result.releases.filter((r) => !seen.has(r.instance_id))];
            });
            s.page = nextPage;
          }
          s.loading = false;
          setLoading(false);
        },
        { rootMargin: '300px' },
      );
      observer.observe(el);
    }

    return () => {
      observer?.disconnect();
    };
  }, []);

  const options = useMemo(() => {
    const years = new Set<string>();
    const genres = new Set<string>();
    const styles = new Set<string>();
    const labels = new Set<string>();
    const formats = new Set<string>();

    for (const item of releases) {
      const info = item.basic_information;
      if (info.year > 0) {
        years.add(String(info.year));
      }
      for (const g of info.genres) {
        genres.add(g);
      }
      for (const s of info.styles) {
        styles.add(s);
      }
      for (const l of info.labels) {
        labels.add(l.name);
      }
      for (const f of info.formats) {
        formats.add(f.name);
      }
    }

    return {
      year: [...years].toSorted((a, b) => Number(b) - Number(a)),
      genre: [...genres].toSorted(),
      style: [...styles].toSorted(),
      label: [...labels].toSorted(),
      format: [...formats].toSorted(),
    };
  }, [releases]);

  const visible = useMemo(() => {
    let items = releases;

    if (search.trim()) {
      const queryWords = search.trim().toLowerCase().split(/\s+/u);
      items = items.filter((item) => {
        const info = item.basic_information;
        const artist = info.artists.map((a) => a.name).join(' ');
        const haystack = `${info.title} ${artist}`.toLowerCase();
        const words = haystack.split(/\W+/u).filter(Boolean);
        return queryWords.every((qw) => words.some((w) => w.startsWith(qw)));
      });
    }

    if (filters.year.length > 0) {
      items = items.filter((item) => filters.year.includes(String(item.basic_information.year)));
    }
    if (filters.genre.length > 0) {
      items = items.filter((item) =>
        item.basic_information.genres.some((g) => filters.genre.includes(g)),
      );
    }
    if (filters.style.length > 0) {
      items = items.filter((item) =>
        item.basic_information.styles.some((s) => filters.style.includes(s)),
      );
    }
    if (filters.label.length > 0) {
      items = items.filter((item) =>
        item.basic_information.labels.some((l) => filters.label.includes(l.name)),
      );
    }
    if (filters.format.length > 0) {
      items = items.filter((item) =>
        item.basic_information.formats.some((f) => filters.format.includes(f.name)),
      );
    }

    return items;
  }, [releases, search, filters]);

  const sorted = useMemo(() => {
    const items = [...visible];
    switch (sort) {
      case 'artist': {
        return items.toSorted((a, b) => {
          const nameA = a.basic_information.artists[0]?.name ?? '';
          const nameB = b.basic_information.artists[0]?.name ?? '';
          if (!nameA && nameB) {
            return 1;
          }
          if (nameA && !nameB) {
            return -1;
          }
          return nameA.localeCompare(nameB);
        });
      }
      case 'title': {
        return items.toSorted((a, b) =>
          a.basic_information.title.localeCompare(b.basic_information.title),
        );
      }
      case 'year': {
        return items.toSorted((a, b) => a.basic_information.year - b.basic_information.year);
      }
      default: {
        return items;
      }
    }
  }, [visible, sort]);

  const totalFilters = Object.values(filters).reduce((n, v) => n + v.length, 0);
  const hasAnyFilter = totalFilters > 0 || search.trim() !== '';

  function toggleFilter(key: keyof ActiveFilters, value: string) {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((v) => v !== value)
        : [...prev[key], value],
    }));
  }

  function clearAll() {
    setSearch('');
    setFilters({ year: [], genre: [], style: [], label: [], format: [] });
  }

  return (
    <div className="px-4 py-8">
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search albums or artists…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              className="pl-8"
            />
          </div>

          <FilterPopover
            label="Year"
            options={options.year}
            selected={filters.year}
            onToggle={(v) => {
              toggleFilter('year', v);
            }}
          />
          <FilterPopover
            label="Genre"
            options={options.genre}
            selected={filters.genre}
            onToggle={(v) => {
              toggleFilter('genre', v);
            }}
          />
          <FilterPopover
            label="Style"
            options={options.style}
            selected={filters.style}
            onToggle={(v) => {
              toggleFilter('style', v);
            }}
          />
          <FilterPopover
            label="Label"
            options={options.label}
            selected={filters.label}
            onToggle={(v) => {
              toggleFilter('label', v);
            }}
          />
          <FilterPopover
            label="Format"
            options={options.format}
            selected={filters.format}
            onToggle={(v) => {
              toggleFilter('format', v);
            }}
          />

          <Select
            value={sort}
            onValueChange={(v) => {
              if (isSortKey(v)) {
                setSort(v);
              }
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="artist">Artist name</SelectItem>
              <SelectItem value="title">Release name</SelectItem>
              <SelectItem value="year">Year</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center rounded-md border">
            {(
              [
                ['sm', Grid3X3],
                ['md', Grid2X2],
                ['lg', LayoutGrid],
              ] as const
            ).map(([size, Icon]) => (
              <button
                key={size}
                type="button"
                onClick={() => {
                  setGridSize(size);
                }}
                className={cn(
                  'flex h-9 w-9 items-center justify-center transition-colors',
                  'first:rounded-l-md last:rounded-r-md',
                  gridSize === size
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50',
                )}
              >
                <Icon className="size-4" />
              </button>
            ))}
          </div>

          {hasAnyFilter && (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <X className="size-4" />
              Clear
            </Button>
          )}
        </div>

        {totalFilters > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {FILTER_KEYS.flatMap((key) =>
              filters[key].map((v) => (
                <Badge
                  key={`${key}:${v}`}
                  variant="secondary"
                  className="cursor-pointer gap-1"
                  onClick={() => {
                    toggleFilter(key, v);
                  }}
                >
                  {v}
                  <X className="size-3" />
                </Badge>
              )),
            )}
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          {hasAnyFilter
            ? `${sorted.length} of ${releases.length} shown`
            : `${props.totalCount} records`}
        </p>
      </div>

      <div className={cn('grid', GRID_CLASSES[gridSize])}>
        {sorted.map((item) => {
          const info = item.basic_information;
          const artist = info.artists.map((a) => a.name).join(', ');
          return (
            <Link key={item.instance_id} href={`/releases/${info.id}`} className="group block">
              <div className="relative aspect-square overflow-hidden rounded bg-gray-100">
                {info.cover_image ? (
                  <Image
                    src={info.cover_image}
                    alt={info.title}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                    className="object-cover transition-opacity group-hover:opacity-80"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-2xl text-gray-400">
                    ♪
                  </div>
                )}
              </div>
              <p className="mt-2 truncate text-sm font-semibold">{info.title}</p>
              <p className="truncate text-xs text-muted-foreground">{artist}</p>
              {info.year > 0 && <p className="text-xs text-muted-foreground">{info.year}</p>}
            </Link>
          );
        })}
      </div>

      <div ref={sentinelRef} className="mt-8 flex justify-center">
        {loading && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
      </div>
    </div>
  );
}
