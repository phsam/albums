import { createHmac } from 'node:crypto';
import { Env } from './Env';

const API_BASE = 'https://api.discogs.com';
const USER_AGENT = 'AlbumsApp/1.0';

// --- OAuth 1.0a helpers ---

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replaceAll('!', '%21')
    .replaceAll("'", '%27')
    .replaceAll('(', '%28')
    .replaceAll(')', '%29')
    .replaceAll('*', '%2A');
}

function buildSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret = '',
): string {
  const paramString = Object.entries(params)
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join('&');
  const baseString = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  return createHmac('sha1', signingKey).update(baseString).digest('base64');
}

function oauthBaseParams(oauthToken?: string): Record<string, string> {
  const nonce = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const params: Record<string, string> = {
    oauth_consumer_key: Env.DISCOGS_CONSUMER_KEY,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0',
  };
  if (oauthToken) {
    params.oauth_token = oauthToken;
  }
  return params;
}

function buildOAuthAuthorizationHeader(oauthParams: Record<string, string>): string {
  return `OAuth ${Object.entries(oauthParams)
    .map(([k, v]) => `${k}="${percentEncode(v)}"`)
    .join(', ')}`;
}

/**
 * Builds an OAuth 1.0a Authorization header for a Discogs request.
 *
 * @param opts - Request method, URL, and optional OAuth parameters.
 * @returns The Authorization header value.
 */
function buildOAuthHeader(opts: {
  method: string;
  url: string;
  queryParams?: Record<string, string>;
  token?: string;
  tokenSecret?: string;
  extraOAuthParams?: Record<string, string>;
}): string {
  const oauthParams = {
    ...oauthBaseParams(opts.token),
    ...opts.extraOAuthParams,
  };
  // All params combined for signature (OAuth + query)
  const allParams = { ...oauthParams, ...opts.queryParams };
  oauthParams.oauth_signature = buildSignature(
    opts.method,
    opts.url,
    allParams,
    Env.DISCOGS_CONSUMER_SECRET,
    opts.tokenSecret,
  );
  return buildOAuthAuthorizationHeader(oauthParams);
}

// --- HTTP client ---

type DiscogsRequestOptions = {
  path: string;
  method?: 'GET' | 'POST';
  query?: Record<string, string>;
  token?: string;
  tokenSecret?: string;
};

function isDiscogsObject(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null;
}

async function discogsRequest<T>(
  opts: DiscogsRequestOptions,
  guard: (data: unknown) => data is T,
): Promise<T> {
  const url = new URL(`${API_BASE}${opts.path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      url.searchParams.set(k, v);
    }
  }
  const method = opts.method ?? 'GET';
  const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;
  const queryParamsObj = Object.fromEntries(url.searchParams.entries());

  const authHeader = buildOAuthHeader({
    method,
    url: baseUrl,
    queryParams: queryParamsObj,
    token: opts.token,
    tokenSecret: opts.tokenSecret,
  });

  const res = await fetch(url.toString(), {
    method,
    cache: 'no-store',
    headers: {
      Authorization: authHeader,
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discogs API error ${res.status}: ${body}`);
  }

  const data: unknown = await res.json();
  if (!guard(data)) {
    throw new Error('Invalid Discogs API response');
  }
  return data;
}

// --- Types ---

export type DiscogsSearchResult = {
  pagination: {
    pages: number;
    page: number;
    per_page: number;
    items: number;
  };
  results: {
    id: number;
    type: string;
    title: string;
    year?: string;
    country?: string;
    format?: string[];
    label?: string[];
    genre?: string[];
    style?: string[];
    thumb: string;
    cover_image: string;
    resource_url: string;
    master_url?: string;
    uri: string;
  }[];
};

export type DiscogsRelease = {
  id: number;
  title: string;
  year: number;
  artists: { name: string; id: number; anv?: string }[];
  labels: { name: string; catno: string }[];
  genres: string[];
  styles: string[];
  tracklist: { position: string; title: string; duration: string }[];
  images: { type: string; uri: string; width: number; height: number }[];
  notes?: string;
  country?: string;
  released?: string;
  formats: { name: string; qty: string; descriptions?: string[] }[];
  community?: { have: number; want: number };
};

export type DiscogsCollectionItem = {
  id: number;
  instance_id: number;
  rating: number;
  basic_information: {
    id: number;
    master_id: number;
    title: string;
    year: number;
    thumb: string;
    cover_image: string;
    artists: { name: string }[];
    labels: { name: string; catno: string }[];
    formats: { name: string }[];
    genres: string[];
    styles: string[];
    resource_url: string;
  };
  date_added: string;
};

export type DiscogsCollection = {
  pagination: {
    pages: number;
    page: number;
    per_page: number;
    items: number;
  };
  releases: DiscogsCollectionItem[];
};

export type DiscogsIdentity = {
  id: number;
  username: string;
  resource_url: string;
  consumer_name: string;
};

function isDiscogsSearchResult(data: unknown): data is DiscogsSearchResult {
  return isDiscogsObject(data) && Array.isArray(data.results) && isDiscogsObject(data.pagination);
}

function isDiscogsRelease(data: unknown): data is DiscogsRelease {
  return isDiscogsObject(data) && typeof data.id === 'number' && typeof data.title === 'string';
}

function isDiscogsCollection(data: unknown): data is DiscogsCollection {
  return isDiscogsObject(data) && Array.isArray(data.releases) && isDiscogsObject(data.pagination);
}

function isDiscogsIdentity(data: unknown): data is DiscogsIdentity {
  return isDiscogsObject(data) && typeof data.username === 'string';
}

// --- Public API calls ---

export async function searchReleases(
  query: string,
  opts: { page?: string; perPage?: string } = {},
): Promise<DiscogsSearchResult> {
  return await discogsRequest(
    {
      path: '/database/search',
      query: {
        q: query,
        type: 'release',
        page: opts.page ?? '1',
        per_page: opts.perPage ?? '20',
      },
    },
    isDiscogsSearchResult,
  );
}

export async function getRelease(id: string): Promise<DiscogsRelease> {
  return await discogsRequest({ path: `/releases/${id}` }, isDiscogsRelease);
}

// --- User collection (requires OAuth) ---

export async function getUserCollection(
  username: string,
  token: string,
  tokenSecret: string,
  opts: { page?: string; perPage?: string; sort?: string } = {},
): Promise<DiscogsCollection> {
  return await discogsRequest(
    {
      path: `/users/${username}/collection/folders/0/releases`,
      token,
      tokenSecret,
      query: {
        page: opts.page ?? '1',
        per_page: opts.perPage ?? '50',
        sort: opts.sort ?? 'added',
        sort_order: 'desc',
      },
    },
    isDiscogsCollection,
  );
}

export async function getIdentity(token: string, tokenSecret: string): Promise<DiscogsIdentity> {
  return await discogsRequest(
    {
      path: '/oauth/identity',
      token,
      tokenSecret,
    },
    isDiscogsIdentity,
  );
}

// --- OAuth token exchange ---

export async function getRequestToken(
  callbackUrl: string,
): Promise<{ oauth_token: string; oauth_token_secret: string }> {
  const url = 'https://api.discogs.com/oauth/request_token';
  const authHeader = buildOAuthHeader({
    method: 'GET',
    url,
    extraOAuthParams: { oauth_callback: callbackUrl },
  });

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: authHeader,
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to get Discogs request token: ${await res.text()}`);
  }

  const params = Object.fromEntries(new URLSearchParams(await res.text()));
  return {
    oauth_token: params.oauth_token ?? '',
    oauth_token_secret: params.oauth_token_secret ?? '',
  };
}

export async function getAccessToken(
  requestToken: string,
  requestTokenSecret: string,
  verifier: string,
): Promise<{ oauth_token: string; oauth_token_secret: string }> {
  const url = 'https://api.discogs.com/oauth/access_token';
  const authHeader = buildOAuthHeader({
    method: 'POST',
    url,
    token: requestToken,
    tokenSecret: requestTokenSecret,
    extraOAuthParams: { oauth_verifier: verifier },
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to get Discogs access token: ${await res.text()}`);
  }

  const params = Object.fromEntries(new URLSearchParams(await res.text()));
  return {
    oauth_token: params.oauth_token ?? '',
    oauth_token_secret: params.oauth_token_secret ?? '',
  };
}
