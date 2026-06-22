# Plan B — Jekyll Foundation + Pages Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Turn the hand-coded `docs/` site into a Jekyll site built and deployed via GitHub Actions, with **every existing page rendering byte-for-byte identically** (static passthrough) and `baseurl` corrected to `/wiki`.

**Architecture:** Jekyll source stays in `docs/`. Existing pages have no front matter, so Jekyll copies them verbatim — nothing changes visually. A GitHub Actions workflow replaces the legacy "serve from `docs/` branch" Pages build (required for Jekyll 4.x). This is the **foundation only**: no bee collection, layout, includes, or sync — those are Plan C.

**Tech Stack:** Jekyll 4.4 (Ruby 3.4 / Bundler present locally), GitHub Actions (`ruby/setup-ruby`, `actions/upload-pages-artifact`, `actions/deploy-pages`).

**Repo:** `/home/thedarkcolour/WebstormProjects/forestry-wiki`, served at `https://forestryce.github.io/wiki/` (project page → `baseurl: /wiki`). Work happens on branch `bee-wiki-pipeline`.

---

## Context the executor needs

- **Toolchain present** (verified): Ruby 3.4.8, Jekyll 4.4.1, Node 22, npm. (Bundler reports an unusual `4.0.7`; if `bundle` misbehaves, fall back to the global `jekyll` per Task 1.)
- **Current `docs/`** (all static, no front matter): `index.html`, `404.html`, `article.js`, `article_style.css`, `Minecraft.otf`, `cdn/`, `Forest+Bee/`, `crafting/`, `discord/`, `getrichsimulator/`, `mainpage/`, and an untracked `_site/`.
- **Starting point on `try-use-jekyll`** (reuse, with the baseurl fix): `docs/_config.yml`, `docs/Gemfile`, `docs/_layouts/article.html`. The `bee.html` layout there is the OLD front-matter approach — **do NOT bring it** (Plan C builds a `_data`-driven one).
- **Why passthrough is safe:** Jekyll only Liquid-processes files that have YAML front matter; the existing pages have none, so they are copied verbatim regardless of `{{ }}`/`${ }` in their JS. (Task 2 verifies this with a byte diff.)
- **Pages source switch is manual:** the repo currently serves Pages from the `docs/` folder; switching to the Actions build is a one-time change in the GitHub repo Settings → Pages UI (Task 4). It cannot be done from code.
- **Default branch is `main`;** the deploy workflow triggers on push to `main`, so it activates once this branch merges. `workflow_dispatch` allows manual runs.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `docs/_config.yml` | create | Jekyll config; `baseurl: /wiki` |
| `docs/Gemfile` | create | pins Jekyll 4.4 for reproducible CI builds |
| `docs/Gemfile.lock` | create (generated) | locked deps |
| `docs/_layouts/article.html` | create | base article layout (groundwork for Plan C + later page migration; unused by existing passthrough pages) |
| `.gitignore` | create/update | ignore build artifacts (`docs/_site/`, caches, `vendor/`) |
| `.github/workflows/jekyll.yml` | create | build from `docs/` + deploy to Pages |

---

## Task 0: Confirm branch and toolchain

- [ ] **Step 1: Confirm on the working branch**

Run: `git -C /home/thedarkcolour/WebstormProjects/forestry-wiki branch --show-current`
Expected: `bee-wiki-pipeline`. (If not, `git checkout bee-wiki-pipeline`.)

- [ ] **Step 2: Confirm Jekyll is runnable**

Run: `jekyll --version`
Expected: `jekyll 4.4.x`. (Global Jekyll is the fallback build path if Bundler is broken.)

---

## Task 1: Jekyll config, Gemfile, gitignore, first build

**Files:** `docs/_config.yml`, `docs/Gemfile`, `.gitignore` (all create)

- [ ] **Step 1: Create `docs/_config.yml`**

```yaml
title: Forestry CE Wiki
description: A Wiki all about the modern Minecraft mod - Forestry Community Edition
url: "https://forestryce.github.io"
baseurl: "/wiki"

# Jekyll 4 already excludes Gemfile/vendor/_site; nothing extra needed here yet.
```

- [ ] **Step 2: Create `docs/Gemfile`**

```ruby
# frozen_string_literal: true

source "https://rubygems.org"

gem "jekyll", "~> 4.4"
gem "webrick"   # needed to `jekyll serve` on Ruby 3.x
```

- [ ] **Step 3: Create/extend `.gitignore` at repo root**

```gitignore
# Jekyll build output and caches
docs/_site/
docs/.jekyll-cache/
docs/.jekyll-metadata
docs/vendor/
.bundle/
```

- [ ] **Step 4: Install deps and build**

Run (preferred):
```bash
cd docs && bundle install && bundle exec jekyll build
```
Expected: `bundle install` resolves Jekyll 4.4; build ends with `done in N seconds` and writes `docs/_site/`.

Fallback if Bundler misbehaves (note it in the commit message):
```bash
cd docs && jekyll build
```

- [ ] **Step 5: Confirm the build produced output and did not error on any existing page**

Run: `ls docs/_site && echo "---" && ls docs/_site/Forest+Bee`
Expected: `_site` contains `index.html`, `404.html`, `article.js`, `article_style.css`, `Minecraft.otf`, `cdn/`, `Forest+Bee/`, `crafting/`, `getrichsimulator/`, `mainpage/`, etc. `Forest+Bee/` contains `index.html` and its images.

**If the build errors on a specific file** with a Liquid syntax message: that file unexpectedly has front matter or a `{% %}`/`{{ }}` token. Wrap the offending region in `{% raw %}…{% endraw %}`, or add the file to `exclude:` in `_config.yml`, and note it. (Not expected — existing pages have no front matter.)

- [ ] **Step 6: Commit**

```bash
git add docs/_config.yml docs/Gemfile docs/Gemfile.lock .gitignore
git commit -m "feat(jekyll): add Jekyll config, Gemfile, and gitignore (baseurl=/wiki)"
```

---

## Task 2: Verify existing pages render byte-for-byte unchanged

**Files:** none (verification only)

- [ ] **Step 1: Diff source pages against built output for representative pages**

Note: `crafting`, `getrichsimulator`, and `mainpage` are *directories* (e.g. `crafting/` holds `crafting.html`, not `index.html`; `mainpage/` is CSS/JS) — `diff -rq` compares them recursively, so expect directory comparisons there, not single-file diffs. A clean run prints nothing.

Run:
```bash
cd docs
for p in "index.html" "404.html" "Forest+Bee/index.html" "crafting" "getrichsimulator" "mainpage"; do
  echo "== $p =="; diff -rq "$p" "_site/$p" 2>&1 || true
done
diff -q article.js _site/article.js && diff -q article_style.css _site/article_style.css && echo "shared assets identical"
```
Expected: no differences reported for any page or asset (Jekyll copied them verbatim). Any difference on a no-front-matter file is a real problem to investigate before proceeding.

- [ ] **Step 2: Sanity-check the built Forest Bee page still references its assets**

Run: `grep -c "article_style.css" docs/_site/Forest+Bee/index.html`
Expected: `1` (the relative `../article_style.css` link is preserved unchanged — it resolves correctly under `/wiki/` because it is relative).

No commit (verification only). If diffs are clean, the migration is non-destructive.

---

## Task 3: Bring over the base article layout (groundwork)

**Files:** `docs/_layouts/article.html` (create)

This layout is **not used by any existing page** in Plan B (they stay as passthrough). It is brought over because Plan C's bee layout builds on the same structure and the later page-migration sweep will use it. Including it now keeps the foundation complete and lets us confirm a templated page builds.

- [ ] **Step 1: Create `docs/_layouts/article.html`** (verbatim from `try-use-jekyll`, which already uses `relative_url`):

```html
<!DOCTYPE html>
<html lang="en">
<head id="head">
    <meta property="og:site_name" content="Forestry: Community Edition - Wiki">
    <meta property="og:title" content="{{ page.title }}">
    <meta property="og:description" content="{{ page.og_description }}">
    <meta property="og:url" content="{{ page.og_url }}">
    <meta property="og:image" content="{{ page.og_image }}">
    <meta name="theme-color" content="{{ page.theme_color | default: '#f3a90a' }}" data-react-helmet="true" />
    <link rel="stylesheet" href="{{ '/article_style.css' | relative_url }}">
</head>
<body>
    <header class="sticky-header" id="mainHeader"></header>

    <div class="wiki-grid">
        <aside class="toc-sidebar">
            <h3>Contents</h3>
            <ul class="toc-list" id="dynamic-toc"></ul>
        </aside>

        <main class="wiki-content">
            <div class="article-header">
                <h2 style="text-transform:uppercase" id="articletitle">{{ page.title }}</h2>
                {% if page.similar %}
                <div class="topic-links">
                    <span>similar:</span>
                    {% for item in page.similar %}
                    <a href="{{ item.href }}">{{ item.name }}</a>
                    {% endfor %}
                </div>
                {% endif %}
            </div>

            {{ content }}
        </main>
    </div>

    <footer class="wiki-footer" id="footer">
        {% if page.page_author %}
        <div class="footer-attribution">
            original page author · {{ page.page_author }}
        </div>
        {% endif %}
    </footer>
    <script src="{{ '/article.js' | relative_url }}"></script>
</body>
</html>
```

- [ ] **Step 2: Build to confirm the layout is valid Liquid**

Run: `cd docs && bundle exec jekyll build` (or `jekyll build`)
Expected: build succeeds (an unused layout still gets parsed; a Liquid error would fail the build).

- [ ] **Step 3: Commit**

```bash
git add docs/_layouts/article.html
git commit -m "feat(jekyll): add base article layout (groundwork for Plan C + page migration)"
```

---

## Task 4: GitHub Actions deploy workflow

**Files:** `.github/workflows/jekyll.yml` (create)

- [ ] **Step 1: Create `.github/workflows/jekyll.yml`**

```yaml
name: Deploy Jekyll site to Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

# Allow one concurrent deployment; don't cancel in-progress production deploys.
concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.4'
          bundler-cache: true
          working-directory: docs
      - name: Build with Jekyll
        working-directory: docs
        run: bundle exec jekyll build --destination ../_site
        env:
          JEKYLL_ENV: production
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: _site

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

Notes for the executor:
- The build uses `docs/_config.yml`'s `baseurl: /wiki`, so CI and local builds are identical (no `--baseurl` override).
- `working-directory: docs` + `--destination ../_site` puts output at repo-root `_site`, which `upload-pages-artifact` defaults to.

- [ ] **Step 2: Validate the workflow YAML locally**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/jekyll.yml')); print('YAML OK')"`
Expected: `YAML OK`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/jekyll.yml
git commit -m "ci(jekyll): build docs/ and deploy to GitHub Pages via Actions"
```

---

## Task 5: Final verification + handoff notes

- [ ] **Step 1: Clean rebuild from scratch**

Run: `cd docs && rm -rf _site .jekyll-cache && bundle exec jekyll build && echo "clean build OK"`
Expected: `clean build OK`, `_site` regenerated.

- [ ] **Step 2: (Optional) link-check the built site**

If `html-proofer` is available (`gem install html-proofer` or add to Gemfile):
Run: `cd docs && htmlproofer _site --disable-external --allow-hash-href --ignore-empty-alt true`
Expected: no internal broken-link errors (external links disabled). Note any pre-existing internal breakages — do not necessarily fix them here, but report them.

- [ ] **Step 3: Document the manual GitHub steps (do NOT attempt from code)**

These are performed by the maintainer in the GitHub UI **after** this branch merges to `main` and the workflow runs green once:
1. Repo **Settings → Pages → Build and deployment → Source → "GitHub Actions"** (was "Deploy from a branch: /docs"). This is the cutover; until done, the live site keeps serving the old static `docs/`.
2. After switching, confirm `https://forestryce.github.io/wiki/` and a deep page (e.g. `https://forestryce.github.io/wiki/Forest+Bee/`) load correctly and styled.

---

## Definition of done

- `bundle exec jekyll build` (from `docs/`) succeeds from a clean state.
- Every existing page and shared asset is byte-for-byte identical in `_site` (Task 2 diff clean) — the migration is visually non-destructive.
- `baseurl` is `/wiki`; the base `article.html` layout parses.
- `.github/workflows/jekyll.yml` is valid YAML and present (activates on merge to `main`).
- Handoff notes list the one-time manual Pages-source switch and post-deploy checks.

> After merging to `main`, the deploy is live-verified by the maintainer (the Pages-source switch + loading the site). Plan C (bees collection, `_data`-driven layout, includes, sync script, search index) builds directly on this foundation.
