import { getRelease } from '@/libs/Discogs';

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const release = await getRelease(id);
  return Response.json(release);
}
