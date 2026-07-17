'use server';

import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { getUserCollection } from '@/libs/Discogs';
import { discogsTokensSchema } from '@/models/Schema';

export async function fetchCollectionPage(page: number) {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const tokenRow = await db.query.discogsTokensSchema.findFirst({
    where: eq(discogsTokensSchema.userId, userId),
  });
  if (!tokenRow) {
    return null;
  }
  return await getUserCollection(
    tokenRow.discogsUsername,
    tokenRow.accessToken,
    tokenRow.accessTokenSecret,
    { page: String(page), perPage: '100' },
  );
}
