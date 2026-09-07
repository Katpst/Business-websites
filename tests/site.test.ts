import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { build } from '../scripts/build.ts';
import { fetchSnapshot, FIELD_MASK } from '../scripts/fetch-google.ts';
import { businessSchema, readBusiness, snapshotSchema, validateSnapshot, type Snapshot } from '../src/data.ts';
import { render } from '../src/render.ts';

const business = {
  ...await readBusiness(), name: 'TEST ONLY business', address: 'TEST ONLY address',
  phone: '+33 1 23 45 67 89', email: '', website: '', beforeAfter: null,
  verifiedClaims: [], steps: [], about: { title: '', paragraphs: [] },
  projects: [], google: { ...(await readBusiness()).google, listingUrl: '', placeId: '', snapshotPermission: null },
};
const now = Date.parse('2026-09-07T12:00:00Z');
// Synthetic fixtures are only for tests. Nothing here is used by the site build.
const configured = () => ({ ...structuredClone(business), google: { placeId: 'TEST_PLACE', maxPhotos: 1, snapshotPermission: { basis: 'TEST ONLY: simulated storage permission', expiresAt: '2099-01-01T00:00:00Z' } } });
const fixture = (): Snapshot => snapshotSchema.parse({
  version: 1, placeId: 'TEST_PLACE', fetchedAt: '2026-09-07T11:00:00Z', expiresAt: '2099-01-01T00:00:00Z',
  permissionBasis: 'TEST ONLY: simulated storage permission',
  place: { id: 'TEST_PLACE', reviews: [{
    rating: 2, originalText: { text: 'TEST ONLY <script>alert(1)</script>\n  Exact spacing & punctuation.', languageCode: 'fr' },
    text: { text: 'TEST TRANSLATION MUST NOT REPLACE ORIGINAL' },
    authorAttribution: { displayName: 'Test author', uri: 'https://example.com/author', photoUri: 'https://example.com/avatar.png' },
    googleMapsUri: 'https://example.com/review', flagContentUri: 'https://example.com/report',
    visitDate: { month: 8, year: 2026 },
  }], attributions: [] }, photos: [],
});

test('site uses configured contact details and contains no invented proof or dead form', () => {
  const html = render(business);
  assert.match(html, /tel:\+33123456789/);
  assert.match(html, /TEST ONLY address/);
  for (const absent of ['Assurance décennale', '48 heures', 'XX', 'VOTRE-CLE', 'id="avis"', 'id="compare"', 'id="photos"', 'aggregateRating', '5.0(29)']) assert.ok(!html.includes(absent), absent);
  assert.match(html, /Formulaire de démonstration/);
  assert.match(html, /noindex, nofollow/);
});

test('one review renders unedited original text, even with a low score, and full attribution', () => {
  const html = render(business, fixture());
  assert.match(html, /id="avis"/);
  assert.match(html, /TEST ONLY &lt;script&gt;alert\(1\)&lt;\/script&gt;\n  Exact spacing &amp; punctuation\./);
  assert.ok(!html.includes('TEST TRANSLATION'));
  for (const required of ['2 / 5', 'Test author', 'https://example.com/avatar.png', 'https://example.com/author', 'https://example.com/review', 'https://example.com/report', '08/2026', 'Google Maps', 'pertinence', 'id="conditions"', 'id="confidentialite"']) assert.ok(html.includes(required), required);
});

test('rating-only, photo-only and empty responses render independently', () => {
  const snapshot = fixture();
  snapshot.place.reviews = [];
  assert.ok(!render(business, snapshot).includes('id="avis"'));
  snapshot.place.rating = 4.2;
  assert.match(render(business, snapshot), /4,2/);
  delete snapshot.place.rating;
  snapshot.photos = [{ file: 'google-1.png', base64: 'dGVzdA==', contentType: 'image/png', authorAttributions: [{ displayName: 'Test photographer', uri: 'https://example.com/photographer' }], googleMapsUri: 'https://example.com/photo' }];
  const html = render(business, snapshot);
  assert.match(html, /id="photos"/);
  assert.match(html, /Test photographer/);
  assert.match(html, /https:\/\/example.com\/photo/);
  assert.ok(!html.includes('id="avis"'));
  assert.ok(!html.includes('id="compare"'));
});

test('omits empty services, claims, process, zone and contact sections', () => {
  const empty = { ...business, phone: '', email: '', services: [], steps: [], serviceAreas: [], verifiedClaims: [] };
  const html = render(empty);
  for (const id of ['prestations', 'deroulement', 'zone', 'devis']) assert.ok(!html.includes(`id="${id}"`));
  assert.ok(!html.includes('href="#devis"'));
});

test('untrusted links, invalid local photo paths and misspelled config fields fail validation', () => {
  assert.throws(() => businessSchema.parse({ ...business, website: 'javascript:alert(1)' }));
  assert.throws(() => businessSchema.parse({ ...business, certifications: ['Test claim'] }));
  const pair = { caption: 'TEST ONLY', sameJobConfirmed: true, before: { file: '../secret.png', alt: 'test', credit: 'Test' }, after: { file: 'images/after.png', alt: 'test', credit: 'Test' } };
  assert.throws(() => businessSchema.parse({ ...business, beforeAfter: pair }));
});

test('JSON-LD and HTML cannot be broken out of by business text', () => {
  const html = render({ ...business, name: '</script><script>alert(1)</script>' });
  assert.ok(!html.includes('</script><script>alert(1)</script>'));
  assert.match(html, /\\u003c\/script>/);
});

test('snapshot rejects expired, mismatched, future and withdrawn permissions', () => {
  validateSnapshot(fixture(), configured(), now);
  assert.throws(() => validateSnapshot({ ...fixture(), placeId: 'OTHER' }, configured(), now), /different Place ID/);
  assert.throws(() => validateSnapshot({ ...fixture(), expiresAt: '2026-09-07T11:30:00Z' }, configured(), now), /expired/);
  assert.throws(() => validateSnapshot({ ...fixture(), fetchedAt: '2098-01-01T00:00:00Z' }, configured(), now), /dates/);
  assert.throws(() => validateSnapshot(fixture(), business, now), /permission/);
});

test('recorded permission without a supplied expiry does not invent one', () => {
  const b = configured();
  const permission = { basis: b.google.snapshotPermission.basis };
  const snapshot = fixture();
  delete snapshot.expiresAt;
  validateSnapshot(snapshot, { ...b, google: { ...b.google, snapshotPermission: permission } }, now);
  assert.throws(() => validateSnapshot(snapshot, b, now), /permission/);
});

test('contact page uses cross-page navigation and a clearly identified demo form', () => {
  const html = render(business, undefined, 'contact');
  assert.match(html, /href="index.html#prestations"/);
  assert.match(html, /aria-current="page"/);
  for (const field of ['name', 'phone', 'email', 'city', 'service', 'message']) assert.ok(html.includes(`name="${field}"`));
  assert.match(html, /aucune demande n’est transmise/);
  assert.ok(!html.includes('sms:'));
  assert.ok(!html.includes('id="realisations"'));
});

test('fetch uses a bounded field mask and downloads photos without sending the key to image hosts', async () => {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, headers: init!.headers as Record<string, string> });
    if (url.includes('googleusercontent.com')) return new Response(Buffer.from('TEST IMAGE'), { headers: { 'Content-Type': 'image/png' } });
    if (url.includes('/media?')) return Response.json({ photoUri: 'https://lh3.googleusercontent.com/test' });
    return Response.json({ ...fixture().place, photos: [{ name: 'places/TEST_PLACE/photos/TEST_PHOTO', authorAttributions: [{ displayName: 'Test photographer' }] }] });
  };
  const snapshot = await fetchSnapshot(configured(), 'TEST_SECRET', fetcher, now);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].headers['X-Goog-FieldMask'], FIELD_MASK);
  assert.equal(calls[1].headers['X-Goog-Api-Key'], 'TEST_SECRET');
  assert.equal(calls[2].headers['X-Goog-Api-Key'], undefined);
  assert.equal(snapshot.photos[0].authorAttributions[0].displayName, 'Test photographer');
  const saved = JSON.stringify(snapshot);
  for (const secret of ['TEST_SECRET', 'TEST_PHOTO', 'lh3.googleusercontent.com/test']) assert.ok(!saved.includes(secret));
});

test('missing credentials/permission fail before making requests; HTTP errors do not expose secrets', async () => {
  let requests = 0;
  const fetcher: typeof fetch = async () => { requests++; return new Response('TEST_SECRET', { status: 403 }); };
  await assert.rejects(fetchSnapshot(configured(), '', fetcher, now), /API_KEY/);
  await assert.rejects(fetchSnapshot({ ...configured(), google: { ...configured().google, snapshotPermission: null } }, 'TEST_SECRET', fetcher, now), /permission/);
  assert.equal(requests, 0);
  await assert.rejects(fetchSnapshot(configured(), 'TEST_SECRET', fetcher, now), error => error instanceof Error && error.message.includes('403') && !error.message.includes('TEST_SECRET'));
});

test('build is offline, replaces old output and preserves previous output on invalid input', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'roofing-test-'));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Build must never fetch'); };
  try {
    await mkdir(path.join(root, 'src'));
    await mkdir(path.join(root, 'dist'));
    await writeFile(path.join(root, 'dist/obsolete-photo.jpg'), 'TEST OLD PHOTO');
    await cp('src/style.css', path.join(root, 'src/style.css'));
    await cp('src/contact.ts', path.join(root, 'src/contact.ts'));
    await cp('public', path.join(root, 'public'), { recursive: true });
    await writeFile(path.join(root, 'business.json'), JSON.stringify(business));
    await build(root);
    const html = await readFile(path.join(root, 'dist/index.html'), 'utf8');
    assert.match(await readFile(path.join(root, 'dist/contact.html'), 'utf8'), /data-contact-form/);
    await assert.rejects(readFile(path.join(root, 'dist/obsolete-photo.jpg')));
    const snapshot = fixture();
    snapshot.photos = [{ file: 'google-1.png', contentType: 'image/png', base64: Buffer.from('TEST IMAGE BYTES').toString('base64'), authorAttributions: [{ displayName: 'TEST photographer' }] }];
    await writeFile(path.join(root, '.cache/google.json'), JSON.stringify(snapshot));
    await writeFile(path.join(root, 'business.json'), JSON.stringify(configured()));
    await build(root);
    assert.equal(await readFile(path.join(root, 'dist/assets/google-1.png'), 'utf8'), 'TEST IMAGE BYTES');
    const googleHtml = await readFile(path.join(root, 'dist/index.html'), 'utf8');
    assert.match(googleHtml, /TEST photographer/);
    assert.match(googleHtml, /id="avis"/);
    await writeFile(path.join(root, 'business.json'), '{}');
    await assert.rejects(build(root));
    assert.equal(await readFile(path.join(root, 'dist/index.html'), 'utf8'), googleHtml);
    await rm(path.join(root, '.cache/google.json'));
    await writeFile(path.join(root, 'business.json'), JSON.stringify(business));
    await build(root);
    await assert.rejects(readFile(path.join(root, 'dist/assets/google-1.png')));
    assert.equal(await readFile(path.join(root, 'dist/index.html'), 'utf8'), html);
  } finally {
    globalThis.fetch = originalFetch;
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('roofing-test-'));
    await rm(root, { recursive: true, force: true });
  }
});
