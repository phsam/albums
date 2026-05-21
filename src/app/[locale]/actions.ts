'use server';

import { db } from '@/libs/DB';
import { getUserCollection } from '@/libs/Discogs';

export async function fetchCollectionPage(page: number) {
  const tokenRow = await db.query.discogsTokensSchema.findFirst();
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
