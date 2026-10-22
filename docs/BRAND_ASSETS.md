# Browser and sharing identity

The supplied cobalt Relief spark exports in `assets/img/` provide browser icons, home-screen icons, and the social preview image. Public pages and full-page templates use root-relative, versioned icon URLs and absolute social-image URLs. Page titles, descriptions, canonical URLs, and structured data remain page-specific.

Run `python3 scripts/build-brand-assets.py` after generating pages. The Relief, article, and drug-options generators call it automatically; supporting-page generation delegates to the article generator. The script installs metadata and copies compatibility exports using supplied artwork, with no image-rendering dependencies or network access. To replace artwork, update `favicon.svg`, `favicon.png`, `apple-touch-icon.png`, `favicon.ico`, the 192px/512px exports, and `share-relief.png` in `assets/img/`, then update `VERSION` in the script and rerun it.

The PNG favicon is 32px, Apple icon 180px, manifest icons 192px/512px, and sharing image 1200×630. Existing browser or messaging previews can retain cached images; versioned URLs help new requests receive the updated artwork.
