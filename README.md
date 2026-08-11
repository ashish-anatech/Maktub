# Maktub Signature Services — Website

Static site. HTML5, CSS3, vanilla JavaScript. No frameworks, no build step —
upload the files and it runs.

Every page lives at `<name>/index.html` so URLs stay clean (`/pricing/`, not
`/pricing.html`). Serve it from any static host that resolves directory indexes.

## Structure

```
index.html                          Home
about/                              About Maktub — story, capabilities, process, service area
services/                           Services hub (all five services, one page)
pricing/                            Full pricing + worked examples
faq/                                FAQ (with FAQPage schema)
contact/                            Help topics, reach-us grid, booking form, service area
privacy/                            Privacy Policy   (TEMPLATE — review before launch)
terms/                              Terms of Service (TEMPLATE — review before launch)

general-notary/                     General Notary (full published fee schedule)
loan-signings/                      Loan Signings
estate-planning/                    Estate Planning
remote-online-notarization/         Remote Online Notarization
business-notary/                    Business Notary Services

blog/                               Article index — topic filter, featured post, newsletter band
blog/create/                        Post editor — exports a ready-to-publish page
blog/<slug>/                        Six published articles, each with a sticky sidebar (TOC,
                                     recent posts, contact card, categories)

css/style.css                       Single stylesheet. Design tokens are CSS variables in :root.
js/script.js                        Nav, drawer, FAQ, reveal, booking form, newsletter form,
                                     blog filter, post generator, article layout.
assets/                             Logo, favicons, hero video and illustrations.
robots.txt                          Allows crawling, blocks /blog/create/, points to the sitemap.
sitemap.xml                         All 20 URLs.
```

There is no template engine. The header, nav, drawer and footer markup are
duplicated in each page, so a shared change (a new nav item, say) has to be
applied to every file. The site footer is the exception: pages that ship an
empty `<footer class="site-footer"></footer>` get the full footer injected by
`js/script.js`.

## Before you go live

Work through this list in order — the first three are the ones that will
visibly break or embarrass you if skipped.

### 1. Replace the Unsplash photography

**This is the one launch-blocker in the list.** The About, Contact, Pricing,
FAQ, and Blog heroes, the six blog post covers, and the service-page collage
photos are all hotlinked to `images.unsplash.com` / `plus.unsplash.com` —
placeholder images chosen to match each page's subject while there was no
photography to use yet. Hotlinked third-party images are not something to
launch on: they can be swapped or taken down upstream with no warning to you,
they carry no license for commercial use, and they are not real photos of your
business.

Before launch, replace every `images.unsplash.com` / `plus.unsplash.com` URL
with a real, licensed, or owned photo (your own signings, your office, stock
you've actually paid for). They appear in:

```
about/index.html         hero photo, two story photos
contact/index.html       hero photo, closing-card photo
pricing/index.html       hero photo
faq/index.html           hero photo
blog/index.html          hero photo, all 6 post-card thumbnails
blog/<slug>/index.html   cover image (via the `covers` / `POSTS` map in js/script.js)
css/style.css            general-notary / loan-signings / estate-planning /
                          remote-online-notarization / business-notary collage art
```

Search each file for `unsplash.com` to find every instance. In `js/script.js`,
the blog cover images live in one `POSTS` array near the top of the "Article
detail page" section — update the `cover` field for each post there, in one
place, rather than in every article file.

### 2. Point the domain

Every canonical URL, Open Graph tag and sitemap entry uses
`https://www.maktubsignatures.com`. Find and replace that string across all
`.html` files, `sitemap.xml`, and `SITE_ORIGIN` in `js/script.js`.

### 3. Connect the booking form and the newsletter form

Both live in the config block at the top of `js/script.js`:

- **`BOOKING_ENDPOINT`** — set this to your handler URL. It receives a JSON
  `POST` of the form fields (`name`, `phone`, `email`, `service`, `date`,
  `time`, `location`, `message`) and should return a 2xx on success. Left
  empty, the form opens the visitor's mail client with the details prefilled,
  so a request is never silently dropped — but wire up a real endpoint before
  launch.

- **`NEWSLETTER_ENDPOINT`** — the Subscribe form on `/blog/`. Receives a
  `FormData` `POST` with an `email` field. Left empty, it opens a pre-addressed
  email to your own address instead of subscribing anyone.

### 4. Replace the placeholder contact details

The phone number and email are placeholders. They appear in `js/script.js`
(the `CONTACT` object near the top) *and* literally throughout the HTML.
Search and replace all three strings across every file:

```
(253) 555-0100              display text
+12535550100                tel: hrefs
hello@maktubsignatures.com  mailto: hrefs and JSON-LD
```

Also update `"telephone"` and `"email"` in the JSON-LD block in `index.html`.

### 5. Review the legal pages

`privacy/` and `terms/` are drafts, clearly marked as templates on the page
itself. Have them checked against your actual practices and Washington law
before they go live.

### 6. Confirm the service-area list

Tacoma, Lakewood, University Place, Puyallup, Fife, Federal Way, Spanaway,
Bonney Lake, and Gig Harbor are listed across the About, Contact and service
pages. Adjust to match where you actually travel.

### 7. Set up Google Business Profile

For a local service business this drives more traffic than the site does on
its own.

### 8. Optional cleanup

A few image files in `assets/` are leftover from earlier drafts and are not
referenced anywhere in the current site: `hero bg.png`, `hero-background.mp4`,
`hero-illustration.svg`, `spot-photo.jpg`, and
`sven-mieke-dW4idUKM3CM-unsplash.jpg`. Safe to delete once you've confirmed
nothing you add later needs them.

## Publishing a blog post

`/blog/create/` is a browser-only editor, blocked from search indexing
(`noindex` + `robots.txt`) and not linked from anywhere public. Drafts
autosave to `localStorage` on the machine you're writing on — nothing is
uploaded and nothing is shared.

**Download HTML** turns the draft into a finished, crawlable article page and
then shows the three steps to put it live:

1. Save the download as `blog/<slug>/index.html`.
2. Paste the generated card into the `.blog-grid` in `blog/index.html`.
3. Paste the generated `<url>` line into `sitemap.xml`.

New posts also need an entry in the `POSTS` array in `js/script.js` (title,
category, date, read time, cover image) — that's what powers the sidebar's
"Recent posts" list, the "On this page" table of contents, the tags/share
footer, and the hero meta row on every article page.

The post body accepts a small subset of Markdown, split into blocks by blank
lines:

| Syntax | Result |
| --- | --- |
| `## Heading` | `<h2>` (also picked up by the auto table of contents) |
| `- item` | unordered list |
| `1. item` | ordered list |
| `> text` | highlighted callout |
| `**bold**` `_italic_` | inline emphasis |
| `[text](url)` | link |

A block only becomes a list or a callout if *every* line in it matches;
otherwise it renders as a paragraph. Everything is HTML-escaped, so pasted text
cannot break the page.

The **Schema** tab writes JSON-LD into the exported page. Leave the custom field
blank for a sensible generated `Article` schema; paste your own JSON-LD to
override it. Invalid JSON falls back to the generated schema.

## Pricing

All figures come from the supplied fee schedule and appear in four places:
`general-notary/`, `pricing/`, `services/`, and the summary card on
`index.html`. Changing a rate means changing it in all four.

The Washington fee-cap note ($15 per traditional/electronic notarial act, $25
per remote online notarial act, travel billed separately when disclosed and
agreed in advance) is attributed to the Washington State Department of
Licensing.

## Changing the design

Colours, fonts, radii, shadows and spacing are CSS custom properties at the top
of `css/style.css`. Changing `--gold-500` or `--navy-900` there restyles the
whole site. Text throughout the site uses the dark-green ink scale
(`--ink`, `--ink-soft`, `--navy-900`, `--navy-950`) rather than black — keep new
copy on those tokens (or `--muted`/`--gold-*` for secondary text and links) to
stay consistent.

## WordPress migration

The markup was kept clean for this. The shared header and footer map directly to
`header.php` and `footer.php`; each page body becomes a page template or the
content of a WordPress page. `css/style.css` can be enqueued as-is, and the blog
exporter becomes unnecessary once posts live in the WordPress database.
