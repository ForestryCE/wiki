# Forestry: CE Wiki

The community wiki for [Forestry: Community Edition](https://github.com/ForestryCE), built with
[Jekyll](https://jekyllrb.com/) and served from `docs/` via GitHub Pages.

## Local development

Prerequisites: Ruby + Bundler (Jekyll 4.4) and Node 22+.

```bash
# from the repository root:
cd docs
bundle install            # first time only
bundle exec jekyll serve --livereload
```

Then open **http://localhost:4000/wiki/** (the site lives under `/wiki/` because `baseurl` is `/wiki`).
`--livereload` refreshes the page automatically as you edit.

To produce a one-off static build instead of serving:

```bash
cd docs && bundle exec jekyll build   # output in docs/_site/
```

## Bee species pages

Bee pages join **machine-generated game data** with **human-written content**, so regenerating the
data never overwrites anyone's writing:

- `docs/_data/bees.json` — game data, **regenerated** from the mod (do not hand-edit).
- `docs/_bees/<id>.md` — human content (lore, tips, images) for one species; **never overwritten**.
- `docs/_layouts/bee.html` + `docs/_includes/` — join the two at build time.
- `docs/_data/items.yml`, `docs/_data/hives.yml` — hand-maintained icon/link/label maps.

### Regenerating from the mod

In a live (optionally modded) game, run the mod command, then sync the dump into the wiki:

```bash
# 1. in-game (singleplayer, so display names resolve): /forestry dump wiki_bees
#    writes config/forestry/wiki/bees.json
# 2. from the repo root:
npm run sync-bees -- /path/to/bees.json
```

This rewrites `docs/_data/bees.json`, creates `_bees/<id>.md` stubs for any **new** species
(including addon-mod bees), and prints a report of new species and unmapped item icons. Existing
human content is left untouched.

Run the tooling tests with `npm test` (`node --test`).

## Deployment

Pushing to `main` triggers `.github/workflows/jekyll.yml`, which builds `docs/` and deploys to GitHub
Pages. (Repo Settings → Pages → Source must be set to "GitHub Actions".)
