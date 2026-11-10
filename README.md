# Md Nurul Kadir — Portfolio website

The website at **https://mnkadir.github.io**. It is a plain static site hosted by GitHub Pages: no build tools, nothing to install.

## How to update the website (no coding)

### Add a conference, seminar, certificate, interview, award or news item

1. Open the form: **https://github.com/mnkadir/mnkadir.github.io/issues/new?template=add-update.yml**
   (or go to the repository → **Issues** → **New issue** → **Add a website update**).
2. Choose the type, write a title and a date.
3. Optional: add the event or place, a short description and a link. A YouTube link plays directly on the site.
4. Optional: click in the **Photos or certificate** box and drag in your photos (JPG or PNG) or a PDF certificate. Wait for each upload to finish. The first photo becomes the cover.
5. Press **Create**.

Two types also appear on the home page:

- **Research figure**: attach the figure image and paste the paper link. It shows in **Featured figures** on the home page.
- **Any item with a YouTube link** (a talk, interview or lecture): it shows and plays in the **Video archive** on the home page.

About two minutes later the item is on the **Highlights** page and in **Recent news** on the home page. The form replies with the link and closes itself. If something is wrong (for example a date it cannot read), the reply tells you what to fix.

This works from a phone too. Bookmark the form link.

### Add a publication

Open **https://github.com/mnkadir/mnkadir.github.io/issues/new?template=add-publication.yml**, fill in the title, year, type and (ideally) the DOI link, and press **Create**. It is added to the Publications page, the publication count, and Recent news.

### Change or remove an item

Everything the forms add is stored in two small list files:

- `data/updates.json` — highlights and news
- `data/publications.json` — publications

Open the file on GitHub, click the pencil icon, change the text or delete the whole block for that item (from its `{` to its `}`, including the comma that separates it from its neighbour), and commit. Photos live in `assets/updates/`.

### Change other text

Open the relevant `.html` file on GitHub, click the pencil icon, edit the text and commit.

| Page | File |
| --- | --- |
| Home | `index.html` |
| About | `about.html` |
| Research | `research.html` |
| Publications | `publications.html` (list comes from `data/publications.json`) |
| Highlights | `highlights.html` (items come from `data/updates.json`) |
| Teaching | `teaching.html` |
| Contact | `contact.html` |

To change the profile photo, replace `assets/md-nurul-kadir.jpg` with a new square image using the same file name.

## How the forms work

- `.github/ISSUE_TEMPLATE/` holds the two forms.
- `.github/workflows/site-content.yml` runs when a form is submitted. It only acts on forms submitted by the repository owner, so other people cannot change the site.
- `.github/scripts/add_content.py` reads the form, shrinks photos to web size, removes hidden photo data such as GPS location, and updates the list files.

## Preview on your own computer

The pages load their lists from the `data` folder, so open the site through a small local server rather than by double-clicking a file. For example, with Python installed:

```
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Sources

See [SOURCES.md](SOURCES.md) for the public profiles the content was compiled from.
