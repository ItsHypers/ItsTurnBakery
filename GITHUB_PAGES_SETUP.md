# GitHub Pages Setup

This project must be served from the compiled `gh-pages` branch.

Use these settings in GitHub:

1. Open the repository.
2. Go to `Settings`.
3. Go to `Pages`.
4. Under `Build and deployment`, choose:
   - Source: `Deploy from a branch`
   - Branch: `gh-pages`
   - Folder: `/ (root)`
5. Save.

Do not serve this site from `main`.

If GitHub Pages serves `main`, the browser tries to load `src/main.jsx`
directly. GitHub Pages serves that file as `text/jsx`, and browsers refuse
to run it as a JavaScript module. That causes a blank white page.
