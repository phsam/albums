import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getRequestToken } from '@/libs/Discogs';

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const callbackUrl = new URL('/api/discogs/oauth/callback', request.url).toString();
  const { oauth_token, oauth_token_secret } = await getRequestToken(callbackUrl);

  const cookieStore = await cookies();
  cookieStore.set('discogs_request_secret', oauth_token_secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
    sameSite: 'lax',
  });

  const authorizeUrl = `https://www.discogs.com/oauth/authorize?oauth_token=${oauth_token}`;
  return NextResponse.redirect(authorizeUrl);
}
