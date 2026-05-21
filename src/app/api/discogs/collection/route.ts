import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { getUserCollection } from '@/libs/Discogs';
import { discogsTokensSchema } from '@/models/Schema';

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tokenRow = await db.query.discogsTokensSchema.findFirst({
    where: eq(discogsTokensSchema.userId, userId),
  });

  if (!tokenRow) {
    return Response.json({ error: 'Discogs account not connected' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') ?? '1';
  const perPage = searchParams.get('per_page') ?? '50';
  const sort = searchParams.get('sort') ?? 'added';

  const collection = await getUserCollection(
    tokenRow.discogsUsername,
    tokenRow.accessToken,
    tokenRow.accessTokenSecret,
    { page, perPage, sort },
  );

  return Response.json(collection);
}
