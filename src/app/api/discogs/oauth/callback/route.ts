import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/libs/DB';
import { getAccessToken, getIdentity } from '@/libs/Discogs';
import { discogsTokensSchema } from '@/models/Schema';

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const reqUrl = new URL(request.url);
  const oauthToken = reqUrl.searchParams.get('oauth_token');
  const oauthVerifier = reqUrl.searchParams.get('oauth_verifier');

  if (!oauthToken || !oauthVerifier) {
    return new Response('Missing OAuth parameters', { status: 400 });
  }

  const cookieStore = await cookies();
  const requestTokenSecret = cookieStore.get('discogs_request_secret')?.value;

  if (!requestTokenSecret) {
    return new Response('OAuth session expired', { status: 400 });
  }

  const { oauth_token: accessToken, oauth_token_secret: accessTokenSecret } = await getAccessToken(
    oauthToken,
    requestTokenSecret,
    oauthVerifier,
  );

  const identity = await getIdentity(accessToken, accessTokenSecret);

  await db
    .insert(discogsTokensSchema)
    .values({
      userId,
      accessToken,
      accessTokenSecret,
      discogsUsername: identity.username,
    })
    .onConflictDoUpdate({
      target: discogsTokensSchema.userId,
      set: {
        accessToken,
        accessTokenSecret,
        discogsUsername: identity.username,
        updatedAt: new Date(),
      },
    });

  cookieStore.delete('discogs_request_secret');

  const collectionUrl = new URL('/dashboard/collection', request.url);
  return NextResponse.redirect(collectionUrl);
}
