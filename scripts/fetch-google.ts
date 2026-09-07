import { loadEnvFile } from 'node:process';
import { mkdir, rename, writeFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { placeSchema, readBusiness, snapshotSchema, type Business, type Snapshot } from '../src/data.ts';

export const FIELD_MASK = 'id,rating,userRatingCount,googleMapsUri,reviews,photos,attributions';
type Request = typeof fetch;

async function request(url: string, key: string | undefined, fetcher: Request, fieldMask?: string): Promise<Response> {
  const response = await fetcher(url, {
    headers: {
      ...(key ? { 'X-Goog-Api-Key': key } : {}),
      ...(fieldMask ? { 'X-Goog-FieldMask': fieldMask } : {}),
    },
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  });
  // Do not print Google's response body or request URL: either could expose credentials.
  if (!response.ok) throw new Error(`Google request failed (HTTP ${response.status}). Check billing, Places API (New), key restrictions and Place ID.`);
  return response;
}

async function imageBytes(response: Response): Promise<Buffer> {
  const limit = 15 * 1024 * 1024;
  if (!response.body) throw new Error('Empty photo response.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > limit) throw new Error('Google photo exceeds 15 MB.');
    chunks.push(chunk);
  }
  if (!size) throw new Error('Empty photo response.');
  return Buffer.concat(chunks);
}

export async function fetchSnapshot(business: Business, key: string, fetcher: Request = fetch, now = Date.now()): Promise<Snapshot> {
  const { placeId, maxPhotos, snapshotPermission: permission } = business.google;
  if (!placeId) throw new Error('Fill in google.placeId in business.json first.');
  if (!key.trim()) throw new Error('Set GOOGLE_PLACES_API_KEY in .env first.');
  if (!permission?.basis.trim() || (permission.expiresAt && Date.parse(permission.expiresAt) <= now)) {
    throw new Error('Offline storage needs an applicable permission covering reviews, photo downloads and static display. Configure google.snapshotPermission only if you have it; see README.');
  }
  const response = await request(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=fr`, key, fetcher, FIELD_MASK);
  const place = placeSchema.parse(await response.json());
  if (place.id !== placeId) throw new Error('Google returned a different Place ID. Verify the listing before fetching again.');
  const photos: Snapshot['photos'] = [];
  // One Details request, then two requests per selected photo. No searches, retries or pagination.
  for (const [index, photo] of place.photos.slice(0, maxPhotos).entries()) {
    const prefix = `places/${placeId}/photos/`;
    if (!photo.name.startsWith(prefix) || !/^[a-zA-Z0-9_-]+$/.test(photo.name.slice(prefix.length))) {
      throw new Error('Unexpected Google photo resource name.');
    }
    const media = await request(`https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=1600&skipHttpRedirect=true`, key, fetcher);
    const result = await media.json() as { photoUri?: string };
    const uri = new URL(result.photoUri ?? '');
    if (uri.protocol !== 'https:' || !(uri.hostname === 'googleusercontent.com' || uri.hostname.endsWith('.googleusercontent.com'))) {
      throw new Error('Unexpected Google photo download host.');
    }
    // The API key never travels to the image host.
    const image = await request(uri.href, undefined, fetcher);
    const mime = image.headers.get('content-type')?.split(';')[0];
    if (mime !== 'image/jpeg' && mime !== 'image/png' && mime !== 'image/webp') throw new Error('Unsupported Google photo format.');
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mime];
    const bytes = await imageBytes(image);
    photos.push({
      file: `google-${index + 1}.${extension}`, contentType: mime, base64: bytes.toString('base64'),
      authorAttributions: photo.authorAttributions, googleMapsUri: photo.googleMapsUri, flagContentUri: photo.flagContentUri,
    });
  }
  const { photos: _photoResources, ...details } = place;
  // Do not cache expiring photo names or media URLs. Keep attribution beside the downloaded bytes.
  return snapshotSchema.parse({ version: 1, placeId, fetchedAt: new Date(now).toISOString(),
    expiresAt: permission.expiresAt, permissionBasis: permission.basis, place: details, photos });
}

async function main(): Promise<void> {
  try { loadEnvFile('.env'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const snapshot = await fetchSnapshot(await readBusiness(), process.env.GOOGLE_PLACES_API_KEY ?? '');
  await mkdir('.cache', { recursive: true });
  const temporary = `.cache/google-${process.pid}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(snapshot, null, 2), { mode: 0o600 });
    await rename(temporary, '.cache/google.json');
  } finally { await rm(temporary, { force: true }); }
  console.log(`Saved ${snapshot.place.reviews.length} reviews and ${snapshot.photos.length} photos. Run npm run build separately.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error instanceof Error ? error.message : 'Google fetch failed.'); process.exitCode = 1; });
}
