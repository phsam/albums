import { searchReleases } from '@/libs/Discogs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return Response.json({ error: 'Missing query parameter' }, { status: 400 });
  }

  const page = searchParams.get('page') ?? '1';
  const perPage = searchParams.get('per_page') ?? '20';

  const results = await searchReleases(query, { page, perPage });
  return Response.json(results);
}
