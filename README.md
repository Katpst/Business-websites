# Les Compagnons des Toitures — private demo

A small TypeScript static site for the Bayonne business. The supplied design is preserved in `reference/index.html`; the implementation keeps its slate/cream/red palette and fonts, with broader roofing/renovation copy, real photographs, an interactive hero comparison, Google reviews and a contact page. No framework or database is required.

## Run

Node.js 22.13 or newer. In a fresh checkout, restore the permitted demo photos listed below before building, or remove the corresponding image entries from `business.json` and set `beforeAfter` to `null`.

```sh
npm ci
npm run build
npm run preview
```

Open **http://127.0.0.1:4173** or **http://127.0.0.1:4173/contact.html**. On Windows use `npm.cmd` if PowerShell blocks `npm.ps1`. Preview serves only `dist/`, binds to localhost and does not watch for changes. Rebuild and refresh after editing. The missing public `website` URL keeps both pages `noindex`; nothing has been deployed.

```sh
npm run check
npm test
```

## Inputs and layout

- `business.json`: the one hand-edited file for business information and copy. Blank strings, empty arrays and `null` omit optional information; `src/data.ts` validates it before building. The supplied name, telephone, contact address and 13 service areas are populated. Legal identity, SIRET, registered office, insurance, hosting details and email remain unfilled where unverified.
- `.env`: `GOOGLE_PLACES_API_KEY`, never committed or included in frontend output. Start with `.env.example` on another machine.
- `public/images/demo/`: the supplied photos selected for this private demo. `photos/` holds the untouched source files. Both are ignored by Git; transfer the permitted media separately when moving this demo to another checkout. Restore these selected files unchanged from the supplied `photos/` folder:

  | Source | Destination in `public/images/demo/` |
  | --- | --- |
  | `unnamed (2).webp` | `couverture.webp` |
  | `unnamed (18).webp` | `faitage.webp` |
  | `unnamed (5).webp` | `reparation.webp` |
  | `unnamed (10).webp` | `toiture-entretenue.webp` |
  | `unnamed (6).webp` | `entretien-avant.webp` |
  | `unnamed (7).webp` | `entretien-apres.webp` |
- `.cache/google.json`: the ignored API snapshot. It stores reviews/attribution and optional downloaded photos together. An unsuccessful fetch preserves the previous snapshot.
- `src/render.ts`, `src/style.css`, `src/slider.ts`, `src/contact.ts`: templates, styles and the two small browser scripts.
- `scripts/fetch-google.ts`, `scripts/build.ts`, `scripts/preview.ts`: independent fetch, offline build and localhost preview.

`dist/`, `.cache/`, `.env`, source/demo photos and dependencies are ignored by Git. The build copies only configured local photos. Its generated output replaces the previous build, removing obsolete images. Failed builds preserve the previous output. Deploy only `dist/` if a public release is later authorized, never the project root or reference page.

Fonts are self-hosted; their OFL licenses are in `public/assets/`. The Google Maps SVG comes from [Google's official attribution bundle](https://developers.google.com/static/maps/documentation/images/Google_Maps_Attribution_Assets.zip). Author avatars, where supplied by Google, load from Google's returned URLs.

## Google reviews: fetch separately from building

The Place ID was obtained using Places API (New), matching the business name, public address and telephone:

`ChIJSeILa0F7BgQRp1INBllOsjY`

The API key supplied locally has been used successfully. The initial response contained five reviews, a 5/5 rating and 29 total ratings; these are fetched values, not hardcoded website copy.

```sh
npm run fetch:google
npm run build
```

Fetching makes one Place Details request with the field mask `id,rating,userRatingCount,googleMapsUri,reviews,photos,attributions`. `google.maxPhotos` is currently **0**, since the chosen demo images are already local. Raising it to 1–10 downloads that many returned photos, with one Photo Media request and one image download each. Photo names and media URLs are used immediately and not saved. Image responses are limited to supported raster types, 1600 px requested width and 15 MB. The key is sent only to `places.googleapis.com`, not to the image host or browser.

The build **never makes network requests**. It shows every returned review in Google's order, including one or two reviews if that is all Google returns. Original text is preferred to Google's translation, escaped without rewriting, and displayed with available author/date/source/report attribution, including France visit month/year. The aggregate score and count come from the API. No self-serving aggregate-rating structured data is generated. Google's limited selection is not represented as a complete review export. See [Place Details (New)](https://developers.google.com/maps/documentation/places/web-service/place-details) and [display policies](https://developers.google.com/maps/documentation/places/web-service/policies).

If the snapshot is absent, review text and ratings are omitted and the supplied Google Maps listing is offered as a direct review link. Invalid or wrong-business snapshots fail the build. `google.listingUrl` is a display link and is separate from the API Place ID.

The user explicitly confirmed permission for this private demo and requested API reviews; that authorization is recorded in `google.snapshotPermission.basis`. No expiry was provided, so none is fabricated. `expiresAt` is optional and, if supplied, must be an ISO timestamp; fetch/build enforce it and reject expired or changed permissions. This field records the supplied permission, not a universal caching license. [Standard Google Places policies](https://developers.google.com/maps/documentation/places/web-service/policies) restrict caching, with an exception for Place IDs; attribution alone does not establish storage rights. The permission recorded for this private demo should not be presented as an independently verified perpetual public-use grant.

The code does not automatically revoke a static deployment or schedule cache cleanup. Remove or replace cached/generated content when the applicable permission ends. To remove reviews locally, remove `.cache/google.json` and rebuild. Keep API billing, API restrictions and quotas configured in Google Cloud.

## Photos and slider

`beforeAfter` currently selects the matching blue-trimmed-house photos (source files 6 and 7) for the hero slider. It takes `caption`, `sameJobConfirmed`, `before` and `after`; each image uses this shape:

```json
{
  "file": "images/demo/entretien-avant.webp",
  "alt": "An accurate description of the photograph",
  "credit": "Actual source or photographer credit",
  "creditUrl": "https://example.com/source"
}
```

The white on-photo handle responds to mouse/touch. The native range is visually hidden, while retaining keyboard focus, arrow/Home/End support and a visible focus outline around the photo. There is no separate coloured slider track. A 50/50 comparison still displays without JavaScript. The hero displays only the comparison images, before/after labels and handle; explanatory captions and full-photo links were removed at the user?s request. Files are unchanged; CSS frames them for the layout.

With `beforeAfter: null`, the hero uses `hero.image`/`hero.detailImage`, or falls back to service text. Optional `projects` accepts pairs with `title`, `description`, `before`, `after` and `layout` (`side-by-side` or `slider`). It is currently empty to avoid duplicating the hero comparison. All supplied pictures remain local and outside Git.

## Business copy, links and contact form

Services accept `title`, `description`, `price`, optional `details` and optional `image`. The hero accepts `title`, `titleAccent`, `eyebrow`, `description` and optional photos. Areas are plain text lists with subtle dividing lines. `verifiedClaims` is the sole source of any assurance strip: insurance, certifications, years of experience, free quotes and response deadlines are never inserted automatically.

The Google Maps listing is linked in the contact area and footer. `externalLinks` accepts `{ "label": "Facebook", "url": "https://…" }` entries. No Facebook profile was reliably matched during the search, so none is invented or linked to another business. Add the confirmed URL when available. The AI legal template is only a checklist; its placeholder identity and unsupported insurance/ownership statements were not adopted.

The full form appears on the homepage and on `contact.html`: name, telephone, email, commune, service and message. It uses native validation. **It is a demo form, not connected to a delivery service.** Submitting valid data shows an explicit “no request sent” notice; it sends no network request, stores no form data, and never displays a fake delivery success. Direct telephone links work. Connecting real submissions later requires a recipient email and a configured endpoint (the reference's Web3Forms key was a placeholder).

Before any public release, complete the real business/legal/hosting details, notices and form delivery configuration, and confirm the applicable media/review permissions and attributions. Source repository: https://github.com/Katpst/Business-websites. Pushing source to GitHub does not deploy the website; no public site or outbound customer message has been created.
