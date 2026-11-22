# leahdyhrkopp.github.io

Personal site for Leah Dyhrkopp: background, experience, coursework and project case studies.
Plain HTML, CSS and JavaScript with no build step, so it runs on GitHub Pages as-is.

```
index.html                        Home: about, experience, work, coursework, contact
projects/admissions-dashboard.html  Case study + interactive rebuild of the Tableau final
projects/market-segmentation.html   Case study: AI customer segmentation (AI for Marketing)
404.html                          "Page not found" page
assets/css/style.css              All styles (maroon + cream theme lives in :root)
assets/js/main.js                 Menu, scroll effects
assets/js/dashboard.js            Interactive dashboard charts
assets/js/admissions-data.js      Aggregated dashboard data (no student IDs)
assets/img/                       Favicon, previews, segmentation plots
.nojekyll                         Tells GitHub Pages to serve files as-is
```

## Publish on GitHub Pages

1. Create a free account at github.com if you don't have one.
2. Create a new **public** repository named exactly `YOUR-USERNAME.github.io`
   (for example `leahdyhrkopp.github.io`).
3. On the repo page, click **Add file → Upload files**, drag in **everything inside this folder**
   (including the `assets` and `projects` folders and the `.nojekyll` file), and click **Commit changes**.
   > On a Mac, press `Cmd + Shift + .` in Finder to see `.nojekyll`.
4. Go to **Settings → Pages**. Under *Build and deployment*, set Source to **Deploy from a branch**,
   branch **main**, folder **/ (root)**, then click **Save**.
5. After a minute or two, the site is live at `https://YOUR-USERNAME.github.io`.

To preview locally first, open `index.html` in your browser.

## Before you publish

Already filled in: email, LinkedIn, résumé PDF, headshot and internship details.

- [ ] **Résumé privacy**: the PDF at `assets/Leah-Dyhrkopp-Resume.pdf` includes your phone number and
      will be public. Swap in a version without it if you'd rather not share it.
- [ ] **Dashboard reflection**: add a line in your own voice at the end of `admissions-dashboard.html`
      (search for `EDIT`).
- [ ] **Tableau Public (optional)**: publish the workbook to Tableau Public, copy its embed code and
      paste it in place of the `embed-slot` box in `admissions-dashboard.html`.
- [ ] Ask teammates/professors before posting group work, and keep anything confidential off the site.
- [ ] When you update your résumé, replace the PDF with the new one under the same file name.

## Custom domain (optional)

Buy a domain (e.g. `leahdyhrkopp.com`), then go to **Settings → Pages → Custom domain**,
enter it and follow GitHub's DNS instructions. Check **Enforce HTTPS** once it's available.

## Changing the look

Colors and fonts are defined at the top of `assets/css/style.css` under `:root`.
Change `--maroon` or `--cream` there and the whole site updates.
