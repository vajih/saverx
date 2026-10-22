# Individual guide UI

Extends the Relief design to all five /learn/ articles and the three medication comparison guides linked from /comparisons.html. Uses ivory, cobalt, soft paper objects, editorial headings, numbered sections, and a restrained reading column.

- Desktop: sticky contents with active-section indication, reading progress, related-reading cards.
- Mobile: native expandable contents, automatic close on section selection, keyboard-accessible scrolling comparison tables. Decorative artwork is hidden to put reading first.
- Five learning article bodies remain byte-for-byte identical. Comparison text and destinations are preserved; only wrappers, attributes and layout change. Existing dates, prices and medical claims are not revalidated or refreshed in this UI task.
- All existing form and script blocks remain unchanged. No form submissions sent during QA.
- No new framework, dependency, network request or build service.

## Maintain

scripts/build-article-pages.py is an idempotent migration that applies the UI to a guide without reader-page. Existing transformed pages can be edited directly; the shared presentation lives in assets/css/article-pages.css. scripts/build-support-pages.py calls the article migration, and the general Relief migration delegates to it. If the independent brand-assets update is installed, run its build-brand-assets.py last to retain sharing metadata.

## Validation

```sh
python3 scripts/check-article-pages.py
node --check assets/js/article-pages.js
node --test test/support-pages.test.mjs
node scripts/check-relief-redesign.mjs
git diff --check
```

The article checker compares against merged base d04838ed and verifies article content, destinations, form and script preservation, unique IDs, a single main/H1 and complete fragment targets. Keep that baseline commit available in the repository. The migration and supporting generator were rerun without adding duplicate UI. Desktop and 375px mobile preview checks covered a learning guide and comparison, section navigation, active contents and table scrolling. Existing site-wide checks also passed.

Follow DEV_WORKFLOW.md for human review and production release.
