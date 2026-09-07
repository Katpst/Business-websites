import { readFile } from 'node:fs/promises';
import { z } from 'zod';

const text = z.string();
const httpsUrl = z.url().refine(value => new URL(value).protocol === 'https:', 'Use an HTTPS URL');
const optionalUrl = z.union([z.literal(''), httpsUrl]);
const localImage = z.object({
  file: text.regex(/^images\/[a-zA-Z0-9_/-]+\.(?:jpg|jpeg|png|webp)$/),
  alt: text.min(1),
  credit: text.min(1),
  creditUrl: optionalUrl.default(''),
}).strict();

export const businessSchema = z.object({
  name: text,
  location: text,
  address: text,
  phone: text.refine(value => !value || /^\+?[\d ().-]{6,25}$/.test(value), 'Use a real telephone number'),
  email: z.union([z.literal(''), z.email()]),
  website: optionalUrl,
  externalLinks: z.array(z.object({ label: text.min(1), url: httpsUrl }).strict()).optional(),
  hero: z.object({
    title: text.min(1), description: text, eyebrow: text.optional(), titleAccent: text.optional(),
    image: localImage.optional(), detailImage: localImage.optional(),
  }),
  services: z.array(z.object({
    title: text.min(1), description: text, price: text,
    image: localImage.optional(), details: z.array(text.min(1)).optional(),
  })),
  projects: z.array(z.object({ title: text.min(1), description: text, before: localImage, after: localImage, layout: z.enum(['side-by-side', 'slider']).optional() })).optional(),
  serviceAreas: z.array(text.min(1)),
  verifiedClaims: z.array(text.min(1)),
  steps: z.array(z.object({ title: text.min(1), description: text.min(1) })),
  about: z.object({ title: text, paragraphs: z.array(text.min(1)) }),
  beforeAfter: z.object({
    caption: text.min(1),
    sameJobConfirmed: z.literal(true),
    before: localImage,
    after: localImage,
  }).strict().nullable(),
  legal: z.object({
    legalName: text, legalForm: text, shareCapital: text, address: text,
    siren: text, siret: text.regex(/^(?:\d{14})?$/, 'SIRET must contain 14 digits or be empty').optional(), registration: text, vatNumber: text, publicationDirector: text,
    insurance: text, hosting: text, mediator: text,
  }).strict(),
  privacyText: text,
  termsText: text,
  google: z.object({
    listingUrl: optionalUrl.optional(),
    placeId: text.regex(/^[a-zA-Z0-9_-]*$/),
    maxPhotos: z.number().int().min(0).max(10),
    snapshotPermission: z.object({
      basis: text.min(1),
      expiresAt: z.iso.datetime({ offset: true }).optional(),
    }).strict().nullable(),
  }).strict(),
}).strict();

// These schemas validate fields we display; Google may return additional fields.
const author = z.object({ displayName: text.optional(), uri: httpsUrl.optional(), photoUri: httpsUrl.optional() });
const localizedText = z.object({ text, languageCode: text.optional() });
export const reviewSchema = z.object({
  name: text.optional(),
  rating: z.number().min(1).max(5).optional(),
  text: localizedText.optional(),
  originalText: localizedText.optional(),
  authorAttribution: author.optional(),
  publishTime: z.iso.datetime({ offset: true }).optional(),
  relativePublishTimeDescription: text.optional(),
  googleMapsUri: httpsUrl.optional(),
  flagContentUri: httpsUrl.optional(),
  visitDate: z.object({ year: z.number().int(), month: z.number().int().min(1).max(12), day: z.number().int().optional() }).optional(),
});
const photoMetadata = z.object({
  authorAttributions: z.array(author).default([]),
  googleMapsUri: httpsUrl.optional(),
  flagContentUri: httpsUrl.optional(),
});
export const placeSchema = z.object({
  id: text,
  rating: z.number().min(1).max(5).optional(),
  userRatingCount: z.number().int().nonnegative().optional(),
  googleMapsUri: httpsUrl.optional(),
  reviews: z.array(reviewSchema).default([]),
  photos: z.array(photoMetadata.extend({ name: text })).default([]),
  attributions: z.array(z.object({ provider: text.optional(), providerUri: httpsUrl.optional() })).default([]),
});
export const snapshotSchema = z.object({
  version: z.literal(1),
  placeId: text.min(1),
  fetchedAt: z.iso.datetime({ offset: true }),
  expiresAt: z.iso.datetime({ offset: true }).optional(),
  permissionBasis: text.min(1),
  place: placeSchema.omit({ photos: true }),
  photos: z.array(photoMetadata.extend({
    file: text.regex(/^google-\d+\.(?:jpg|png|webp)$/),
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    base64: text.min(1).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  })),
});
export type Business = z.infer<typeof businessSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;

export async function readBusiness(file = 'business.json'): Promise<Business> {
  return businessSchema.parse(JSON.parse(await readFile(file, 'utf8')));
}

export function validateSnapshot(snapshot: Snapshot, business: Business, now = Date.now()): void {
  const permission = business.google.snapshotPermission;
  if (!permission || !permission.basis.trim()) throw new Error('Google snapshot storage permission is not configured. See README.');
  if (snapshot.placeId !== business.google.placeId || snapshot.place.id !== business.google.placeId) {
    throw new Error('Google snapshot belongs to a different Place ID. Fetch again.');
  }
  const snapshotExpiry = snapshot.expiresAt ? Date.parse(snapshot.expiresAt) : Infinity;
  const permissionExpiry = permission.expiresAt ? Date.parse(permission.expiresAt) : Infinity;
  if (snapshot.permissionBasis !== permission.basis || snapshotExpiry > permissionExpiry) {
    throw new Error('Google snapshot permission has changed. Fetch again.');
  }
  if (Date.parse(snapshot.fetchedAt) > now || Date.parse(snapshot.fetchedAt) >= snapshotExpiry) {
    throw new Error('Invalid Google snapshot dates. Fetch again.');
  }
  if (Math.min(snapshotExpiry, permissionExpiry) <= now) {
    throw new Error('Google snapshot permission expired. Remove cached and deployed Google content; see README.');
  }
}

export async function readSnapshot(business: Business, file = '.cache/google.json'): Promise<Snapshot | undefined> {
  let raw: string;
  try { raw = await readFile(file, 'utf8'); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
  const snapshot = snapshotSchema.parse(JSON.parse(raw));
  validateSnapshot(snapshot, business);
  return snapshot;
}
