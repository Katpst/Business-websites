import type { Business, Snapshot } from './data.ts';

export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const e = escapeHtml;
const paragraph = (value: string): string => value ? `<p>${e(value)}</p>` : '';
const external = (url: string, label: string): string => `<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(label)}</a>`;
const phoneLink = (b: Business): string => `tel:${b.phone.replace(/[^+\d]/g, '')}`;
const section = (id: string, title: string, body: string, style = ''): string => `<section id="${id}" class="${style}"><div class="wrap"><h2>${e(title)}</h2>${body}</div></section>`;
const mapsCredit = '<p class="google-credit"><img src="assets/google-maps-logo.svg" alt="Google Maps" width="98" height="18"></p>';
const roofMark = '<svg class="brand-icon" viewBox="0 0 40 40" width="40" height="40" fill="none" aria-hidden="true"><path d="M4 20 20 6l16 14M9 19v15h22V19" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><path d="M17 25h6v9h-6z" fill="currentColor"/></svg>';
type SitePhoto = NonNullable<Business['hero']['image']>;
const photoCredit = (photo: SitePhoto): string => `<span class="photo-credit">${photo.creditUrl ? external(photo.creditUrl, `Photo : ${photo.credit}`) : e(photo.credit)}</span>`;

function slider(pair: { before: SitePhoto; after: SitePhoto }, id: string, eager = false): string {
  return `<figure class="comparison-figure"><div class="compare" id="${id}" data-comparison role="group" aria-label="Comparaison avant et après nettoyage" style="--pos:50%"><div class="couche"><img src="${e(pair.before.file)}" alt="${e(pair.before.alt)}" width="765" height="1020" loading="${eager ? 'eager' : 'lazy'}"></div><div class="couche apres"><img src="${e(pair.after.file)}" alt="${e(pair.after.alt)}" width="765" height="1020" loading="${eager ? 'eager' : 'lazy'}"></div><span class="etiq etiq-a">AVANT</span><span class="etiq etiq-b">APRÈS</span><div class="poignee" aria-hidden="true"></div></div><input class="compare-range" type="range" min="0" max="100" value="50" id="${id}-range" aria-controls="${id}" aria-label="Part de la photo avant nettoyage" aria-valuetext="50 % avant, 50 % après"></figure>`;
}

function businessLinks(b: Business): string {
  const links = [...(b.google.listingUrl ? [{ label: 'Google Maps', url: b.google.listingUrl }] : []), ...(b.externalLinks ?? [])];
  return links.length ? `<div class="business-links">${links.map(link => external(link.url, `${link.label} ↗`)).join('')}</div>` : '';
}

function projectsSection(b: Business): string {
  if (!b.projects?.length) return '';
  return `<section class="projects" id="realisations"><div class="wrap"><div class="section-heading"><div><p class="eyebrow">Le travail en images</p><h2>Prendre soin de ce qui<br>vous abrite.</h2></div><p>La couverture se construit, se répare et s’entretient. Un aperçu en images.</p></div>${b.projects.map((project, index) => `<article class="project">${project.layout === 'slider' ? slider(project, `project-compare-${index + 1}`) : `<div class="project-pair">${([['Avant', project.before], ['Après', project.after]] as const).map(([label, photo]) => `<figure><a class="project-photo" href="${e(photo.file)}" target="_blank" rel="noopener noreferrer" aria-label="Voir la photo ${label.toLowerCase()} en entier"><img src="${e(photo.file)}" alt="${e(photo.alt)}" loading="lazy" decoding="async"><span class="photo-label">${label}</span><span class="photo-expand" aria-hidden="true">↗</span></a><figcaption>${photoCredit(photo)}</figcaption></figure>`).join('')}</div>`}<div class="project-caption"><h3>${e(project.title)}</h3><p>${e(project.description)}</p></div></article>`).join('')}</div></section>`;
}

function authorCredit(author: Snapshot['place']['reviews'][number]['authorAttribution']): string {
  if (!author) return '';
  const avatar = author.photoUri ? `<img class="avatar" src="${e(author.photoUri)}" width="32" height="32" alt="" loading="lazy" referrerpolicy="no-referrer">` : '';
  const name = e(author.displayName ?? '');
  const content = `${avatar}${name}`;
  return `<span class="author">${author.uri ? `<a href="${e(author.uri)}" target="_blank" rel="noopener noreferrer">${content || 'Profil Google Maps'}</a>` : content}</span>`;
}

function googleSections(snapshot?: Snapshot, listingUrl?: string): string {
  if (!snapshot) return listingUrl ? `<section class="reviews-section reviews-invitation" id="avis"><div class="wrap"><div><p class="eyebrow">Les retours de nos clients</p><h2>Leurs avis sont<br>sur Google.</h2><p class="review-invitation-copy">Consultez les expériences et les avis publiés sur notre fiche Google Maps.</p></div><div class="review-invitation-action">${mapsCredit}<a class="btn btn-plein" href="${e(listingUrl)}" target="_blank" rel="noopener noreferrer">Consulter les avis sur Google <span aria-hidden="true">↗</span></a></div></div></section>` : '';
  const { place, photos } = snapshot;
  const providerCredits = place.attributions.map(item => item.providerUri ? external(item.providerUri, item.provider ?? 'Source') : e(item.provider ?? '')).join(' · ');
  const attribution = `${mapsCredit}${providerCredits ? `<p class="credits">${providerCredits}</p>` : ''}`;
  let html = '';
  if (place.reviews.length || place.rating !== undefined || place.userRatingCount !== undefined) {
    const summary = `${place.rating !== undefined ? `<strong class="rating">${e(String(place.rating).replace('.', ','))}<span> / 5</span></strong>` : ''}${place.userRatingCount !== undefined ? `<span>${place.userRatingCount} avis sur Google Maps</span>` : ''}`;
    const reviews = place.reviews.map(review => {
      const copy = review.originalText ?? review.text;
      const language = copy?.languageCode ? ` lang="${e(copy.languageCode)}"` : '';
      const date = review.publishTime ? `<time datetime="${e(review.publishTime)}">${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(review.publishTime))}</time>` : '';
      const visit = review.visitDate ? `<p class="review-date">Visite : ${String(review.visitDate.month).padStart(2, '0')}/${review.visitDate.year}</p>` : '';
      const links = [review.googleMapsUri ? external(review.googleMapsUri, 'Voir cet avis') : '', review.flagContentUri ? external(review.flagContentUri, 'Signaler') : ''].filter(Boolean).join(' · ');
      return `<article class="review">${authorCredit(review.authorAttribution)}<div class="review-meta">${review.rating !== undefined ? `<span aria-label="${review.rating} sur 5">${review.rating} / 5</span>` : ''}${date}</div>${copy?.text ? `<blockquote${language}>${e(copy.text)}</blockquote>` : ''}${visit}${links ? `<p class="credits">${links}</p>` : ''}</article>`;
    }).join('');
    const reviewUrl = place.googleMapsUri || listingUrl;
    const moreReviews = place.reviews.length === 5 && reviewUrl ? `<aside class="review-more">${mapsCredit}<h3>Tous les avis,<br>sur Google.</h3><p>Retrouvez les retours de nos clients sur notre fiche Google Maps.</p>${external(reviewUrl, 'Voir tous les avis sur Google ?')}</aside>` : '';
    html += section('avis', 'Les retours de nos clients', `<div class="google-summary">${summary}</div>${attribution}${place.reviews.length ? '<p class="section-note">Avis fournis par Google Maps, classés par pertinence. Tous les avis retournés sont affichés, dans leur ordre d’origine ; cette sélection ne représente pas nécessairement tous les avis.</p>' : ''}<div class="reviews-grid">${reviews}${moreReviews}</div>${place.googleMapsUri ? `<p class="source-link">${external(place.googleMapsUri, 'Consulter la fiche sur Google Maps')}</p>` : ''}`, 'reviews-section');
  }
  if (photos.length) {
    html += section('photos', 'Photos de la fiche Google Maps', `${attribution}<div class="photos-grid">${photos.map(photo => `<figure><img class="gallery-photo" src="assets/${e(photo.file)}" alt="Photo publiée sur la fiche Google Maps de l’entreprise" loading="lazy" decoding="async"><figcaption>${photo.authorAttributions.map(authorCredit).join(' ')}${photo.googleMapsUri ? `<p>${external(photo.googleMapsUri, 'Voir cette photo sur Google Maps')}</p>` : ''}${photo.flagContentUri ? `<p>${external(photo.flagContentUri, 'Signaler')}</p>` : ''}</figcaption></figure>`).join('')}</div>`, 'gallery');
  }
  return html;
}

function comparison(b: Business): string {
  const pair = b.beforeAfter;
  if (!pair) return '';
  return `<div>${slider(pair, 'compare', true)}</div>`;
}

function heroPanel(b: Business): string {
  if (b.beforeAfter) return comparison(b);
  if (b.hero.image) return `<div class="hero-visual"><figure class="hero-photo"><img src="${e(b.hero.image.file)}" alt="${e(b.hero.image.alt)}" fetchpriority="high"><figcaption>${photoCredit(b.hero.image)}</figcaption></figure>${b.hero.detailImage ? `<figure class="hero-detail"><img src="${e(b.hero.detailImage.file)}" alt="${e(b.hero.detailImage.alt)}"><figcaption>${photoCredit(b.hero.detailImage)}</figcaption></figure>` : ''}<div class="visual-caption"><span class="caption-rule" aria-hidden="true"></span><span>À chaque toiture,<br>son projet.</span></div></div>`;
  if (!b.services.length) return '';
  return `<aside class="hero-panel" aria-label="Nos prestations"><p class="eyebrow">L’entretien de votre toiture</p><ol>${b.services.map((service, index) => `<li><a href="#service-${index + 1}"><span class="service-index">0${index + 1}</span><span>${e(service.title)}</span><span aria-hidden="true">↗</span></a></li>`).join('')}</ol><div class="panel-location">${e(b.location)}${b.serviceAreas.length ? ' · <a href="#zone">Voir les zones desservies</a>' : ''}</div></aside>`;
}

function legalSection(b: Business, hasGoogle: boolean): string {
  const labels: Record<keyof Business['legal'], string> = { legalName: 'Éditeur', legalForm: 'Forme juridique', shareCapital: 'Capital social', address: 'Siège social', siren: 'SIREN', siret: 'SIRET', registration: 'Immatriculation', vatNumber: 'TVA', publicationDirector: 'Directeur de la publication', insurance: 'Assurance', hosting: 'Hébergeur', mediator: 'Médiateur de la consommation' };
  const rows = (Object.entries(b.legal) as [keyof Business['legal'], string][]).filter(([, value]) => value).map(([key, value]) => `<p><strong>${labels[key]} :</strong> ${e(value)}</p>`).join('');
  const privacy = b.privacyText || hasGoogle ? `<div id="confidentialite"><h3>Confidentialité</h3>${paragraph(b.privacyText)}${hasGoogle ? `<p>Les contenus Google Maps et les images de profil des auteurs sont soumis à la ${external('https://policies.google.com/privacy', 'politique de confidentialité de Google')}.</p>` : ''}</div>` : '';
  const terms = b.termsText || hasGoogle ? `<div id="conditions"><h3>Conditions d’utilisation</h3>${paragraph(b.termsText)}${hasGoogle ? `<p>L’utilisation des contenus Google Maps est soumise aux ${external('https://maps.google.com/help/terms_maps/', 'conditions d’utilisation de Google Maps')}.</p>` : ''}</div>` : '';
  return rows || privacy || terms ? `<div class="legal">${rows ? `<div id="mentions-legales"><h3>Mentions légales</h3>${rows}</div>` : ''}${privacy}${terms}</div>` : '';
}

function contactForm(b: Business): string {
  return `<div class="contact-form-card"><p class="eyebrow">Votre demande, en quelques mots</p><h2>Demandez votre devis.</h2><form data-contact-form hidden><div class="form-row"><div><label for="contact-name">Nom</label><input id="contact-name" name="name" autocomplete="name" maxlength="100" required></div><div><label for="contact-phone">Téléphone</label><input id="contact-phone" name="phone" type="tel" autocomplete="tel" maxlength="30" required></div></div><div class="form-row"><div><label for="contact-email">E-mail</label><input id="contact-email" name="email" type="email" autocomplete="email" maxlength="200" required></div><div><label for="contact-city">Commune</label><input id="contact-city" name="city" autocomplete="address-level2" maxlength="100" required></div></div><label for="contact-service">Votre besoin</label><select id="contact-service" name="service" required><option value="">Choisissez une prestation</option>${b.services.map(service => `<option>${e(service.title)}</option>`).join('')}<option>Autre demande</option></select><label for="contact-message">Précisions sur votre projet</label><textarea id="contact-message" name="message" rows="4" maxlength="3000" placeholder="Type de toiture, travaux envisagés, surface approximative…"></textarea><button class="btn btn-plein" type="submit">Envoyer ma demande <span aria-hidden="true">↗</span></button><p class="form-note">Formulaire de démonstration : aucune demande n’est transmise. Pour nous joindre, utilisez le numéro de téléphone indiqué.</p><p class="form-status" role="status" aria-live="polite"></p></form><noscript><p class="form-note">Pour nous contacter, appelez le numéro indiqué sur cette page.</p></noscript></div>`;
}

function contactPage(b: Business): string {
  return `<section class="contact-page"><div class="wrap"><a class="breadcrumb" href="index.html">← Retour à l’accueil</a><div class="contact-page-grid"><div class="contact-page-intro"><p class="eyebrow">${e(b.name)} · Contact</p><h1>Parlons de<br><span>votre projet.</span></h1><p class="lede">Une toiture à construire, à rénover ou à entretenir ? Décrivez-nous votre besoin et la commune des travaux.</p><div class="contact-methods">${b.phone ? `<a class="contact-method" href="${phoneLink(b)}"><span><small>Appelez-nous</small><strong>${e(b.phone)}</strong></span><span aria-hidden="true">↗</span></a>` : ''}${b.email ? `<a class="contact-method" href="mailto:${e(b.email)}"><span><small>Écrivez-nous</small><strong>${e(b.email)}</strong></span><span aria-hidden="true">↗</span></a>` : ''}${b.address ? `<div class="contact-address"><p class="eyebrow">Notre adresse</p><address>${e(b.address)}</address>${businessLinks(b)}</div>` : businessLinks(b)}</div></div>${contactForm(b)}</div>${b.serviceAreas.length ? `<div class="contact-service-area"><p class="eyebrow">Notre secteur d’intervention</p><ul class="villes">${b.serviceAreas.map(area => `<li>${e(area)}</li>`).join('')}</ul></div>` : ''}</div></section>`;
}

export function render(b: Business, snapshot?: Snapshot, page: 'home' | 'contact' = 'home'): string {
  const brand = b.name || 'Entretien de toiture';
  const isContact = page === 'contact';
  const title = `${isContact ? 'Contact et demande de devis' : b.hero.title} — ${brand}${b.location ? ` à ${b.location}` : ''}`;
  const home = isContact ? 'index.html' : '';
  const hasSlider = !isContact && Boolean(b.beforeAfter || b.projects?.some(project => project.layout === 'slider'));
  const hasContact = Boolean(b.phone || b.email);
  const ratingSummary = snapshot?.place.rating !== undefined ? `<a class="hero-rating" href="#avis"><span aria-hidden="true">★</span><strong>${e(String(snapshot.place.rating).replace('.', ','))} / 5</strong>${snapshot.place.userRatingCount !== undefined ? ` · ${snapshot.place.userRatingCount} avis` : ''}<span translate="no">Google Maps</span></a>` : '';
  const hasGoogle = Boolean(snapshot && (snapshot.place.reviews.length || snapshot.photos.length || snapshot.place.rating !== undefined || snapshot.place.userRatingCount !== undefined));
  const hasReviews = Boolean(snapshot ? snapshot.place.reviews.length || snapshot.place.rating !== undefined || snapshot.place.userRatingCount !== undefined : b.google.listingUrl);
  const navigation = [b.services.length ? `<a href="${home}#prestations">Savoir-faire</a>` : '', b.projects?.length ? `<a href="${home}#realisations">Avant / après</a>` : '', hasReviews ? `<a href="${home}#avis">Avis clients</a>` : '', `<a href="contact.html"${isContact ? ' aria-current="page"' : ''}>Contact</a>`].join('');
  const action = hasContact ? '<a class="btn btn-plein" href="contact.html">Demander un devis</a>' : b.services.length ? '<a class="btn btn-plein" href="#prestations">Découvrir nos prestations</a>' : '';
  const services = b.services.length ? `<section id="prestations" class="services"><div class="wrap"><div class="section-heading"><div><p class="eyebrow">Nos savoir-faire</p><h2>De la construction<br>à l’entretien.</h2></div><p>Un projet neuf, une rénovation ou un besoin ponctuel : découvrez nos prestations pour votre toiture.</p></div><div class="service-grid">${b.services.map((service, index) => `<article class="service-card" id="service-${index + 1}">${service.image ? `<figure class="service-photo"><img src="${e(service.image.file)}" alt="${e(service.image.alt)}" loading="lazy" decoding="async"><figcaption>${photoCredit(service.image)}</figcaption></figure>` : ''}<div class="service-content"><span class="service-number">0${index + 1}</span><h3>${e(service.title)}</h3>${paragraph(service.description)}${service.details?.length ? `<ul class="service-details">${service.details.map(detail => `<li>${e(detail)}</li>`).join('')}</ul>` : ''}${service.price ? `<span class="prix">${e(service.price)}</span>` : ''}${hasContact ? '<a class="text-link" href="#devis">Parlons de votre projet <span aria-hidden="true">↗</span></a>' : ''}</div></article>`).join('')}</div></div></section>` : '';
  const claims = b.verifiedClaims.length ? `<div class="bandeau"><ul class="wrap">${b.verifiedClaims.map(claim => `<li><span aria-hidden="true">✓</span>${e(claim)}</li>`).join('')}</ul></div>` : '';
  const steps = b.steps.length ? section('deroulement', 'Comment ça se passe', `<ol>${b.steps.map(step => `<li><h3>${e(step.title)}</h3>${paragraph(step.description)}</li>`).join('')}</ol>`, 'etapes') : '';
  const areas = b.serviceAreas.length ? `<section id="zone" class="zone"><div class="wrap zone-layout"><div><p class="eyebrow">Pays Basque & Landes</p><h2>À Bayonne,<br>et autour de chez vous.</h2>${b.address ? `<p class="zone-address">${e(b.address)}</p>` : ''}${b.google.listingUrl ? `<p class="source-link">${external(b.google.listingUrl, 'Nous retrouver sur Google Maps ↗')}</p>` : ''}</div><div><p class="zone-intro">Nous intervenons dans les communes et secteurs suivants.</p><ul class="villes">${b.serviceAreas.map(city => `<li>${e(city)}</li>`).join('')}</ul></div></div></section>` : '';
  const about = b.about.title && b.about.paragraphs.length ? section('a-propos', b.about.title, b.about.paragraphs.map(paragraph).join(''), 'prose') : '';
  const contact = hasContact ? `<section class="devis" id="devis"><div class="wrap"><div class="intro"><p class="eyebrow">Et votre projet ?</p><h2>Parlons de<br>votre toiture.</h2><p>Construction, rénovation ou entretien : décrivez-nous votre besoin et le lieu des travaux.</p>${b.phone ? `<a class="gros-tel" href="${phoneLink(b)}">${e(b.phone)} <span aria-hidden="true">↗</span></a>` : ''}${b.address ? `<address>${e(b.address)}</address>` : ''}<p><a href="contact.html">Toutes nos coordonnées ↗</a></p></div>${contactForm(b)}</div></section>` : '';
  const schema = b.name ? { '@context': 'https://schema.org', '@type': 'RoofingContractor', name: b.name, ...(b.phone ? { telephone: b.phone } : {}), ...(b.email ? { email: b.email } : {}), ...(b.address ? { address: b.address } : {}), ...(b.website ? { url: b.website } : {}), ...(b.serviceAreas.length ? { areaServed: b.serviceAreas } : {}) } : undefined;
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)}</title><meta name="description" content="${e(b.hero.description)}">
${b.website ? `<link rel="canonical" href="${e(isContact ? new URL('contact.html', b.website).href : b.website)}"><meta property="og:url" content="${e(isContact ? new URL('contact.html', b.website).href : b.website)}">` : '<meta name="robots" content="noindex, nofollow">'}
<meta property="og:type" content="website"><meta property="og:locale" content="fr_FR"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(b.hero.description)}">
<link rel="stylesheet" href="assets/style.css"><link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
${schema ? `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>` : ''}
${hasSlider ? '<script src="assets/slider.js" defer></script>' : ''}${isContact || hasContact ? '<script src="assets/contact.js" defer></script>' : ''}</head><body>
<a class="skip-link" href="#main">Aller au contenu</a>
<header class="topbar"><div class="wrap"><a class="brand-lockup" href="${home}#main">${roofMark}<span class="marque">${e(brand)}${b.location ? `<span>${e(b.location)} · Pays Basque</span>` : ''}</span></a><nav aria-label="Navigation principale">${navigation}</nav>${b.phone ? `<a class="tel" href="${phoneLink(b)}">${e(b.phone)} <span aria-hidden="true">↗</span></a>` : ''}</div></header>
<main id="main">${isContact ? contactPage(b) : `<div class="hero"><div class="wrap${!b.beforeAfter && !b.hero.image && !b.services.length ? ' hero-single' : ''}"><div class="hero-copy"><p class="eyebrow">${e(b.hero.eyebrow || `Toiture${b.location ? ` · ${b.location}` : ''}`)}</p><h1>${e(b.hero.title)}${b.hero.titleAccent ? `<span>${e(b.hero.titleAccent)}</span>` : ''}</h1>${b.hero.description ? `<p class="lede">${e(b.hero.description)}</p>` : ''}<div class="actions">${action}${b.projects?.length ? '<a class="btn btn-vide" href="#realisations">Voir les photos <span aria-hidden="true">↗</span></a>' : b.phone ? `<a class="btn btn-vide" href="${phoneLink(b)}">Nous appeler</a>` : ''}</div>${ratingSummary}</div>${heroPanel(b)}</div></div>
${claims}${services.replaceAll('href="#devis"', 'href="contact.html"')}${projectsSection(b)}${steps}${googleSections(snapshot, b.google.listingUrl)}${areas}${about}${contact}`}</main>
<footer><div class="wrap"><div class="cols"><div><a class="brand-lockup footer-brand" href="${home}#main">${roofMark}<span class="marque">${e(brand)}${b.location ? `<span>${e(b.location)} · Pays Basque</span>` : ''}</span></a>${paragraph(b.hero.description)}</div>${b.services.length ? `<div><h4>Nos savoir-faire</h4>${b.services.map((service, index) => `<p><a href="${home}#service-${index + 1}">${e(service.title)}</a></p>`).join('')}</div>` : ''}<div><h4>Nous retrouver</h4>${b.address ? `<address>${e(b.address)}</address>` : ''}<p class="source-link"><a href="contact.html">Contact & devis ↗</a></p>${businessLinks(b)}</div></div>${legalSection(b, hasGoogle)}<div class="footer-bottom"><p>${e(brand)}${b.location ? ` · ${e(b.location)}` : ''}</p><a href="#main">Retour en haut ↑</a></div></div></footer>
</body></html>`;
}
