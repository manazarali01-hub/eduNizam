# EduNizam image and icon rights register
Last audited: 2026-10-08

## What is allowed to be served
No iStock sample, watermarked stock graphic, copied commercial icons or unverified local hero photos should be deployed. The original watermarked iStock house supplied for **style reference only** is never included.

### Source 1 — V1 3dicons soft clay images
- Creator: Vijay Verma; project: https://3dicons.co/
- Original V1 licensing: Creative Commons Zero (CC0 1.0), https://3dicons.co/about
- Build generator: `scripts/build-clay-icons.py`.
- Hosted production assets: `assets/icons/clay-*.webp`, 48 optimized renders generated in CI.
- Many source files come from Wikimedia Commons and retain CC0; e.g. https://commons.wikimedia.org/wiki/File:Setting-dynamic-color.png .
- The School/House icon is a newly drawn procedural vector/raster composition inside the build script, **not** the supplied iStock artwork. Generated mockup screenshots in ChatGPT are not deployed assets.
- Avoid swapping in a 3dicons release with a different license without a new audit.
- Public build license note: `assets/icons/LICENSE.txt`.

### Source 2 — Explicitly screened Pexels photos, with no recognizable people
- General license: https://www.pexels.com/license/
- License allows use on a website, including commercial use, but does not grant other parties' trademarks, likeness/publicity rights, or imply endorsements.
- All identifiers below are checked by `scripts/check-asset-licenses.mjs`; every additional photo must get a documented source and be added to that allowlist.

| Photo ID | Subject / original source |
| --- | --- |
| 36159720 | Empty classroom, desks and board — https://www.pexels.com/photo/empty-classroom-with-blackboard-and-desks-36159720/ |
| 5833 | Open book on green grass (CC0 listing) — https://www.pexels.com/photo/book-on-the-grass-5833/ |
| 5088012 | Back-to-school stationery flat lay — https://www.pexels.com/photo/back-to-school-flatlay-5088012/ |
| 28503364 | Neatly arranged school supplies — https://www.pexels.com/photo/neatly-arranged-school-supplies-on-desk-28503364/ |
| 30744638 | Green leaves, sunlit forest — https://www.pexels.com/photo/vibrant-green-leaves-with-sunlight-in-forest-30744638/ |
| 36728536 | Close-up of green leaves with sunlight — https://www.pexels.com/photo/close-up-of-vibrant-green-leaves-in-sunlight-36728536/ |
| 5607884 | Green leaves in sunlight — https://www.pexels.com/photo/green-leaves-in-sunlight-5607884/ |
| 35821614 | Green leaves in natural sunlight — https://www.pexels.com/photo/vibrant-green-leaves-in-natural-sunlight-35821614/ |
| 33252555 | Sunlit forest canopy — https://www.pexels.com/photo/sunlit-green-leaves-in-a-forest-canopy-33252555/ |

### Source 3 — EduNizam first-party project branding and simple SVG illustrations
- `assets/edunizam-premium-mark.svg`, `assets/themes/*.svg`, `icon-*.svg` are authored/maintained within this project.
- The previously approved raster brand variants `assets/edunizam-logo.webp` and `assets/edunizam-logo-approved.webp` are first-party **branding only**. Their original author/assignment documentation is **not independently verified**; do not redistribute them as stock media or grant other parties license to use them. Obtain an authorship/assignment record if they were created by a third-party designer.
- Student/staff photographs uploaded privately by schools are not covered by the above stock licenses: obtaining parental/guardian permissions and honoring privacy obligations is the school's responsibility.

## Items withdrawn from website use
- `assets/edunizam-login-children.webp` and `assets/edunizam-girl-hero.webp`: provenance not verified; remove from release and don't reuse.
- Pexels pictures depicting identifiable pupils/people (IDs 8926544, 8419199, 37831090) were replaced to avoid implying they are EduNizam's own students or endorsers.
- Existing unreviewed remote background photos from other sites were replaced with the documented Pexels sources.
- iStock reference photo is not included in repository or deployment.

## Changes and new media policy
1. Before a new image is published, record its creator, direct source URL, license/release version, intended use and whether any identifiable people/logos are present.
2. Do not use AI-generated imagery, scraped Google Image Search results, watermarked stock or unknown source art in the public site.
3. Do not imply that models, schools or people pictured endorse EduNizam.
4. New photos must be reviewed for third-party rights, not just copyright.
5. This is a due-diligence record, not a legal warranty or guarantee against future copyright claims.
