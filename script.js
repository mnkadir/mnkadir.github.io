/* Md Nurul Kadir — portfolio scripts
   Content for Highlights, Recent news and Publications is read from
   data/updates.json and data/publications.json. Those files are updated
   automatically by the "Add a website update" form on GitHub. */

// ---------- Navigation, footer year, reveal, progress bar ----------
const menu = document.querySelector('.menu');
const nav = document.querySelector('#nav');
if (menu && nav) {
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') === 'true';
    menu.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('open', !open);
  });
}
const page = document.body.dataset.page;
document.querySelector(`[data-nav="${page}"]`)?.classList.add('active');
document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

const io = new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.isIntersecting) { entry.target.classList.add('visible'); io.unobserve(entry.target); }
}), { threshold: 0.08 });
const watch = el => { if (el.classList.contains('reveal')) io.observe(el); };
document.querySelectorAll('.reveal').forEach(watch);

const progress = document.querySelector('.progress');
if (progress) {
  const setProgress = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.width = `${max > 0 ? scrollY / max * 100 : 0}%`;
  };
  addEventListener('scroll', setProgress, { passive: true });
  setProgress();
}

// ---------- Small helpers ----------
const TYPES = {
  conference: 'Conference',
  seminar: 'Seminar & talk',
  certificate: 'Training & certificate',
  media: 'Media & interview',
  figure: 'Research figure',
  fieldwork: 'Fieldwork & lab',
  video: 'Video',
  award: 'Award',
  news: 'News'
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  children.flat().forEach(child => { if (child) node.append(child); });
  return node;
}
// Only allow normal web links and files inside this site.
function safeUrl(url) {
  if (typeof url !== 'string') return '';
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (/^(assets|data)\/[\w\-./]+$/.test(u) && !u.includes('..')) return u;
  return '';
}
function formatDate(value) {
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(value || '');
  if (!m) return value || '';
  const [, y, mo, d] = m;
  if (d) return `${Number(d)} ${MONTHS[Number(mo) - 1]} ${y}`;
  if (mo) return `${MONTHS[Number(mo) - 1]} ${y}`;
  return y;
}
function youtubeId(url) {
  const m = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/.exec(url || '');
  return m ? m[1] : '';
}
function linkLabel(url) {
  if (youtubeId(url)) return 'Watch on YouTube';
  if (/doi\.org\//i.test(url)) return 'View publication';
  if (/\.pdf($|\?)/i.test(url)) return 'Open PDF';
  return 'Learn more';
}
async function loadJson(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}
const byNewest = (a, b) => String(b.date || '').localeCompare(String(a.date || ''));

// ---------- Photo viewer ----------
// `images` is a list of image paths, or of { src, caption, video } objects
// (video = a YouTube id, played inside the viewer).
let lightbox;
function openLightbox(images, title, start = 0) {
  if (!lightbox) {
    const stage = el('div', { class: 'lb-stage' });
    const caption = el('span');
    const prev = el('button', { type: 'button', text: '← Previous' });
    const next = el('button', { type: 'button', text: 'Next →' });
    const close = el('button', { type: 'button', text: 'Close' });
    lightbox = el('dialog', { class: 'lightbox', 'aria-label': 'Photo viewer' },
      el('figure', {}, stage, el('figcaption', {}, caption, el('div', { class: 'lb-buttons' }, prev, next, close))));
    document.body.append(lightbox);
    const show = step => {
      const count = lightbox.items.length;
      lightbox.index = (lightbox.index + step + count) % count;
      const item = lightbox.items[lightbox.index];
      stage.replaceChildren(item.video
        ? el('iframe', {
            src: `https://www.youtube-nocookie.com/embed/${item.video}?autoplay=1`, title: item.caption || lightbox.title,
            allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture', allowfullscreen: ''
          })
        : el('img', { src: item.src, alt: item.caption || lightbox.title }));
      const text = item.caption || lightbox.title;
      caption.textContent = count > 1 ? `${text} (${lightbox.index + 1} of ${count})` : text;
      prev.hidden = next.hidden = count < 2;
    };
    lightbox.show_ = show;
    prev.addEventListener('click', () => show(-1));
    next.addEventListener('click', () => show(1));
    const hide = () => { stage.replaceChildren(); lightbox.close(); }; // emptying the stage stops any playing video
    close.addEventListener('click', hide);
    lightbox.addEventListener('cancel', () => stage.replaceChildren());
    lightbox.addEventListener('close', () => stage.replaceChildren());
    lightbox.addEventListener('click', event => { if (event.target === lightbox) hide(); });
    lightbox.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft') show(-1);
      if (event.key === 'ArrowRight') show(1);
    });
  }
  lightbox.items = images.map(image => (typeof image === 'string' ? { src: image } : image));
  lightbox.title = title;
  lightbox.index = start;
  lightbox.show_(0);
  lightbox.showModal();
}

// All pictures of one update, each with its caption. A YouTube video with no
// photos uses the video's own thumbnail and plays in the viewer.
function photosOf(item) {
  const captions = Array.isArray(item.captions) ? item.captions : [];
  const photos = (item.images || []).map((src, i) => ({ src: safeUrl(src), caption: captions[i] || item.title }))
    .filter(photo => photo.src);
  const video = youtubeId(item.link);
  if (!photos.length && video) photos.push({ src: `https://i.ytimg.com/vi/${video}/hqdefault.jpg`, caption: item.title, video });
  return photos;
}

// ---------- CV button ----------
// Every "Download CV" button links to assets/cv/Md_Nurul_Kadir_CV.pdf.
// To update the CV, upload a new file with exactly that name. If the file is ever
// missing, the buttons switch to LinkedIn instead of showing a broken link.
const CV_PATH = 'assets/cv/Md_Nurul_Kadir_CV.pdf';
const cvButtons = document.querySelectorAll('[data-cv]');
if (cvButtons.length) {
  fetch(CV_PATH, { method: 'HEAD', cache: 'no-cache' }).then(r => r.status !== 404).catch(() => true).then(found => {
    if (found) return;
    cvButtons.forEach(a => {
      a.href = 'https://www.linkedin.com/in/md-nurul-kadir';
      a.removeAttribute('download');
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'CV on LinkedIn ↗';
    });
  });
}

// Turns "[words](https://link)" in a description into a clickable link; everything else stays plain text.
function richText(text) {
  const parts = [];
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let last = 0;
  let match;
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(document.createTextNode(text.slice(last, match.index)));
    parts.push(el('a', { href: match[2], target: '_blank', rel: 'noopener', text: match[1].replace(/[,\s]+$/, '') }));
    if (/[,\s]+$/.test(match[1])) parts.push(document.createTextNode(match[1].match(/[,\s]+$/)[0]));
    last = pattern.lastIndex;
  }
  if (last < text.length) parts.push(document.createTextNode(text.slice(last)));
  return parts;
}

// Any element with data-zoom="image path" opens that image in the photo viewer.
document.querySelectorAll('[data-zoom]').forEach(node => {
  node.addEventListener('click', () => {
    const src = safeUrl(node.dataset.zoom);
    if (src) openLightbox([src], node.dataset.zoomTitle || '');
  });
});

// ---------- Highlights ----------
function updateCard(item, options = {}) {
  const images = (item.images || []).map(safeUrl).filter(Boolean);
  const link = safeUrl(item.link);
  const video = youtubeId(link);
  const typeLabel = TYPES[item.type] || 'News';
  const whole = item.type === 'certificate' || item.type === 'figure'; // show the whole image, never crop it
  let media = null;

  if (images.length && !(options.preferVideo && video)) {
    media = el('button', {
      class: `update-media${whole ? ' contain' : ''}`, type: 'button',
      'aria-label': `View ${images.length > 1 ? images.length + ' photos' : 'photo'}: ${item.title}`
    },
      el('img', { src: images[0], alt: item.title, loading: 'lazy' }),
      images.length > 1 ? el('span', { class: 'count', text: `${images.length} photos` }) : null);
    media.addEventListener('click', () => openLightbox(photosOf(item), item.title));
  } else if (video) {
    media = el('button', { class: 'update-media', type: 'button', 'aria-label': `Play video: ${item.title}` },
      el('img', { src: `https://i.ytimg.com/vi/${video}/hqdefault.jpg`, alt: '', loading: 'lazy' }),
      el('span', { class: 'play' }));
    media.addEventListener('click', () => {
      const frame = el('iframe', {
        src: `https://www.youtube-nocookie.com/embed/${video}?autoplay=1`, title: item.title,
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        allowfullscreen: ''
      });
      const holder = el('div', { class: 'update-media' }, frame);
      media.replaceWith(holder);
    });
  }

  const links = [];
  if (link) links.push(el('a', { href: link, target: '_blank', rel: 'noopener', text: `${item.link_label || linkLabel(link)} ↗` }));
  (item.files || []).forEach(file => {
    const url = safeUrl(file.url);
    if (url) links.push(el('a', { href: url, target: '_blank', rel: 'noopener', text: `${file.label || 'Open file'} ↗` }));
  });

  return el('article', { class: 'update-card', id: options.noId ? null : item.id, 'data-type': item.type },
    media,
    el('div', { class: 'update-body' },
      el('div', { class: 'update-meta' },
        el('span', { class: 'badge', 'data-type': item.type, text: typeLabel }),
        el('time', { datetime: item.date, text: formatDate(item.date) })),
      el('h3', { text: item.title }),
      item.place ? el('p', { class: 'update-place', text: item.place }) : null,
      item.summary ? el('p', { class: 'update-summary' }, richText(item.summary)) : null,
      links.length ? el('div', { class: 'update-links' }, links) : null));
}

function renderHighlights(root, items) {
  const filterBar = root.querySelector('[data-filters]');
  const grid = root.querySelector('[data-grid]');
  if (!items.length) {
    grid.replaceChildren(el('p', { class: 'empty-note', text: 'New highlights will appear here soon.' }));
    return;
  }
  const counts = {};
  items.forEach(item => { counts[item.type] = (counts[item.type] || 0) + 1; });
  const draw = type => {
    const shown = type === 'all' ? items : items.filter(item => item.type === type);
    grid.replaceChildren(...shown.map(updateCard));
    filterBar.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.type === type)));
  };
  const button = (type, label, count) => {
    const b = el('button', { type: 'button', 'data-type': type, 'aria-pressed': 'false' }, label, el('small', { text: String(count) }));
    b.addEventListener('click', () => draw(type));
    return b;
  };
  filterBar.replaceChildren(button('all', 'All', items.length),
    ...Object.keys(TYPES).filter(type => counts[type]).map(type => button(type, TYPES[type], counts[type])));

  const hash = decodeURIComponent(location.hash.slice(1));
  draw(TYPES[hash] && counts[hash] ? hash : 'all');
  const target = hash && document.getElementById(hash);
  if (target) target.scrollIntoView({ block: 'center' });
}

// ---------- Recent news (home page) ----------
function renderNews(root, items) {
  const limit = Number(root.dataset.limit) || 5;
  if (!items.length) {
    root.replaceChildren(el('p', { class: 'empty-note', text: 'News will appear here soon.' }));
    return;
  }
  root.replaceChildren(...items.filter(item => item.date).slice(0, limit).map(item => {
    const image = safeUrl((item.images || [])[0]);
    return el('a', { class: 'news-item', href: `highlights.html#${encodeURIComponent(item.id)}` },
      el('time', { datetime: item.date, text: formatDate(item.date) }),
      el('div', {},
        el('span', { class: 'badge', 'data-type': item.type, text: TYPES[item.type] || 'News' }),
        el('h3', { text: item.title })),
      image ? el('img', { src: image, alt: '', loading: 'lazy' }) : null);
  }));
}

// ---------- Featured figures and video archive (home page) ----------
// Each section stays hidden until there is at least one item to show.
function renderStrip(root, items, options) {
  const section = root.closest('section');
  const limit = Number(root.dataset.limit) || 6;
  if (!items.length) { if (section) section.hidden = true; return; }
  root.replaceChildren(...items.slice(0, limit).map(item => updateCard(item, { ...options, noId: true })));
  if (section) section.hidden = false;
}

// ---------- Publications ----------
function renderPublications(root, items) {
  const filterBar = document.querySelector('[data-pub-filters]');
  const sorted = [...items].sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
  const draw = type => {
    const shown = type === 'all' ? sorted : sorted.filter(item => item.type === type);
    root.replaceChildren(...shown.map(item => {
      const url = safeUrl(item.url);
      const details = [item.type, item.year, item.venue].filter(Boolean).join(' · ');
      const body = el('div', {}, el('h2', { text: item.title }), el('p', { text: details }));
      return url
        ? el('a', { class: 'pub', href: url, target: '_blank', rel: 'noopener' }, body,
            el('span', { class: 'pub-link', text: `${item.link_label || 'Open'} ↗` }))
        : el('div', { class: 'pub' }, body);
    }));
    filterBar?.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.type === type)));
  };
  if (filterBar) {
    const counts = {};
    sorted.forEach(item => { counts[item.type] = (counts[item.type] || 0) + 1; });
    const button = (type, label, count) => {
      const b = el('button', { type: 'button', 'data-type': type, 'aria-pressed': 'false' }, label, el('small', { text: String(count) }));
      b.addEventListener('click', () => draw(type));
      return b;
    };
    filterBar.replaceChildren(button('all', 'All', sorted.length),
      ...Object.keys(counts).sort().map(type => button(type, type, counts[type])));
  }
  draw('all');
}

// ---------- Gallery ----------
// Every update that has photos (or a YouTube video) becomes one album tile.
const GALLERY_GROUPS = [
  { id: 'figures', label: 'Research figures & posters', types: ['figure'] },
  { id: 'events', label: 'Conferences & talks', types: ['conference', 'seminar', 'news'] },
  { id: 'field', label: 'Fieldwork & lab', types: ['fieldwork'] },
  { id: 'awards', label: 'Certificates & awards', types: ['certificate', 'award'] },
  { id: 'media', label: 'Media & videos', types: ['media', 'video'] }
];
const groupOf = item => GALLERY_GROUPS.find(group => group.types.includes(item.type)) || GALLERY_GROUPS[1];

function galleryTile(item) {
  const photos = photosOf(item);
  const group = groupOf(item);
  const meta = [group.label, formatDate(item.date)].filter(Boolean).join(' · ');
  const tile = el('button', { class: 'g-tile', type: 'button', 'data-group': group.id,
    'aria-label': `${photos[0].video ? 'Play video' : `View ${photos.length > 1 ? photos.length + ' photos' : 'photo'}`}: ${item.title}` },
    el('span', { class: 'g-img' },
      el('img', { src: photos[0].src, alt: '', loading: 'lazy' }),
      photos[0].video ? el('span', { class: 'play' }) : null,
      photos.length > 1 ? el('span', { class: 'count', text: `${photos.length} photos` }) : null),
    el('span', { class: 'g-caption' }, el('small', { text: meta }), el('strong', { text: item.title })));
  tile.addEventListener('click', () => openLightbox(photos, item.title));
  return tile;
}

function renderGallery(root, items) {
  const filterBar = root.querySelector('[data-filters]');
  const wall = root.querySelector('[data-wall]');
  const albums = items.filter(item => photosOf(item).length);
  if (!albums.length) {
    wall.replaceChildren(el('p', { class: 'empty-note', text: 'Photos will appear here soon.' }));
    return;
  }
  const counts = {};
  albums.forEach(item => { const g = groupOf(item).id; counts[g] = (counts[g] || 0) + 1; });
  const draw = id => {
    const shown = id === 'all' ? albums : albums.filter(item => groupOf(item).id === id);
    wall.replaceChildren(...shown.map(galleryTile));
    filterBar.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.type === id)));
  };
  const button = (id, label, count) => {
    const b = el('button', { type: 'button', 'data-type': id, 'aria-pressed': 'false' }, label, el('small', { text: String(count) }));
    b.addEventListener('click', () => { draw(id); history.replaceState(null, '', id === 'all' ? location.pathname : `#${id}`); });
    return b;
  };
  filterBar.replaceChildren(button('all', 'All', albums.length),
    ...GALLERY_GROUPS.filter(group => counts[group.id]).map(group => button(group.id, group.label, counts[group.id])));
  const hash = location.hash.slice(1);
  draw(counts[hash] ? hash : 'all');
}

// Home page: the newest few gallery tiles.
function renderGalleryStrip(root, items) {
  const section = root.closest('section');
  const albums = items.filter(item => photosOf(item).length).slice(0, Number(root.dataset.limit) || 4);
  if (!albums.length) { if (section) section.hidden = true; return; }
  root.replaceChildren(...albums.map(galleryTile));
  if (section) section.hidden = false;
}

// ---------- Photo stories on the Research page ----------
// <div data-project-media="coastal"> shows every photo of updates whose "project" is "coastal".
function renderProjectStory(root, items) {
  const id = root.dataset.projectMedia;
  const mine = items.filter(item => item.project === id)
    .sort((a, b) => (a.type === 'figure' ? 0 : 1) - (b.type === 'figure' ? 0 : 1));
  const photos = mine.flatMap(photosOf).filter(photo => !photo.video);
  if (!photos.length) { root.remove(); return; }
  const title = root.dataset.title || '';
  const open = index => openLightbox(photos, title, index);
  const lead = el('button', { class: 'story-lead', type: 'button', 'aria-label': `Enlarge: ${photos[0].caption}` },
    el('img', { src: photos[0].src, alt: photos[0].caption, loading: 'lazy' }), el('span', { class: 'zoom-chip', text: 'Click to enlarge' }));
  lead.addEventListener('click', () => open(0));
  const rest = photos.slice(1);
  const visible = rest.slice(0, 4);
  const thumbs = visible.map((photo, i) => {
    const extra = i === visible.length - 1 && rest.length > visible.length ? rest.length - visible.length : 0;
    const thumb = el('button', { class: 'story-thumb', type: 'button', 'aria-label': `Enlarge: ${photo.caption}` },
      el('img', { src: photo.src, alt: photo.caption, loading: 'lazy' }), extra ? el('span', { text: `+${extra}` }) : null);
    thumb.addEventListener('click', () => open(i + 1));
    return thumb;
  });
  root.replaceChildren(lead, thumbs.length ? el('div', { class: 'story-thumbs' }, thumbs) : null);
}

// ---------- Certificates & awards wall ----------
function renderAchievements(root, items) {
  const list = items.filter(item => item.type === 'certificate' || item.type === 'award');
  if (!list.length) { root.closest('section')?.setAttribute('hidden', ''); return; }
  root.replaceChildren(...list.map(item => {
    const photos = photosOf(item);
    const link = safeUrl(item.link) || safeUrl((item.files || [])[0]?.url);
    const frame = el('span', { class: `a-frame${photos.length ? '' : ' empty'}` },
      photos.length
        ? el('img', { src: photos[0].src, alt: '', loading: 'lazy' })
        : el('span', { class: 'a-seal', 'aria-hidden': 'true' }, el('b', { text: item.type === 'award' ? '★' : '✓' })));
    const body = el('span', { class: 'a-body' },
      el('small', { text: [TYPES[item.type], formatDate(item.date)].filter(Boolean).join(' · ') }),
      el('strong', { text: item.title }),
      item.place ? el('span', { text: item.place }) : null);
    let card;
    if (photos.length) {
      card = el('button', { class: 'a-card', type: 'button', 'data-type': item.type, 'aria-label': `View certificate: ${item.title}` }, frame, body);
      card.addEventListener('click', () => openLightbox(photos, item.title));
    } else if (link) {
      card = el('a', { class: 'a-card', href: link, target: '_blank', rel: 'noopener', 'data-type': item.type }, frame, body);
    } else {
      card = el('div', { class: 'a-card', 'data-type': item.type }, frame, body);
    }
    return card;
  }));
}

// ---------- Load content ----------
const highlights = document.querySelector('[data-highlights]');
const news = document.querySelector('[data-news]');
const figures = document.querySelector('[data-figures]');
const videos = document.querySelector('[data-videos]');
const gallery = document.querySelector('[data-gallery]');
const galleryStrip = document.querySelector('[data-gallery-strip]');
const stories = document.querySelectorAll('[data-project-media]');
const achievements = document.querySelector('[data-achievements]');
if (highlights || news || figures || videos || gallery || galleryStrip || stories.length || achievements) {
  loadJson('data/updates.json').then(items => {
    const list = (Array.isArray(items) ? items : []).filter(item => item && item.title).sort(byNewest);
    if (highlights) renderHighlights(highlights, list);
    if (news) renderNews(news, list);
    if (figures) renderStrip(figures, list.filter(item => item.type === 'figure'), {});
    if (videos) renderStrip(videos, list.filter(item => youtubeId(item.link)), { preferVideo: true });
    if (gallery) renderGallery(gallery, list);
    if (galleryStrip) renderGalleryStrip(galleryStrip, list);
    stories.forEach(root => renderProjectStory(root, list));
    if (achievements) renderAchievements(achievements, list);
  }).catch(() => {
    const note = el('p', { class: 'empty-note', text: 'Updates could not be loaded. Please refresh the page.' });
    (highlights?.querySelector('[data-grid]') || gallery?.querySelector('[data-wall]') || news || achievements)?.replaceChildren(note);
  });
}

const pubList = document.querySelector('[data-pubs]');
const pubCounts = document.querySelectorAll('[data-pub-count]');
if (pubList || pubCounts.length) {
  loadJson('data/publications.json').then(items => {
    const list = (Array.isArray(items) ? items : []).filter(item => item && item.title);
    pubCounts.forEach(node => { node.textContent = String(list.length); });
    if (pubList) renderPublications(pubList, list);
  }).catch(() => {
    pubList?.replaceChildren(el('p', { class: 'empty-note', text: 'The publication list could not be loaded. Please refresh the page.' }));
  });
}
