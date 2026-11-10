#!/usr/bin/env python3
"""Turn a submitted GitHub form into website content.

Run by .github/workflows/site-content.yml when the repository owner submits the
"Add a website update" or "Add a publication" form. It reads the form text,
saves any attached photos or PDFs into assets/updates/, and adds an entry to
data/updates.json or data/publications.json. Everything in the form is treated
as plain text; nothing from it is ever executed.

Environment: ISSUE_BODY, ISSUE_NUMBER, FORM_KIND ("update" or "publication"),
GITHUB_TOKEN (optional, only used to download attachments), RESULT_FILE,
COMMIT_MSG_FILE.
"""
import datetime
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
UPDATES = ROOT / "data" / "updates.json"
PUBLICATIONS = ROOT / "data" / "publications.json"
MEDIA_DIR = ROOT / "assets" / "updates"
SITE = "https://mnkadir.github.io"

# Attachments are only ever downloaded from GitHub's own upload hosts.
ATTACHMENT_PREFIXES = (
    "https://github.com/user-attachments/",
    "https://user-images.githubusercontent.com/",
    "https://private-user-images.githubusercontent.com/",
    "https://github.com/mnkadir/mnkadir.github.io/files/",
)
MAX_FILES = 15
MAX_BYTES = 25 * 1024 * 1024

UPDATE_TYPES = {
    "conference presentation": "conference",
    "seminar or talk": "seminar",
    "research figure (shown on the home page)": "figure",
    "video (talk, lecture or recording)": "video",
    "training or certificate": "certificate",
    "media or interview": "media",
    "award or recognition": "award",
    "news": "news",
}
PUBLICATION_TYPES = {"Article", "Preprint", "Conference paper", "Poster", "Presentation", "Data"}
DATE_FORMATS = ("%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%d %B %Y", "%d %b %Y", "%B %d, %Y", "%b %d, %Y", "%B %d %Y", "%b %d %Y")
MONTH_FORMATS = ("%Y-%m", "%Y/%m", "%B %Y", "%b %Y", "%m/%Y")

notes = []


class FormError(Exception):
    """A problem the form's author can fix."""


def parse_sections(body):
    """Issue forms arrive as '### Label' headings followed by the answer."""
    sections = {}
    current = None
    for line in body.replace("\r\n", "\n").split("\n"):
        heading = re.match(r"^###\s+(.+?)\s*$", line)
        if heading:
            current = heading.group(1).strip().lower()
            sections[current] = []
        elif current is not None:
            sections[current].append(line)
    cleaned = {}
    for key, lines in sections.items():
        text = "\n".join(lines).strip()
        cleaned[key] = "" if text == "_No response_" else text
    return cleaned


def one_line(text, limit):
    text = re.sub(r"\s+", " ", text or "").strip()
    return text[:limit].strip()


def clean_text(text, limit):
    """Plain text only: drop image/HTML markup that GitHub adds for uploads."""
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text or "")
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text[:limit].strip()


def parse_date(text):
    value = one_line(text, 40)
    if not value:
        raise FormError("The **Date** box is empty. Please write a date such as `2026-12-14`.")
    if re.fullmatch(r"\d{4}", value):
        return value
    for fmt in DATE_FORMATS:
        try:
            return datetime.datetime.strptime(value, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    for fmt in MONTH_FORMATS:
        try:
            return datetime.datetime.strptime(value, fmt).strftime("%Y-%m")
        except ValueError:
            pass
    raise FormError(f"I could not read the date `{value}`. Please write it like `2026-12-14`, `2026-12` or `2026`.")


def parse_link(text):
    value = one_line(text, 600)
    if not value:
        return ""
    markdown = re.match(r"^\[[^\]]*\]\((\S+)\)$", value)
    if markdown:
        value = markdown.group(1)
    value = value.strip("<>")
    if re.match(r"^10\.\d{4,9}/\S+$", value):
        value = "https://doi.org/" + value
    elif not re.match(r"^https?://", value, re.I):
        if re.match(r"^[\w-]+(\.[\w-]+)+(/\S*)?$", value):
            value = "https://" + value
        else:
            raise FormError(f"The link `{value}` does not look like a web address. It should start with `https://`.")
    if re.search(r"[\s\"'<>`]", value):
        raise FormError("The link contains spaces or quote marks. Please paste only the web address.")
    return value


def slugify(text, limit=48):
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text).strip("-")
    return slug[:limit].strip("-") or "item"


def load(path):
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise SystemExit(f"{path} is not a list; fix the file before adding items.")
    return data


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


class _DropAuthOnRedirect(urllib.request.HTTPRedirectHandler):
    """GitHub redirects uploads to signed storage links that reject extra credentials."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        new = super().redirect_request(req, fp, code, msg, headers, newurl)
        if new is not None:
            new.headers.pop("Authorization", None)
            new.unredirected_hdrs.pop("Authorization", None)
        return new


def download(url):
    token = os.environ.get("GITHUB_TOKEN", "")
    attempts = [None, token] if token else [None]
    last_error = None
    for auth in attempts:
        request = urllib.request.Request(url, headers={"User-Agent": "mnkadir-site-updater", "Accept": "*/*"})
        if auth:
            request.add_unredirected_header("Authorization", "Bearer " + auth)
        opener = urllib.request.build_opener(_DropAuthOnRedirect())
        try:
            with opener.open(request, timeout=60) as response:
                data = response.read(MAX_BYTES + 1)
            if len(data) > MAX_BYTES:
                raise FormError("One of the attached files is larger than 25 MB. Please attach a smaller copy.")
            return data
        except (urllib.error.URLError, TimeoutError) as error:
            last_error = error
    raise FormError(f"I could not download one of the attached files ({last_error}). Please open the form again and re-attach it.")


def sniff(data):
    if data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    if data[:5] == b"%PDF-":
        return "pdf"
    if data[4:8] == b"ftyp" and data[8:12] in (b"heic", b"heix", b"mif1", b"heif", b"avif"):
        return "heic"
    return ""


def save_image(data, kind, target):
    """Resize to at most 1600 px, fix rotation and remove hidden data such as GPS location."""
    tool = shutil.which("magick") or shutil.which("convert")
    if tool:
        with tempfile.TemporaryDirectory() as tmp:
            source = pathlib.Path(tmp) / f"upload.{kind}"
            source.write_bytes(data)
            command = [tool, f"{source}[0]", "-auto-orient", "-resize", "1600x1600>", "-background", "white",
                       "-alpha", "remove", "-strip", "-quality", "85", str(target)]
            result = subprocess.run(command, capture_output=True, text=True)
            if result.returncode == 0 and target.exists() and target.stat().st_size > 0:
                return target
            notes.append("One photo could not be resized, so it was used as uploaded.")
    if kind in ("jpg", "png", "gif", "webp"):
        fallback = target.with_suffix("." + kind)
        fallback.write_bytes(data)
        return fallback
    notes.append("One attached photo is in a format the website cannot show (for example HEIC). Please attach it as JPG or PNG.")
    return None


def collect_attachments(text, item_id):
    urls = []
    for url in re.findall(r"https://[^\s)\"'<>\]]+", text or ""):
        if url.startswith(ATTACHMENT_PREFIXES) and url not in urls:
            urls.append(url)
    if len(urls) > MAX_FILES:
        notes.append(f"Only the first {MAX_FILES} attached files were used.")
        urls = urls[:MAX_FILES]
    images, files = [], []
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    for index, url in enumerate(urls, start=1):
        data = download(url)
        kind = sniff(data)
        if kind == "pdf":
            target = MEDIA_DIR / f"{item_id}-{index}.pdf"
            target.write_bytes(data)
            files.append({"url": target.relative_to(ROOT).as_posix(), "label": "View certificate (PDF)"})
        elif kind:
            saved = save_image(data, kind, MEDIA_DIR / f"{item_id}-{index}.jpg")
            if saved:
                images.append(saved.relative_to(ROOT).as_posix())
        else:
            notes.append("One attached file was skipped because it is not a photo or a PDF.")
    return images, files


def unique_id(base, existing):
    candidate, counter = base, 2
    while candidate in existing:
        candidate = f"{base}-{counter}"
        counter += 1
    return candidate


def add_update(form, issue_number):
    kind = UPDATE_TYPES.get(one_line(form.get("type", ""), 60).lower())
    if not kind:
        raise FormError("Please choose a **Type** from the list.")
    title = one_line(form.get("title", ""), 200)
    if not title:
        raise FormError("The **Title** box is empty.")
    date = parse_date(form.get("date", ""))
    updates = load(UPDATES)
    item_id = unique_id(f"{date}-{slugify(title)}", {str(u.get("id")) for u in updates})
    images, files = collect_attachments(form.get("photos or certificate", ""), item_id)
    item = {
        "id": item_id,
        "type": kind,
        "title": title,
        "date": date,
        "place": one_line(form.get("event or place", ""), 200),
        "summary": clean_text(form.get("short description", ""), 1200),
        "link": parse_link(form.get("link", "")),
        "images": images,
    }
    if files:
        item["files"] = files
    item["source_issue"] = issue_number
    updates.append(item)
    updates.sort(key=lambda u: str(u.get("date", "")), reverse=True)
    save(UPDATES, updates)
    photo_text = f" with {len(images)} photo{'s' if len(images) != 1 else ''}" if images else ""
    return (f"Add update: {title}",
            f"Added **{title}**{photo_text}. It will appear on the website in about two minutes:\n\n"
            f"- {SITE}/highlights.html#{urllib.parse.quote(item_id)}\n- {SITE}/ (Recent news)")


def add_publication(form, issue_number):
    title = one_line(form.get("title", ""), 400)
    if not title:
        raise FormError("The **Title** box is empty.")
    year_text = one_line(form.get("year", ""), 10)
    if not re.fullmatch(r"(19|20)\d{2}", year_text):
        raise FormError(f"The year `{year_text}` should be four digits, such as `2026`.")
    kind = one_line(form.get("type", ""), 40)
    if kind not in PUBLICATION_TYPES:
        raise FormError("Please choose a **Type** from the list.")
    link = parse_link(form.get("link", ""))
    venue = one_line(form.get("journal or venue", ""), 200)
    publications = load(PUBLICATIONS)
    if any(one_line(str(p.get("title", "")), 400).lower() == title.lower() for p in publications):
        raise FormError("A publication with this exact title is already on the website.")
    entry = {"title": title, "year": int(year_text), "type": kind}
    if venue:
        entry["venue"] = venue
    entry["url"] = link
    if link:
        entry["link_label"] = "DOI" if "doi.org/" in link.lower() else "Open"
    publications.append(entry)
    publications.sort(key=lambda p: int(p.get("year") or 0), reverse=True)
    save(PUBLICATIONS, publications)

    updates = load(UPDATES)
    today = datetime.date.today()
    news_date = today.isoformat() if int(year_text) == today.year else year_text
    news_id = unique_id(f"{news_date}-{slugify(title)}", {str(u.get("id")) for u in updates})
    updates.append({
        "id": news_id, "type": "news", "title": f"New {kind.lower()}: {title}", "date": news_date,
        "place": venue, "summary": "", "link": link, "images": [], "source_issue": issue_number,
    })
    updates.sort(key=lambda u: str(u.get("date", "")), reverse=True)
    save(UPDATES, updates)
    return (f"Add publication: {title}",
            f"Added **{title}** to the publication list and to Recent news. "
            f"It will appear in about two minutes:\n\n- {SITE}/publications.html")


def main():
    result_file = pathlib.Path(os.environ.get("RESULT_FILE", "result.md"))
    commit_file = pathlib.Path(os.environ.get("COMMIT_MSG_FILE", "commit-message.txt"))
    form = parse_sections(os.environ.get("ISSUE_BODY", ""))
    try:
        issue_number = int(os.environ.get("ISSUE_NUMBER", "0"))
    except ValueError:
        issue_number = 0
    try:
        if issue_number and any(u.get("source_issue") == issue_number for u in load(UPDATES)):
            raise FormError("This form was already added to the website. To add another item, please fill in a new form.")
        if os.environ.get("FORM_KIND") == "publication":
            commit_message, message = add_publication(form, issue_number)
        else:
            commit_message, message = add_update(form, issue_number)
    except FormError as error:
        result_file.write_text(
            f"Sorry, this could not be added to the website.\n\n{error}\n\n"
            "Nothing was changed. Please edit this issue to fix it, then close and reopen the issue to try again.\n",
            encoding="utf-8")
        return 1
    if notes:
        message += "\n\nNotes:\n" + "\n".join(f"- {note}" for note in dict.fromkeys(notes))
    result_file.write_text(message + "\n", encoding="utf-8")
    commit_file.write_text(commit_message[:120] + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
