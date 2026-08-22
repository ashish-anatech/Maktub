/* ==========================================================================
   Maktub Mobile Notary - site scripts
   Vanilla JS. No dependencies.
   Handles: mobile drawer + submenu, sticky header, FAQ accordion,
            scroll reveal, booking form validation, footer year.
   ========================================================================== */
(function () {
  "use strict";

  /* ==========================================================================
     Site configuration - the only two things you must change before launch.
     ========================================================================== */

  /* Booking form destination. Receives a JSON POST of the form fields.
     Leave "" and the form falls back to opening a prefilled email to CONTACT.email,
     so the page never silently swallows a request. */
  var BOOKING_ENDPOINT = "";

  /* PLACEHOLDER CONTACT DETAILS - replace with the real ones.
     These also appear literally in the HTML (header phone link, footers, contact
     page, JSON-LD). Search the project for "(253) 555-0100", "+12535550100" and
     "hello@maktubsignatures.com" to catch every occurrence. */
  var CONTACT = {
    phone: "(253) 555-0100",
    telHref: "+12535550100",
    email: "hello@maktubsignatures.com"
  };

  /* Used for canonical URLs and JSON-LD in posts exported from /blog/create/. */
  var SITE_ORIGIN = "https://www.maktubsignatures.com";
var NEWSLETTER_ENDPOINT = "";

  var reduceMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  var heroVideo = document.querySelector(".hero-background-video");
  if (heroVideo && reduceMotion) heroVideo.pause();

  /* ==========================================================================
     Static post generator
     Turns the editor's fields into a complete blog/<slug>/index.html that
     matches the hand-written articles - crawlable, no backend, no database.
     ========================================================================== */

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function wordCount(text) {
    return String(text || "").trim().split(/\s+/).filter(Boolean).length;
  }

  function inlineMarkup(text) {
    return escapeHtml(text)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/_([^_]+)_/g, "<em>$1</em>");
  }

  // Blank-line separated blocks. A block is a heading, a quote, a list, or a
  // paragraph - mixed blocks fall through to a paragraph rather than guessing.
  function renderBody(source) {
    return String(source || "")
      .replace(/\r\n/g, "\n")
      .split(/\n{2,}/)
      .map(function (block) {
        var lines = block.split("\n").filter(function (line) { return line.trim(); });
        if (!lines.length) return "";

        if (/^#{2,3}\s+/.test(lines[0])) {
          return "<h2>" + inlineMarkup(lines[0].replace(/^#{2,3}\s+/, "")) + "</h2>";
        }
        if (lines.every(function (line) { return /^>\s?/.test(line); })) {
          return '<div class="article-callout"><p>' +
            inlineMarkup(lines.map(function (line) { return line.replace(/^>\s?/, ""); }).join(" ")) +
            "</p></div>";
        }
        if (lines.every(function (line) { return /^\d+[.)]\s+/.test(line); })) {
          return "<ol>" + lines.map(function (line) {
            return "<li>" + inlineMarkup(line.replace(/^\d+[.)]\s+/, "")) + "</li>";
          }).join("") + "</ol>";
        }
        // Checklist lines ("- [ ] item" / "- [x] item") get their own visual
        // treatment - the same gold-check style used on the About page -
        // rather than collapsing into a plain bullet like a generic list.
        if (lines.every(function (line) { return /^[-*]\s*\[[ xX]\]\s+/.test(line); })) {
          return '<ul class="checklist article-checklist">' + lines.map(function (line) {
            var done = /^[-*]\s*\[[xX]\]/.test(line);
            var text = line.replace(/^[-*]\s*\[[ xX]\]\s+/, "");
            return '<li' + (done ? ' class="is-done"' : '') + '><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.2l2.4 2.4 4.6-4.8"/></svg><span>' +
              inlineMarkup(text) + "</span></li>";
          }).join("") + "</ul>";
        }
        if (lines.every(function (line) { return /^[-*]\s+/.test(line); })) {
          return "<ul>" + lines.map(function (line) {
            return "<li>" + inlineMarkup(line.replace(/^[-*]\s+/, "")) + "</li>";
          }).join("") + "</ul>";
        }
        return "<p>" + inlineMarkup(lines.join(" ")) + "</p>";
      })
      .filter(Boolean)
      .join("\n      ");
  }

  function longDate(date) {
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }

  function postSchema(data, url, isoDate) {
    if (data.schemaMarkup) {
      try { return JSON.stringify(JSON.parse(data.schemaMarkup), null, 2); }
      catch (error) { /* Fall through to the generated schema below. */ }
    }
    return JSON.stringify({
      "@context": "https://schema.org",
      "@type": data.schemaType || "Article",
      headline: data.title,
      description: data.excerpt || data.title,
      image: data.cover || SITE_ORIGIN + "/assets/logo.png",
      datePublished: isoDate,
      mainEntityOfPage: url,
      author: { "@type": "Organization", name: "Maktub Mobile Notary" },
      publisher: {
        "@type": "Organization",
        name: "Maktub Mobile Notary",
        logo: { "@type": "ImageObject", url: SITE_ORIGIN + "/assets/logo.png" }
      }
    }, null, 2);
  }

  // The same full header (logo, dropdown, nav, phone, burger + mobile drawer)
  // used on every hand-authored page, with one nav item marked is-active.
  // Exported posts always pass "blog" - kept parameterized in case this
  // export tooling grows to cover other page types later.
  function siteHeaderHtml(activeKey) {
    function navItem(href, label, key) {
      return '<li><a href="' + href + '"' + (key === activeKey ? ' class="is-active"' : "") + '>' + label + '</a></li>';
    }
    return '<header class="site-header" id="site-header">\n' +
'  <div class="header-inner">\n' +
'    <a href="/" class="brand" aria-label="Maktub Mobile Notary home page">\n' +
'      <img class="brand-mark" src="/assets/logo-mark.png" width="44" height="44" alt="Maktub Mobile Notary logo" fetchpriority="high">\n' +
'      <span class="brand-text"><span class="brand-name">Maktub</span><span class="brand-sub">Mobile Notary</span></span>\n' +
'    </a>\n' +
'    <nav class="nav" aria-label="Primary">\n' +
'      <ul>\n' +
'        <li class="has-menu">\n' +
'          <button class="nav-trigger" aria-expanded="false" aria-haspopup="true">Services <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/><\/svg></button>\n' +
'          <ul class="submenu">\n' +
'          <li><a href="/general-notary/"><span class="submenu-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11V7a3 3 0 0 1 6 0v4"/><path d="M5 15h14l1 5H4l1-5z"/><path d="M4 22h16"/><\/svg></span><span class="submenu-copy"><span class="submenu-title">General Notary</span><span class="submenu-desc">Everyday documents, signed and sealed</span></span></a></li>\n' +
'          <li><a href="/loan-signings/"><span class="submenu-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5"/><path d="M10 21v-6h4v6"/><\/svg></span><span class="submenu-copy"><span class="submenu-title">Loan Signings</span><span class="submenu-desc">Purchase, refinance, HELOC packages</span></span></a></li>\n' +
'          <li><a href="/estate-planning/"><span class="submenu-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/><\/svg></span><span class="submenu-copy"><span class="submenu-title">Estate Planning</span><span class="submenu-desc">Wills, trusts, POAs, directives</span></span></a></li>\n' +
'          <li><a href="/remote-online-notarization/"><span class="submenu-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/><path d="M10.5 10.5a1.5 1.5 0 1 1 3 0"/><\/svg></span><span class="submenu-copy"><span class="submenu-title">Remote Online Notarization</span><span class="submenu-desc">Notarize from anywhere in WA</span></span></a></li>\n' +
'          <li><a href="/business-notary/"><span class="submenu-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/><\/svg></span><span class="submenu-copy"><span class="submenu-title">Business Notary</span><span class="submenu-desc">Contracts and corporate records</span></span></a></li>\n' +
'            <li class="submenu-all"><a href="/services/"><span class="submenu-copy"><span class="submenu-title">All services</span><span class="submenu-desc">Compare every service and fee</span></span></a></li>\n' +
'          </ul>\n' +
'        </li>\n' +
        navItem("/pricing/", "Pricing", "pricing") +
        navItem("/about/", "About", "about") +
        navItem("/blog/", "Blog", "blog") +
        navItem("/faq/", "FAQ", "faq") +
        navItem("/contact/", "Contact", "contact") +
'      </ul>\n' +
'    </nav>\n' +
'    <div class="header-actions">\n' +
'      <a class="header-phone" href="tel:' + CONTACT.telHref + '" aria-label="Call Maktub Mobile Notary at ' + CONTACT.phone + '"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .3 1.9.6 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.8.6a2 2 0 0 1 1.7 2z"/><\/svg><span>' + CONTACT.phone + '<\/span></a>\n' +
'      <a href="/blog/" class="btn btn-outline btn-sm">Back to blog</a><a href="/contact/" class="btn btn-navy btn-sm">Book a Notary</a>\n' +
'      <button class="burger" id="burger" aria-expanded="false" aria-controls="drawer" aria-label="Open menu"><span></span><span></span><span></span></button>\n' +
'    </div>\n' +
'  </div>\n' +
'  <div class="drawer" id="drawer" hidden>\n' +
'    <ul>\n' +
'      <li>\n' +
'        <button class="sub-toggle" id="sub-toggle" aria-expanded="false" aria-controls="drawer-services">Services <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/><\/svg></button>\n' +
'        <div class="drawer-sub" id="drawer-services">\n' +
'          <ul>\n' +
'            <li><a href="/services/">All Services</a></li>\n' +
'            <li><a href="/general-notary/">General Notary</a></li>\n' +
'            <li><a href="/loan-signings/">Loan Signings</a></li>\n' +
'            <li><a href="/estate-planning/">Estate Planning</a></li>\n' +
'            <li><a href="/remote-online-notarization/">Remote Online Notarization</a></li>\n' +
'            <li><a href="/business-notary/">Business Notary</a></li>\n' +
'          </ul>\n' +
'        </div>\n' +
'      </li>\n' +
'      <li><a href="/pricing/">Pricing</a></li>\n' +
'      <li><a href="/about/">About</a></li>\n' +
'      <li><a href="/blog/">Blog</a></li>\n' +
'      <li><a href="/faq/">FAQ</a></li>\n' +
'      <li><a href="/contact/">Contact</a></li>\n' +
'    </ul>\n' +
'    <a href="/contact/" class="btn btn-gold btn-block">Book a Notary</a>\n' +
'  </div>\n' +
'</header>';
  }

  function buildArticleHtml(data, published) {
    var url = SITE_ORIGIN + "/blog/" + data.slug + "/";
    var description = data.excerpt || data.title;
    var socialTitle = data.socialTitle || data.title;
    var socialDescription = data.socialDescription || description;
    var readMinutes = Math.max(1, Math.round(wordCount(data.content) / 200));
    var category = data.category || "Blog";
    var dateText = longDate(published);

    // Metadata is stamped onto .article-body as data- attributes rather than
    // hardcoded into the markup below. js/script.js reads these at runtime to
    // build the hero meta icons, the cover figure, and the tags/share footer -
    // the exact same code path the six hand-written launch articles use - so
    // an exported post looks and behaves identically the moment it is dropped
    // into blog/<slug>/index.html, with no further edits required.
    var dataAttrs =
      ' data-post-title="' + escapeHtml(data.title) + '"' +
      ' data-post-category="' + escapeHtml(category) + '"' +
      ' data-post-date="' + escapeHtml(dateText) + '"' +
      ' data-post-read="' + readMinutes + ' min read"' +
      (data.cover ? ' data-post-cover="' + escapeHtml(data.cover) + '" data-post-cover-alt="' + escapeHtml("Featured image for " + data.title) + '"' : "");

    return '<!DOCTYPE html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'  <meta charset="UTF-8">\n' +
'  <meta name="viewport" content="width=device-width, initial-scale=1">\n' +
'  <title>' + escapeHtml(data.title) + ' | Maktub</title>\n' +
'  <meta name="description" content="' + escapeHtml(description) + '">\n' +
'  <meta name="theme-color" content="#0d2927">\n' +
'  <link rel="canonical" href="' + url + '">\n' +
'\n' +
'  <meta property="og:type" content="article">\n' +
'  <meta property="og:site_name" content="Maktub Mobile Notary">\n' +
'  <meta property="og:title" content="' + escapeHtml(socialTitle) + '">\n' +
'  <meta property="og:description" content="' + escapeHtml(socialDescription) + '">\n' +
'  <meta property="og:url" content="' + url + '">\n' +
'  <meta property="og:image" content="' + escapeHtml(data.cover || SITE_ORIGIN + "/assets/logo.png") + '">\n' +
'  <meta name="twitter:card" content="summary_large_image">\n' +
'\n' +
'  <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">\n' +
'  <link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon-16.png">\n' +
'  <link rel="apple-touch-icon" sizes="180x180" href="/assets/apple-touch-icon.png">\n' +
'\n' +
'  <link rel="preconnect" href="https://fonts.googleapis.com">\n' +
'  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
'  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap">\n' +
'  <link rel="stylesheet" href="/css/style.css">\n' +
'\n' +
'  <script type="application/ld+json">\n' + postSchema(data, url, published.toISOString()) + '\n  <\/script>\n' +
'</head>\n' +
'<body class="light-hero">\n' +
'<a class="skip-link" href="#main">Skip to main content</a>\n' +
siteHeaderHtml("blog") +
'<main id="main">\n' +
'<section class="hero aurora on-dark hero-compact">\n' +
'    <div class="aurora-bg" aria-hidden="true"></div>\n' +
'    <span class="orb orb-1" aria-hidden="true"></span>\n' +
'    <span class="orb orb-2" aria-hidden="true"></span>\n' +
'    <span class="orb orb-3" aria-hidden="true"></span>\n' +
'    <nav class="crumbs" aria-label="Breadcrumb"><div class="wrap"><ol><li><a href="/">Home</a></li><li><a href="/blog/">Blog</a></li><li aria-current="page">' + escapeHtml(data.title) + '</li></ol></div></nav>\n' +
'    <div class="wrap hero-inner center">\n' +
'      <p class="eyebrow eyebrow-light" data-reveal>' + escapeHtml(category) + '</p>\n' +
'      <h1 class="h-xl" data-reveal>' + escapeHtml(data.title) + '</h1>\n' +
'      <div class="article-meta" data-reveal><span>' + dateText + '</span><span>' + readMinutes + ' min read</span></div>\n' +
'    </div>\n' +
'  </section><section class="section"><article class="wrap article-body"' + dataAttrs + '>' +
(data.excerpt ? '<p class="lede">' + escapeHtml(data.excerpt) + '</p>' : "") +
renderBody(data.content) +
'<p><a class="btn btn-gold" href="/contact/">Book a notary</a></p></article></section>\n' +
'</main><footer class="site-footer"></footer><script src="/js/script.js"><\/script></body></html>\n';
  }

  // Matches the exact markup of every card already in blog/index.html -
  // same classes, same data-category attribute the topic filter reads, same
  // "Read article" link - so a pasted card fits the grid with no rework.
  function buildCardHtml(data, published) {
    var category = data.category || "Blog";
    var href = "/blog/" + data.slug + "/";
    var readMinutes = Math.max(1, Math.round(wordCount(data.content) / 200));
    var dateText = published.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    var thumb = data.cover
      ? '<a class="post-thumb" href="' + href + '" tabindex="-1" aria-hidden="true"><img src="' + escapeHtml(data.cover) + '" alt="' + escapeHtml(data.title) + '" loading="lazy"></a>'
      : '<a class="post-thumb post-thumb--empty" href="' + href + '" tabindex="-1" aria-hidden="true"></a>';

    return '<article class="post-card" data-category="' + escapeHtml(category) + '">\n' +
      '          ' + thumb + '\n' +
      '          <div class="post-copy">\n' +
      '            <span class="post-cat">' + escapeHtml(category) + '</span>\n' +
      '            <h3><a href="' + href + '">' + escapeHtml(data.title) + '</a></h3>\n' +
      '            <p class="post-excerpt">' + escapeHtml(data.excerpt || "") + '</p>\n' +
      '            <p class="post-facts"><span>' + dateText + '</span><span class="post-sep" aria-hidden="true"></span><span>' + readMinutes + ' min read</span></p>\n' +
      '            <span class="post-link link-arrow" aria-hidden="true">Read article &rarr;</span>\n' +
      '          </div>\n' +
      '        </article>';
  }

  function buildSitemapEntry(data) {
    return '  <url><loc>' + SITE_ORIGIN + '/blog/' + data.slug + '/</loc><priority>0.6</priority></url>';
  }

  function downloadFile(filename, contents) {
    var blob = new Blob([contents], { type: "text/html;charset=utf-8" });
    var objectUrl = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 0);
  }

  /* ---------- Blog editor ---------- */
  var editor = document.querySelector("[data-blog-editor]");
  if (editor) {
    var titleField = document.getElementById("post-title");
    var slugField = document.getElementById("post-slug");
    var form = editor.querySelector(".editor-form");
    var statusMessage = editor.querySelector(".editor-status");
    var previewButton = document.querySelector("[data-editor-preview]");
    var saveButton = document.querySelector("[data-editor-save]");
    var exportButton = document.querySelector("[data-editor-export]");
    var previewSection = document.querySelector("[data-preview-section]");
    var exportSection = document.querySelector("[data-export-section]");
    var storageKey = "maktub-blog-draft";

    function slugify(value) {
      return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    }
    function fields() {
      var data = {};
      Array.prototype.forEach.call(editor.querySelectorAll("input, select, textarea"), function (field) {
        var key = field.name || field.id;
        if (key) data[key] = field.type === "checkbox" ? field.checked : field.value.trim();
      });
      return data;
    }
    function saveDraft(message) {
      window.localStorage.setItem(storageKey, JSON.stringify(fields()));
      statusMessage.textContent = message || "Draft saved on this device.";
    }
    function updatePostUrl() {
      var slug = slugField.value || "your-post-title";
      Array.prototype.forEach.call(editor.querySelectorAll("[data-inspector-url]"), function (el) { el.textContent = "/blog/" + slug; });
    }
    function exportPost() {
      var data = fields();
      data.slug = data.slug || slugify(data.title);
      if (!data.title || !data.content) { statusMessage.textContent = "Add a title and post content before exporting."; return; }
      if (!data.slug) { statusMessage.textContent = "Add a valid permalink before exporting."; return; }

      var published = new Date();
      downloadFile(data.slug + ".html", buildArticleHtml(data, published));

      document.querySelector("[data-export-path]").textContent = "blog/" + data.slug + "/index.html";
      document.querySelector("[data-export-card]").value = buildCardHtml(data, published);
      document.querySelector("[data-export-sitemap]").value = buildSitemapEntry(data);
      exportSection.hidden = false;
      exportSection.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });

      saveDraft("Downloaded " + data.slug + ".html. Follow the three steps below to put it live.");
    }
    var previewCloseButton = document.querySelector("[data-preview-close]");
    var previewFigure = document.querySelector("[data-preview-figure]");
    var previewImage = document.querySelector("[data-preview-image]");
    var previewContent = document.querySelector("[data-preview-content]");
    var previewMeta = document.querySelector("[data-preview-meta]");
    var previewUrl = document.querySelector("[data-preview-url]");

    // A failed cover URL should collapse the figure, not leave a broken icon.
    if (previewImage) {
      previewImage.addEventListener("error", function () {
        if (previewFigure) previewFigure.hidden = true;
      });
    }

    // Renders through renderBody() - the same converter that writes the
    // downloaded file - so the preview is what actually gets published.
    function renderPreview() {
      if (!previewSection || previewSection.hidden) return;
      var data = fields();
      var words = wordCount(data.content);

      document.querySelector("[data-preview-title]").textContent = data.title || "Your post title";
      document.querySelector("[data-preview-category]").textContent = data.category || "Blog";

      var excerptEl = document.querySelector("[data-preview-excerpt]");
      excerptEl.textContent = data.excerpt || "Your post excerpt will appear here.";
      excerptEl.classList.toggle("is-placeholder", !data.excerpt);

      if (previewMeta) {
        previewMeta.innerHTML = "<span>" + escapeHtml(longDate(new Date())) + "</span>" +
          "<span>" + Math.max(1, Math.round(words / 200)) + " min read</span>" +
          "<span>" + words + " word" + (words === 1 ? "" : "s") + "</span>";
      }

      if (previewUrl) {
        previewUrl.textContent = "/blog/" + (data.slug || slugify(data.title) || "your-post-title") + "/";
      }

      if (data.cover) {
        previewFigure.hidden = false;
        if (previewImage.getAttribute("src") !== data.cover) previewImage.src = data.cover;
        previewImage.alt = data.title ? "Featured image for " + data.title : "";
      } else {
        previewFigure.hidden = true;
        previewImage.removeAttribute("src");
      }

      previewContent.innerHTML = data.content
        ? renderBody(data.content)
        : '<p class="is-placeholder">Start writing to preview your post content.</p>';
    }

    function showPreview() {
      previewSection.hidden = false;
      previewButton.setAttribute("aria-expanded", "true");
      renderPreview();
      previewSection.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    }

    function hidePreview() {
      previewSection.hidden = true;
      previewButton.setAttribute("aria-expanded", "false");
      previewButton.focus();
    }

    if (previewCloseButton) previewCloseButton.addEventListener("click", hidePreview);

    // Programmatic textarea edits (toolbar, block inserter) need to announce
    // themselves so every listener stays in sync.
    function notifyContentChanged(field) {
      if (typeof window.Event === "function") {
        field.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        updateWordCount();
        renderPreview();
      }
    }

    // Keep the preview in step with the form while it is open.
    if (form) {
      form.addEventListener("input", renderPreview);
      form.addEventListener("change", renderPreview);
    }

    try {
      var savedDraft = JSON.parse(window.localStorage.getItem(storageKey));
      if (savedDraft) Object.keys(savedDraft).forEach(function (key) { var field = editor.querySelector('[name="' + key + '"]') || document.getElementById(key); if (field) { if (field.type === "checkbox") field.checked = Boolean(savedDraft[key]); else field.value = savedDraft[key]; } });
    } catch (error) { window.localStorage.removeItem(storageKey); }

    function updateWordCount() {
      var count = wordCount(document.getElementById("post-content").value);
      var wordCountEl = editor.querySelector("[data-word-count]");
      if (wordCountEl) wordCountEl.textContent = "Word count: " + count;
      var readabilityScore = editor.querySelector("[data-readability-score]");
      if (readabilityScore) readabilityScore.textContent = count ? count + " words written. Aim for clear, scannable sections." : "Start writing to see your word count.";
    }
    titleField.addEventListener("input", function () { if (!slugField.dataset.edited) slugField.value = slugify(titleField.value); updatePostUrl(); });
    slugField.addEventListener("input", function () { slugField.dataset.edited = "true"; updatePostUrl(); });
    updatePostUrl();
    document.getElementById("post-content").addEventListener("input", updateWordCount);
    updateWordCount();
    saveButton.addEventListener("click", function () { saveDraft(); });
    previewButton.addEventListener("click", showPreview);
    exportButton.addEventListener("click", exportPost);
    Array.prototype.forEach.call(editor.querySelectorAll("[data-copy-target]"), function (button) {
      button.addEventListener("click", function () {
        var field = editor.querySelector(button.dataset.copyTarget);
        field.select();
        try {
          document.execCommand("copy");
          button.textContent = "Copied";
          window.setTimeout(function () { button.textContent = "Copy"; }, 1600);
        } catch (error) {
          statusMessage.textContent = "Copy failed. Select the text and copy it manually.";
        }
      });
    });
    Array.prototype.forEach.call(editor.querySelectorAll("[data-format]"), function (button) {
      button.addEventListener("click", function () {
        var content = document.getElementById("post-content");
        var start = content.selectionStart, end = content.selectionEnd, selected = content.value.slice(start, end) || "text";
        var formats = { bold: "**" + selected + "**", italic: "_" + selected + "_", heading: "## " + selected, list: "- " + selected, quote: "> " + selected };
        content.setRangeText(formats[button.dataset.format], start, end, "end"); content.focus();
        // setRangeText does not fire "input", so the word count and the live
        // preview would otherwise miss anything typed via the toolbar.
        notifyContentChanged(content);
      });
    });
    Array.prototype.forEach.call(editor.querySelectorAll("[data-add-media]"), function (button) {
      button.addEventListener("click", function () {
        document.getElementById("post-cover").focus();
        statusMessage.textContent = "Paste a featured-image URL in the post settings panel.";
      });
    });
    Array.prototype.forEach.call(editor.querySelectorAll("[data-seo-tab]"), function (tab) {
      tab.addEventListener("click", function () {
        var selected = tab.dataset.seoTab;
        Array.prototype.forEach.call(editor.querySelectorAll("[data-seo-tab]"), function (other) {
          var active = other === tab;
          other.classList.toggle("is-active", active);
          other.setAttribute("aria-selected", active ? "true" : "false");
        });
        Array.prototype.forEach.call(editor.querySelectorAll("[data-seo-panel]"), function (panel) {
          panel.hidden = panel.dataset.seoPanel !== selected;
        });
      });
    });
    Array.prototype.forEach.call(editor.querySelectorAll("[data-inspector-tab]"), function (tab) {
      tab.addEventListener("click", function () {
        var selected = tab.dataset.inspectorTab;
        Array.prototype.forEach.call(editor.querySelectorAll("[data-inspector-tab]"), function (other) {
          var active = other === tab;
          other.classList.toggle("is-active", active);
          other.setAttribute("aria-selected", active ? "true" : "false");
        });
        Array.prototype.forEach.call(editor.querySelectorAll("[data-inspector-panel]"), function (panel) {
          panel.hidden = panel.dataset.inspectorPanel !== selected;
        });
      });
    });
    var insertBlockButton = editor.querySelector("[data-insert-block]");
    if (insertBlockButton) {
      insertBlockButton.addEventListener("click", function () {
        var blockType = document.getElementById("post-block-type").value;
        var blocks = { paragraph: "\n\nWrite your paragraph here.", heading: "\n\n## Add a heading", quote: "\n\n> Add a memorable quote", checklist: "\n\n- [ ] First checklist item\n- [ ] Second checklist item" };
        var content = document.getElementById("post-content");
        var position = content.selectionStart;
        content.setRangeText(blocks[blockType], position, content.selectionEnd, "end");
        content.focus();
        notifyContentChanged(content);
        statusMessage.textContent = "" + blockType.charAt(0).toUpperCase() + blockType.slice(1) + " block inserted.";
      });
    }
  }

  /* ---------- Home page logo reveal ----------
     The 3s pen-drawing intro lives in js/logo-reveal.js and is wired into
     index.html directly, so nothing is injected from here. */

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Sticky header state ---------- */
  var header = document.getElementById("site-header");
  if (header) {
    var stuck = false;
    var onScroll = function () {
      var next = window.scrollY > 8;
      if (next !== stuck) {
        header.classList.toggle("is-stuck", next);
        stuck = next;
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- Mobile drawer ---------- */
  var burger = document.getElementById("burger");
  var drawer = document.getElementById("drawer");

  function closeDrawer() {
    if (!drawer || !burger) return;
    drawer.hidden = true;
    burger.setAttribute("aria-expanded", "false");
    burger.setAttribute("aria-label", "Open menu");
  }

  function openDrawer() {
    if (!drawer || !burger) return;
    drawer.hidden = false;
    burger.setAttribute("aria-expanded", "true");
    burger.setAttribute("aria-label", "Close menu");
  }

  if (burger && drawer) {
    burger.addEventListener("click", function () {
      if (burger.getAttribute("aria-expanded") === "true") closeDrawer();
      else openDrawer();
    });

    // Close when a real link is followed
    Array.prototype.forEach.call(drawer.querySelectorAll("a"), function (a) {
      a.addEventListener("click", closeDrawer);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && burger.getAttribute("aria-expanded") === "true") {
        closeDrawer();
        burger.focus();
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 1040) closeDrawer();
    });
  }

  /* ---------- Drawer submenu (Services) ---------- */
  Array.prototype.forEach.call(
    document.querySelectorAll(".sub-toggle"),
    function (toggle) {
      var panel = document.getElementById(toggle.getAttribute("aria-controls"));
      if (!panel) return;
      toggle.addEventListener("click", function () {
        var open = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", open ? "false" : "true");
        panel.classList.toggle("is-open", !open);
      });
    }
  );

  /* ---------- Desktop submenu: close on Escape ---------- */
  Array.prototype.forEach.call(
    document.querySelectorAll(".has-menu"),
    function (item) {
      item.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          var trigger = item.querySelector(".nav-trigger");
          if (trigger) trigger.focus();
          // Blur inside the menu so :focus-within releases it
          if (document.activeElement && item.contains(document.activeElement)) {
            document.activeElement.blur();
          }
        }
      });
    }
  );

  /* ---------- FAQ accordion ----------
     bindFaqAccordion() is reusable so FAQ blocks injected later (eg. the
     per-article FAQ section on blog posts) get the same click-to-expand
     behaviour without duplicating this logic. */
  function bindFaqAccordion(buttons) {
    Array.prototype.forEach.call(buttons, function (btn) {
      var panel = btn.nextElementSibling;
      if (!panel) return;

      btn.addEventListener("click", function () {
        var isOpen = btn.getAttribute("aria-expanded") === "true";

        // Single-open accordion keeps the page tidy
        Array.prototype.forEach.call(document.querySelectorAll(".faq-q"), function (other) {
          if (other === btn) return;
          other.setAttribute("aria-expanded", "false");
          if (other.nextElementSibling) other.nextElementSibling.style.maxHeight = null;
        });

        btn.setAttribute("aria-expanded", isOpen ? "false" : "true");
        panel.style.maxHeight = isOpen ? null : panel.scrollHeight + "px";
      });
    });
  }
  bindFaqAccordion(document.querySelectorAll(".faq-q"));

  // Keep an open answer correctly sized if the viewport reflows
  window.addEventListener("resize", function () {
    Array.prototype.forEach.call(document.querySelectorAll(".faq-q"), function (btn) {
      if (btn.getAttribute("aria-expanded") === "true" && btn.nextElementSibling) {
        btn.nextElementSibling.style.maxHeight = btn.nextElementSibling.scrollHeight + "px";
      }
    });
  });

  /* ---------- Scroll reveal ---------- */
  var revealables = document.querySelectorAll("[data-reveal]");
  if (revealables.length) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(revealables, function (el) {
        el.classList.add("in");
      });
    } else {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry, i) {
            if (!entry.isIntersecting) return;
            var delay = Math.min(i, 4) * 70;
            setTimeout(function () {
              entry.target.classList.add("in");
            }, delay);
            observer.unobserve(entry.target);
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -50px 0px" }
      );
      Array.prototype.forEach.call(revealables, function (el) {
        observer.observe(el);
      });
    }
  }

  /* ---------- Bento card pointer highlight ---------- */
  var bentoSection = document.querySelector(".bento");
  var activeCard = null;

  function updateCardPointer(card, e) {
    if (!card) return;
    var rect = card.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;
    if (x < 0 || x > rect.width || y < 0 || y > rect.height) return;
    card.style.setProperty("--mouse-x", x + "px");
    card.style.setProperty("--mouse-y", y + "px");
  }

  if (bentoSection) {
    bentoSection.addEventListener("pointermove", function (e) {
      var card = e.target.closest(".bento-card");
      if (card && bentoSection.contains(card)) {
        if (activeCard !== card) {
          if (activeCard) {
            activeCard.classList.remove("is-hovered");
            activeCard.style.setProperty("--mouse-x", "50%");
            activeCard.style.setProperty("--mouse-y", "50%");
          }
          activeCard = card;
          activeCard.classList.add("is-hovered");
        }
        updateCardPointer(activeCard, e);
      } else if (activeCard) {
        activeCard.classList.remove("is-hovered");
        activeCard.style.setProperty("--mouse-x", "50%");
        activeCard.style.setProperty("--mouse-y", "50%");
        activeCard = null;
      }
    });

    bentoSection.addEventListener("pointerleave", function () {
      if (activeCard) {
        activeCard.classList.remove("is-hovered");
        activeCard.style.setProperty("--mouse-x", "50%");
        activeCard.style.setProperty("--mouse-y", "50%");
        activeCard = null;
      }
    });
  }

  /* ---------- Booking form ---------- */
  var form = document.getElementById("booking-form");
  var status = document.getElementById("form-status");

  if (form && status) {
    var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Clear the invalid flag and error message as soon as the visitor starts fixing a field
    Array.prototype.forEach.call(form.querySelectorAll("input, select, textarea"), function (f) {
      f.addEventListener("input", function () {
        f.removeAttribute("aria-invalid");
        var error = document.getElementById(f.id + "-error");
        if (error) error.textContent = "";
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var firstBad = null;
      var errors = 0;

      Array.prototype.forEach.call(form.querySelectorAll("[required]"), function (field) {
        var errorEl = document.getElementById(field.id + "-error");
        var value = field.value ? field.value.trim() : "";
        if (!value) {
          field.setAttribute("aria-invalid", "true");
          if (errorEl) errorEl.textContent = "This field is required.";
          if (!firstBad) firstBad = field;
          errors += 1;
        } else {
          field.removeAttribute("aria-invalid");
          if (errorEl) errorEl.textContent = "";
        }
      });

      var email = form.querySelector("#email");
      if (email && email.value && !emailRe.test(email.value)) {
        email.setAttribute("aria-invalid", "true");
        var emailError = document.getElementById("email-error");
        if (emailError) emailError.textContent = "Enter a valid email address.";
        if (!firstBad) firstBad = email;
        errors += 1;
      }

      status.classList.remove("is-ok", "is-error");
      status.textContent = "";

      if (errors) {
        status.textContent = "Please fix the highlighted fields before sending.";
        status.classList.add("is-error");
        if (firstBad) firstBad.focus();
        return;
      }

      var payload = {};
      Array.prototype.forEach.call(form.querySelectorAll("input, select, textarea"), function (f) {
        if (f.name) payload[f.name] = f.value.trim();
      });

      // With no endpoint configured, hand the request to the visitor's mail client
      // rather than pretending it was sent.
      if (!BOOKING_ENDPOINT) {
        window.location.href = mailtoFallback(payload);
        status.textContent =
          "Opening your email app with these details. If nothing happens, call " +
          CONTACT.phone + " or email " + CONTACT.email + ".";
        status.classList.add("is-ok");
        return;
      }

      var submitButton = form.querySelector("button[type=submit], input[type=submit]");
      if (submitButton) submitButton.disabled = true;
      status.textContent = "Sending your request…";

      window.fetch(BOOKING_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (response) {
          if (!response.ok) throw new Error("Request failed with status " + response.status);
          status.textContent =
            "Thank you. Your request has been received. We'll follow up to confirm your appointment time and total cost.";
          status.classList.add("is-ok");
          form.reset();
        })
        .catch(function () {
          status.textContent =
            "Sorry, that did not send. Please call " + CONTACT.phone + " or email " +
            CONTACT.email + " and we will get you booked.";
          status.classList.add("is-error");
        })
        .then(function () {
          if (submitButton) submitButton.disabled = false;
        });
    });
  }

  function mailtoFallback(payload) {
    var lines = Object.keys(payload).map(function (key) {
      var label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1");
      return label + ": " + (payload[key] || "-");
    });
    return "mailto:" + CONTACT.email +
      "?subject=" + encodeURIComponent("Appointment request from " + (payload.name || "Website")) +
      "&body=" + encodeURIComponent(lines.join("\n"));
  }

  /* ---------- Directions button ---------- */
  var directionsButton = document.getElementById("get-directions");
  if (directionsButton) {
    directionsButton.addEventListener("click", function () {
      if (!navigator.geolocation) {
        window.location.href = "https://www.google.com/maps/dir/?api=1&destination=Tacoma+WA";
        return;
      }

      navigator.geolocation.getCurrentPosition(
        function (position) {
          var lat = position.coords.latitude;
          var lng = position.coords.longitude;
          var url = "https://www.google.com/maps/dir/?api=1&origin=" + lat + "," + lng + "&destination=Tacoma+WA";
          window.location.href = url;
        },
        function () {
          window.location.href = "https://www.google.com/maps/dir/?api=1&destination=Tacoma+WA";
        },
        { timeout: 8000 }
      );
    });
  }

  /* ---------- Article detail page: content + sidebar ----------
     Mirrors a classic editorial blog layout: hero meta row, wide article
     column, and a sticky sidebar of contextual widgets.                  */
  var POSTS = [
    { slug: "notary-appointment-checklist", title: "What to bring to your notary appointment", cat: "General Notary", date: "May 18, 2026", read: "4 min read", cover: ["https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1400&q=85", "Notary documents on a desk"] },
    { slug: "loan-signing-closing-guide", title: "How a loan signing agent protects your closing", cat: "Loan Signings", date: "April 29, 2026", read: "4 min read", cover: ["https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1400&q=85", "People reviewing documents at a desk"] },
    { slug: "estate-planning-notarization-basics", title: "Wills, trusts, and notarization basics", cat: "Estate Planning", date: "April 10, 2026", read: "4 min read", cover: ["https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1400&q=85", "Estate planning documents and a pen"] },
    { slug: "certified-copies-guide", title: "Why certified copies matter", cat: "Document Authentication", date: "March 21, 2026", read: "3 min read", cover: ["https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1400&q=85", "Official documents and seal"] },
    { slug: "mobile-notary-guide", title: "Mobile notarization: what to expect", cat: "Mobile Notary", date: "March 4, 2026", read: "3 min read", cover: ["https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1400&q=85", "Clients meeting at a table"] },
    { slug: "corporate-document-signings", title: "Corporate document signings made simple", cat: "Business Notary", date: "February 15, 2026", read: "3 min read", cover: ["https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1400&q=85", "Business team reviewing a document"] }
  ];

  /* One short, relevant FAQ trio per service category, appended to the end
     of every blog article that belongs to that category. Answers stay
     consistent with the sitewide FAQ page - eg. never implying a notary can
     draft documents or give legal advice. */
  var FAQS_BY_CATEGORY = {
    "General Notary": [
      { q: "What do I need to bring to my appointment?", a: "A valid, unexpired government-issued photo ID and the complete document, unsigned. Washington notaries must witness the signature, so please do not sign ahead of time." },
      { q: "Can you tell me how to fill out my document?", a: "No. A notary public verifies identity and witnesses signatures, but cannot draft documents, choose which form you need, or explain a document's legal effect. For that, please speak with an attorney." },
      { q: "Do all signers need to be present?", a: "Yes. Everyone signing the document must appear in person, or on a live remote online session, with valid ID at the time of notarization." }
    ],
    "Loan Signings": [
      { q: "Can you handle loan signings for my company?", a: "Yes. We work with lenders, title and escrow companies, signing services, and real estate professionals on purchase, refinance, HELOC, and reverse mortgage packages." },
      { q: "How long does a loan signing take?", a: "Most closings take 45 to 75 minutes, depending on the size of the package and the number of signers." },
      { q: "What happens if a document needs a correction at the table?", a: "We flag it immediately and coordinate with your title or escrow contact before proceeding, since a notary cannot alter loan documents." }
    ],
    "Estate Planning": [
      { q: "Can a notary help me write my will?", a: "No. Notaries cannot draft documents or give legal advice. We notarize the signatures once your documents are already prepared." },
      { q: "Do witnesses need to be present too?", a: "Some estate documents require witnesses in addition to notarization. Check your document's instructions, or ask an attorney beforehand, so we can plan the appointment correctly." },
      { q: "Can you notarize a power of attorney?", a: "Yes. Powers of attorney are one of the most common estate planning documents we notarize." }
    ],
    "Document Authentication": [
      { q: "What is the difference between a certified copy and an authentication?", a: "A certified copy verifies that a document is a true copy of the original. An authentication certifies a document for use in another state or country. Confirm with the receiving organization which one it actually needs." },
      { q: "Can you certify a copy of any document?", a: "Some documents, such as vital records, must be certified by their issuing agency rather than a notary. Ask the receiving organization first." },
      { q: "How do I know what a receiving country or state requires?", a: "Contact the receiving organization or the relevant consulate directly. Requirements vary and a notary cannot provide legal guidance on this." }
    ],
    "Mobile Notary": [
      { q: "Do you come to me, or do I come to you?", a: "Either works. We offer mobile appointments at your home, office, or hospital, in addition to sessions where you come to us." },
      { q: "Is there an extra fee for mobile appointments?", a: "Yes. Travel fees apply based on distance and are quoted and confirmed before the appointment." },
      { q: "Can you notarize in a hospital or care facility?", a: "Yes. We regularly visit hospitals and care facilities. Call ahead so we can confirm visiting hours and access." }
    ],
    "Business Notary": [
      { q: "What business documents can you notarize?", a: "Contracts, resolutions, LLC formation documents, corporate minutes, and other business paperwork." },
      { q: "Can you come to our office for multiple signers?", a: "Yes. We can schedule a single visit for multiple employees or officers signing the same or different documents." },
      { q: "Do you offer recurring service for our company?", a: "Yes. Many businesses set up standing appointments for regular signing needs - contact us to arrange it." }
    ]
  };

  var ICON = {
    user: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    cal: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    folder: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    phone: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .3 1.9.6 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.8.6a2 2 0 0 1 1.7 2z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>',
    tag: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.6 13.6 12 22l-9-9V3h10z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>',
    fb: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.25-1.5 1.55-1.5H16.7V4.6c-.3 0-1.3-.13-2.45-.13-2.42 0-4.08 1.48-4.08 4.2v2.23H7.45V14h2.72v8z"/></svg>',
    tw: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M17.6 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.1 21H2l7.3-8.3L2 3h6.4l4.4 5.9zm-1.1 16.1h1.7L7.6 4.8H5.8z"/></svg>',
    li: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5M3 9h4v12H3zM9 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.78 2.5 4.78 5.76V21h-4v-5.6c0-1.34-.03-3.06-1.9-3.06-1.9 0-2.2 1.45-2.2 2.96V21H9z"/></svg>',
    link: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>'
  };

  var article = document.querySelector(".article-body");
  if (article) {
    var pathParts = window.location.pathname.split("/").filter(Boolean);
    var articleName = pathParts[pathParts.length - 1] === "index.html" ? pathParts[pathParts.length - 2] : pathParts[pathParts.length - 1];
    var post = null;
    for (var pi = 0; pi < POSTS.length; pi++) if (POSTS[pi].slug === articleName) post = POSTS[pi];

    // Posts exported from /blog/create/ are not in the hardcoded POSTS list
    // above (that list only tracks the hand-written launch articles). The
    // editor stamps its own metadata onto the article as data- attributes so
    // this same code path - hero meta icons, cover figure, tags/share footer -
    // works immediately for a freshly downloaded post, with no JS edit needed.
    if (!post && article.dataset.postTitle) {
      post = {
        slug: articleName,
        title: article.dataset.postTitle,
        cat: article.dataset.postCategory || "Blog",
        date: article.dataset.postDate || "",
        read: article.dataset.postRead || "",
        cover: article.dataset.postCover ? [article.dataset.postCover, article.dataset.postCoverAlt || ("Featured image for " + article.dataset.postTitle)] : null
      };
    }

    var headings = article.querySelectorAll("h2");
    var layout = document.createElement("div");
    var content = document.createElement("div");
    var aside = document.createElement("aside");
    layout.className = "article-layout";
    content.className = "article-content";
    aside.className = "article-aside";
    aside.setAttribute("aria-label", "Article sidebar");

    /* --- hero meta row: author, date, category, read time --- */
    var heroMeta = document.querySelector(".hero .article-meta");
    if (heroMeta && post) {
      heroMeta.innerHTML =
        '<span class="meta-bit">' + ICON.cal + post.date + '</span>' +
        '<span class="meta-bit">' + ICON.folder + post.cat + '</span>' +
        '<span class="meta-bit">' + ICON.clock + post.read + '</span>';
      heroMeta.classList.add("article-meta--icons");
    }

    /* --- move the body into the content column --- */
    while (article.firstChild) content.appendChild(article.firstChild);

    /* --- cover image above the copy --- */
    if (post && post.cover) {
      var cover = document.createElement("figure");
      cover.className = "article-cover";
      cover.innerHTML = '<img src="' + post.cover[0] + '" alt="' + post.cover[1] + '" fetchpriority="high">';
      content.insertBefore(cover, content.firstChild);
    }

    /* --- author byline: photo, name, role --- */
    if (post) {
      var byline = document.createElement("div");
      byline.className = "article-byline";
      byline.innerHTML =
        '<img src="/assets/logo-mark.png" alt="Maktub Mobile Notary logo">' +
        '<span>' +
          '<span class="byline-label">Written by</span>' +
          '<strong>Maktub Mobile Notary</strong>' +
          '<span class="byline-role">Owner &amp; Notary Public</span>' +
        '</span>';
      content.insertBefore(byline, content.firstChild);
    }

    /* --- tags + share footer --- */
    if (post) {
      var shareUrl = SITE_ORIGIN + "/blog/" + post.slug + "/";
      var shareText = post.title;
      var foot = document.createElement("div");
      foot.className = "article-foot";
      foot.innerHTML =
        '<div class="article-tags"><span class="foot-label">' + ICON.tag + 'Tags</span>' +
          '<a href="/blog/?topic=' + encodeURIComponent(post.cat) + '">' + post.cat + '</a></div>' +
        '<div class="article-share"><span class="foot-label">Share this</span>' +
          '<a class="share-dot" target="_blank" rel="noopener" aria-label="Share on Facebook" href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(shareUrl) + '">' + ICON.fb + '</a>' +
          '<a class="share-dot" target="_blank" rel="noopener" aria-label="Share on X" href="https://twitter.com/intent/tweet?url=' + encodeURIComponent(shareUrl) + '&text=' + encodeURIComponent(shareText) + '">' + ICON.tw + '</a>' +
          '<a class="share-dot" target="_blank" rel="noopener" aria-label="Share on LinkedIn" href="https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(shareUrl) + '">' + ICON.li + '</a>' +
          '<button type="button" class="share-dot" data-copy-link="' + shareUrl + '" aria-label="Copy link to this article">' + ICON.link + '</button>' +
        '</div>';
      content.appendChild(foot);

      var copyBtn = foot.querySelector("[data-copy-link]");
      if (copyBtn) {
        copyBtn.addEventListener("click", function () {
          var url = this.getAttribute("data-copy-link");
          var btn = this;
          var done = function () {
            btn.classList.add("is-copied");
            window.setTimeout(function () { btn.classList.remove("is-copied"); }, 1600);
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(done, function () {});
          } else {
            var t = document.createElement("textarea");
            t.value = url; document.body.appendChild(t); t.select();
            try { document.execCommand("copy"); done(); } catch (e) {}
            document.body.removeChild(t);
          }
        });
      }
    }

    /* --- sidebar widget 1: on this page --- */
    var tocLinks = [];
    if (headings.length > 1) {
      var toc = document.createElement("section");
      toc.className = "side-card article-toc";
      toc.innerHTML = '<h2 class="side-title">On this page</h2>';
      var tocList = document.createElement("ul");
      tocList.className = "toc-nav";
      Array.prototype.forEach.call(headings, function (heading, index) {
        var id = heading.id || "article-section-" + (index + 1);
        heading.id = id;
        var item = document.createElement("li");
        var link = document.createElement("a");
        link.href = "#" + id;
        link.textContent = heading.textContent;
        item.appendChild(link);
        tocList.appendChild(item);
        tocLinks.push(link);
      });
      toc.appendChild(tocList);
      aside.appendChild(toc);
    }

    /* --- sidebar widget 2: recent posts --- */
    var recent = POSTS.filter(function (p) { return p.slug !== articleName; }).slice(0, 3);
    if (recent.length) {
      var rc = document.createElement("section");
      rc.className = "side-card";
      var rows = recent.map(function (p) {
        return '<li><a href="/blog/' + p.slug + '/">' + p.title + '</a>' +
               '<span class="side-date">' + ICON.clock + p.date + '</span></li>';
      }).join("");
      rc.innerHTML = '<h2 class="side-title">Recent posts</h2><ul class="side-recent">' + rows + '</ul>';
      aside.appendChild(rc);
    }

    /* --- sidebar widget 3: have a question --- */
    var qc = document.createElement("section");
    qc.className = "side-card side-card--dark";
    qc.innerHTML =
      '<h2 class="side-title">Have any question?</h2>' +
      '<p>Tell us the document type, number of signers, and where you would like to meet. We will confirm the right service and a clear estimate.</p>' +
      '<ul class="side-reach">' +
        '<li><span class="reach-ico">' + ICON.phone + '</span><a href="tel:' + CONTACT.telHref + '">' + CONTACT.phone + '</a></li>' +
        '<li><span class="reach-ico">' + ICON.mail + '</span><a href="mailto:' + CONTACT.email + '">' + CONTACT.email + '</a></li>' +
      '</ul>' +
      '<a class="btn btn-gold btn-block" href="/contact/">Book a notary</a>';
    aside.appendChild(qc);

    /* --- sidebar widget 4: categories --- */
    var cats = [];
    POSTS.forEach(function (p) { if (cats.indexOf(p.cat) === -1) cats.push(p.cat); });
    var cc = document.createElement("section");
    cc.className = "side-card";
    cc.innerHTML = '<h2 class="side-title">Categories</h2><ul class="side-cats">' +
      cats.map(function (c) {
        return '<li><a href="/blog/?topic=' + encodeURIComponent(c) + '"' +
               (post && post.cat === c ? ' class="is-current"' : '') + '>' +
               ICON.chevron + '<span>' + c + '</span></a></li>';
      }).join("") + '</ul>';
    aside.appendChild(cc);

    layout.appendChild(content);
    layout.appendChild(aside);
    article.appendChild(layout);

    /* --- FAQ section: three questions relevant to this post's category --- */
    var faqSet = post && FAQS_BY_CATEGORY[post.cat];
    if (faqSet && faqSet.length) {
      var faqWrap = document.createElement("section");
      faqWrap.className = "section section-warm";
      var faqItemsHtml = faqSet.map(function (item) {
        return '<div class="faq-item">' +
          '<button class="faq-q" aria-expanded="false">' +
            '<span>' + item.q + '</span>' +
            '<span class="faq-ico" aria-hidden="true"></span>' +
          '</button>' +
          '<div class="faq-a"><p>' + item.a + '</p></div>' +
        '</div>';
      }).join("");
      faqWrap.innerHTML =
        '<div class="wrap wrap-narrow">' +
          '<div class="center section-head">' +
            '<p class="eyebrow">Questions</p>' +
            '<h2 class="h-lg">Frequently asked about ' + post.cat.toLowerCase() + '</h2>' +
          '</div>' +
          '<div class="faq">' + faqItemsHtml + '</div>' +
          '<div class="center" style="margin-top:28px;"><a class="link-arrow" href="/faq/">Read all FAQs &rarr;</a></div>' +
        '</div>';
      var articleWrapSection = article.closest("section") || article.parentNode;
      articleWrapSection.parentNode.insertBefore(faqWrap, articleWrapSection.nextSibling);
      bindFaqAccordion(faqWrap.querySelectorAll(".faq-q"));
    }

    /* --- highlight the section the reader is currently in --- */
    if (tocLinks.length > 1) {
      var currentLink = null;
      var setCurrent = function (link) {
        if (link === currentLink) return;
        if (currentLink) {
          currentLink.classList.remove("is-current");
          currentLink.removeAttribute("aria-current");
        }
        currentLink = link;
        if (currentLink) {
          currentLink.classList.add("is-current");
          currentLink.setAttribute("aria-current", "true");
        }
      };
      var syncToc = function () {
        var line = window.innerHeight * 0.28;
        var active = 0;
        for (var i = 0; i < headings.length; i++) {
          if (headings[i].getBoundingClientRect().top <= line) active = i;
        }
        if (window.innerHeight + window.pageYOffset >= document.body.scrollHeight - 4) active = headings.length - 1;
        setCurrent(tocLinks[active]);
      };
      var tocTicking = false;
      var onTocScroll = function () {
        if (tocTicking) return;
        tocTicking = true;
        window.requestAnimationFrame(function () { syncToc(); tocTicking = false; });
      };
      window.addEventListener("scroll", onTocScroll, { passive: true });
      window.addEventListener("resize", onTocScroll);
      syncToc();
    }
  }

  /* ---------- Brand motion: signature ink + locator pulse ----------
     Injected rather than written into every page's markup: it is decoration,
     so it belongs to the script that decorates, and it keeps the 12 pages
     carrying a booking card from each needing the same inline SVG. The dash
     animation needs a real SVG element - a data-URI background cannot be
     dash-animated reliably across browsers - hence the node here.
     Skipped entirely when the visitor asked for reduced motion. */
  if (!reduceMotion) {
    var SIG_NS = "http://www.w3.org/2000/svg";
    Array.prototype.forEach.call(document.querySelectorAll(".closing-card"), function (card) {
      if (card.querySelector(".sig-ink")) return;
      var svg = document.createElementNS(SIG_NS, "svg");
      svg.setAttribute("class", "sig-ink");
      svg.setAttribute("viewBox", "0 0 420 120");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");
      // a loose signature flourish, then a lighter underline stroke
      [
        "M12 86c22-34 38-52 49-54 8-2 11 5 8 18-4 17-16 44-16 44s16-52 30-66c7-7 13-5 14 4 1 12-8 34-8 34s14-30 26-36c8-4 13 1 12 10-1 11-9 26-9 26s16-24 28-26c9-2 12 5 9 14-3 8-9 16-9 16s18-14 30-12c14 2 18 12 40 12 24 0 44-12 62-30",
        "M120 104c60 8 150 8 232-6"
      ].forEach(function (d) {
        var p = document.createElementNS(SIG_NS, "path");
        p.setAttribute("d", d);
        svg.appendChild(p);
      });
      card.insertBefore(svg, card.firstChild);
      // in the document now, so getTotalLength() is meaningful
      Array.prototype.forEach.call(svg.querySelectorAll("path"), function (path) {
        path.style.setProperty("--len", path.getTotalLength());
      });
    });

    // into the right-hand visual panel when there is one: that panel is the
    // map area, and floating the pulse over the section put it on top of the
    // city chips and the fine print.
    var areaHost = document.querySelector(".section-area .area-visual") ||
                   document.querySelector(".section-area");
    if (areaHost && !areaHost.querySelector(".area-pulse")) {
      var pulse = document.createElement("div");
      pulse.className = "area-pulse";
      pulse.setAttribute("aria-hidden", "true");
      pulse.innerHTML = "<span></span><span></span><span></span>";
      areaHost.appendChild(pulse);
    }
  }

  /* ---------- Unified long-form footer ---------- */
  var siteFooter = document.querySelector(".site-footer");
  if (siteFooter && !siteFooter.querySelector(".footer-inner")) {
    siteFooter.innerHTML =
      '<div class="wrap footer-inner">' +
        '<div><div class="footer-brand-mark"><img src="/assets/logo-mark.png" alt="Maktub Mobile Notary logo"></div><p class="footer-name">Maktub Mobile Notary</p><p class="footer-tag">Mobile notary and loan signings for Tacoma and the South Puget Sound.</p><ul class="footer-reach"><li><a href="tel:' + CONTACT.telHref + '">' + CONTACT.phone + '</a></li><li><a href="mailto:' + CONTACT.email + '">' + CONTACT.email + '</a></li></ul></div>' +
        '<div class="footer-col"><h3>Services</h3><ul><li><a href="/general-notary/">General Notary</a></li><li><a href="/loan-signings/">Loan Signings</a></li><li><a href="/estate-planning/">Estate Planning</a></li><li><a href="/remote-online-notarization/">Online Notarization</a></li><li><a href="/business-notary/">Business Notary</a></li></ul></div>' +
        '<div class="footer-col"><h3>Explore</h3><ul><li><a href="/pricing/">Pricing</a></li><li><a href="/about/">About</a></li><li><a href="/blog/">Blog</a></li><li><a href="/faq/">FAQ</a></li><li><a href="/contact/">Contact</a></li></ul></div>' +
        '<div class="footer-col"><h3>Service area</h3><ul><li>Tacoma</li><li>Lakewood &amp; University Place</li><li>Puyallup &amp; Fife</li><li>Gig Harbor</li><li>Federal Way</li></ul></div>' +
      '</div>' +
      '<div class="wrap footer-bottom"><p>&copy; <span id="year"></span> Maktub Mobile Notary. All rights reserved.</p><div class="footer-legal"><a href="/privacy/">Privacy Policy</a><a href="/terms/">Terms of Service</a></div></div>';
  }
  if (siteFooter) {
    var existingFooterIntro = siteFooter.querySelector(".footer-intro");
    if (existingFooterIntro) existingFooterIntro.remove();
    var brandBlock = siteFooter.querySelector(".footer-inner > div:first-child");
    if (brandBlock && !brandBlock.querySelector(".footer-social")) {
      var social = document.createElement("span");
      social.className = "footer-social";
      social.textContent = "Tacoma, Washington";
      brandBlock.appendChild(social);
    }
    var footerInner = siteFooter.querySelector(".footer-inner");
    var existingFooterContact = footerInner && footerInner.querySelector(".footer-contact");
    if (existingFooterContact) existingFooterContact.remove();
    var footerYear = siteFooter.querySelector("#year");
    if (footerYear) footerYear.textContent = new Date().getFullYear();
  }

  /* ---------- Subtle cursor drift ---------- */
  if (!reduceMotion && window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    Array.prototype.forEach.call(
      document.querySelectorAll(".hero.aurora, .visual-frame, .site-footer"),
      function (surface) {
        var frame = null;
        var latestEvent = null;
        var strength = surface.classList.contains("site-footer") ? 8 : surface.classList.contains("visual-frame") ? 12 : 18;

        function applyDrift() {
          frame = null;
          if (!latestEvent) return;
          var rect = surface.getBoundingClientRect();
          var x = (latestEvent.clientX - rect.left) / rect.width - 0.5;
          var y = (latestEvent.clientY - rect.top) / rect.height - 0.5;
          surface.style.setProperty("--cursor-drift-x", (x * strength).toFixed(2) + "px");
          surface.style.setProperty("--cursor-drift-y", (y * strength).toFixed(2) + "px");
          surface.style.setProperty("--cursor-tilt-x", (x * 3.2).toFixed(2) + "deg");
          surface.style.setProperty("--cursor-tilt-y", (y * -3.2).toFixed(2) + "deg");
        }

        surface.addEventListener("pointermove", function (event) {
          latestEvent = event;
          if (!frame) frame = window.requestAnimationFrame(applyDrift);
        });
        surface.addEventListener("pointerleave", function () {
          latestEvent = null;
          if (frame) window.cancelAnimationFrame(frame);
          frame = null;
          surface.style.setProperty("--cursor-drift-x", "0px");
          surface.style.setProperty("--cursor-drift-y", "0px");
          surface.style.setProperty("--cursor-tilt-x", "0deg");
          surface.style.setProperty("--cursor-tilt-y", "0deg");
        });
      }
    );
  }
})();

/* ---------------------------------------------------------------------------
   Blog topic filter
   Filters the article grid in place. Category values come from each card's
   data-category attribute, which mirrors the tag printed on the card itself.
   --------------------------------------------------------------------------- */
(function () {
  var pills = document.querySelectorAll(".topic-link");
  var grid = document.querySelector(".blog-grid");
  if (!pills.length || !grid) return;

  var cards = grid.querySelectorAll(".post-card");
  var count = document.querySelector("[data-blog-count]");

  var empty = document.createElement("p");
  empty.className = "blog-empty";
  empty.hidden = true;
  empty.textContent = "No articles in this topic yet.";
  grid.appendChild(empty);

  function apply(filter) {
    var shown = 0;
    var showcase = filter === "all";

    for (var i = 0; i < cards.length; i++) {
      var match = showcase || cards[i].getAttribute("data-category") === filter;
      cards[i].hidden = !match;
      if (match) shown++;

      // The lead article is only "featured" in the unfiltered view - inside a
      // topic it would sit alone as an oversized banner.
      if (cards[i].classList.contains("post-card--featured")) {
        cards[i].classList.toggle("is-featured", showcase);
      }
    }

    empty.hidden = shown !== 0;

    if (count) {
      count.textContent = filter === "all"
        ? "Showing all " + shown + " article" + (shown === 1 ? "" : "s")
        : "Showing " + shown + " article" + (shown === 1 ? "" : "s") + " in " + filter;
    }
  }

  function select(filter) {
    var matched = false;
    for (var j = 0; j < pills.length; j++) {
      var on = pills[j].getAttribute("data-filter") === filter;
      if (on) matched = true;
      pills[j].classList.toggle("is-active", on);
      pills[j].setAttribute("aria-pressed", on ? "true" : "false");
    }
    apply(matched ? filter : "all");
  }

  for (var i = 0; i < pills.length; i++) {
    pills[i].addEventListener("click", function () {
      select(this.getAttribute("data-filter"));
    });
  }

  // Sidebar "Categories" and article tags deep-link in as /blog/?topic=Name
  var topic = (window.location.search.match(/[?&]topic=([^&]*)/) || [])[1];
  if (topic) select(decodeURIComponent(topic.replace(/\+/g, " ")));
})();

/* ---------------------------------------------------------------------------
   Contact page: "Get support" shortcuts
   Each help-topic card jumps to the booking form and preselects the matching
   service, so the visitor does not have to re-state what they already picked.
   --------------------------------------------------------------------------- */
(function () {
  var links = document.querySelectorAll(".help-link[data-service]");
  var select = document.getElementById("service");
  if (!links.length || !select) return;

  for (var i = 0; i < links.length; i++) {
    links[i].addEventListener("click", function () {
      var value = this.getAttribute("data-service");
      for (var j = 0; j < select.options.length; j++) {
        if (select.options[j].value === value) {
          select.selectedIndex = j;
          break;
        }
      }
      window.setTimeout(function () {
        var name = document.getElementById("name");
        if (name) name.focus({ preventScroll: true });
      }, 420);
    });
  }
})();

/* ---------------------------------------------------------------------------
   Newsletter sign-up
   No mailing-list backend is wired up yet, so the form opens a pre-addressed
   message to the office instead of silently discarding the address. Point
   NEWSLETTER_ENDPOINT at a real handler and it will POST there instead.
   --------------------------------------------------------------------------- */
(function () {
  var form = document.querySelector("[data-newsletter]");
  if (!form) return;
  var note = form.querySelector("[data-news-note]");
  var input = form.querySelector("input[type=email]");

  function say(msg) { if (note) note.textContent = msg; }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = (input.value || "").trim();
    if (!email || email.indexOf("@") < 1 || email.indexOf(".", email.indexOf("@")) < 0) {
      say("Please enter a valid email address.");
      input.focus();
      return;
    }
    if (typeof NEWSLETTER_ENDPOINT === "string" && NEWSLETTER_ENDPOINT) {
      var body = new FormData();
      body.append("email", email);
      say("Subscribing\u2026");
      window.fetch(NEWSLETTER_ENDPOINT, { method: "POST", body: body })
        .then(function (r) {
          if (!r.ok) throw new Error("bad status");
          form.reset();
          say("Thank you, you are on the list.");
        })
        .catch(function () { say("Something went wrong. Please email us instead."); });
      return;
    }
    window.location.href = "mailto:" + CONTACT.email +
      "?subject=" + encodeURIComponent("Newsletter sign-up") +
      "&body=" + encodeURIComponent("Please add this address to the Maktub notary updates list: " + email);
    say("Opening your email app to confirm the request.");
  });
})();

/* ---------------------------------------------------------------------------
   Service page: "ways to work with us" tabs
   --------------------------------------------------------------------------- */
(function () {
  var tabs = document.querySelectorAll("[data-way-tab]");
  if (!tabs.length) return;
  var panels = document.querySelectorAll("[data-way-panel]");

  function show(index) {
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute("data-way-tab") === index;
      tabs[i].classList.toggle("is-active", on);
      tabs[i].setAttribute("aria-selected", on ? "true" : "false");
    }
    for (var j = 0; j < panels.length; j++) {
      panels[j].hidden = panels[j].getAttribute("data-way-panel") !== index;
    }
  }

  for (var k = 0; k < tabs.length; k++) {
    tabs[k].addEventListener("click", function () {
      show(this.getAttribute("data-way-tab"));
    });
  }
})();

