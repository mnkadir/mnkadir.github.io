# Md Nurul Kadir — Multi-page Portfolio

A dependency-free static portfolio for GitHub Pages.

## Pages

- `index.html` — Home
- `about.html` — Biography, education, experience, awards, certifications, languages, and memberships
- `research.html` — Research themes and projects
- `publications.html` — All 22 publicly indexed outputs
- `teaching.html` — Teaching approach and lecture videos
- `contact.html` — Contact information and professional profiles

## Preview locally

Open `index.html` or run a local server inside this folder:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Update the existing GitHub website

Your GitHub repository should be named `mnkadir.github.io` for the address `https://mnkadir.github.io`.

### Easiest method: GitHub website

1. Open `https://github.com/mnkadir/mnkadir.github.io`.
2. Select **Add file → Upload files**.
3. On your computer, open the `personal portfolio` folder.
4. Select **everything inside the folder**—all HTML files, `styles.css`, `script.js`, `.nojekyll`, and the complete `assets` folder.
5. Drag the selected items into GitHub’s upload area.
6. Existing files with the same names will be replaced; new pages and the profile image will be added.
7. Enter the commit message: `Replace portfolio with multi-page website`.
8. Select **Commit changes**.
9. Open **Settings → Pages** and confirm the source is `main` and `/ (root)`.
10. Wait one to five minutes, then reload `https://mnkadir.github.io` using `Ctrl+F5`.

Important: upload the contents of `personal portfolio`, not the enclosing folder. `index.html` must sit at the repository root.

### Future text updates

For a small edit, open the relevant `.html` file on GitHub, click the pencil icon, edit the text, and commit. The site redeploys automatically.

### Updating the profile image

Replace `assets/md-nurul-kadir.jpg` with a new image using the exact same filename, then commit it. A square image of at least 800×800 pixels is recommended.

## Source record

See [SOURCES.md](SOURCES.md) for the public profiles used and the editorial note about conflicting date ranges.
