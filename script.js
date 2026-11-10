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
let lightbox;
function openLightbox(images, title, start = 0) {
  if (!lightbox) {
    const img = el('img', { alt: '' });
    const caption = el('span');
    const prev = el('button', { type: 'button', text: '← Previous' });
    const next = el('button', { type: 'button', text: 'Next →' });
    const close = el('button', { type: 'button', text: 'Close' });
    lightbox = el('dialog', { class: 'lightbox', 'aria-label': 'Photo viewer' },
      el('figure', {}, img, el('figcaption', {}, caption, el('div', { class: 'lb-buttons' }, prev, next, close))));
    document.body.append(lightbox);
    const show = step => {
      lightbox.index = (lightbox.index + step + lightbox.images.length) % lightbox.images.length;
      img.src = lightbox.images[lightbox.index];
      img.alt = lightbox.title;
      caption.textContent = lightbox.images.length > 1
        ? `${lightbox.title} (${lightbox.index + 1} of ${lightbox.images.length})` : lightbox.title;
      prev.hidden = next.hidden = lightbox.images.length < 2;
    };
    lightbox.show_ = show;
    prev.addEventListener('click', () => show(-1));
    next.addEventListener('click', () => show(1));
    close.addEventListener('click', () => lightbox.close());
    lightbox.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });
    lightbox.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft') show(-1);
      if (event.key === 'ArrowRight') show(1);
    });
  }
  lightbox.images = images;
  lightbox.title = title;
  lightbox.index = start;
  lightbox.show_(0);
  lightbox.showModal();
}

// ---------- Highlights ----------
function updateCard(item) {
  const images = (item.images || []).map(safeUrl).filter(Boolean);
  const link = safeUrl(item.link);
  const video = youtubeId(link);
  const typeLabel = TYPES[item.type] || 'News';
  let media = null;

  if (images.length) {
    media = el('button', {
      class: `update-media${item.type === 'certificate' ? ' contain' : ''}`, type: 'button',
      'aria-label': `View ${images.length > 1 ? images.length + ' photos' : 'photo'}: ${item.title}`
    },
      el('img', { src: images[0], alt: item.title, loading: 'lazy' }),
      images.length > 1 ? el('span', { class: 'count', text: `${images.length} photos` }) : null);
    media.addEventListener('click', () => openLightbox(images, item.title));
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

  return el('article', { class: 'update-card', id: item.id, 'data-type': item.type },
    media,
    el('div', { class: 'update-body' },
      el('div', { class: 'update-meta' },
        el('span', { class: 'badge', 'data-type': item.type, text: typeLabel }),
        el('time', { datetime: item.date, text: formatDate(item.date) })),
      el('h3', { text: item.title }),
      item.place ? el('p', { class: 'update-place', text: item.place }) : null,
      item.summary ? el('p', { class: 'update-summary', text: item.summary }) : null,
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
  root.replaceChildren(...items.slice(0, limit).map(item => {
    const image = safeUrl((item.images || [])[0]);
    return el('a', { class: 'news-item', href: `highlights.html#${encodeURIComponent(item.id)}` },
      el('time', { datetime: item.date, text: formatDate(item.date) }),
      el('div', {},
        el('span', { class: 'badge', 'data-type': item.type, text: TYPES[item.type] || 'News' }),
        el('h3', { text: item.title })),
      image ? el('img', { src: image, alt: '', loading: 'lazy' }) : null);
  }));
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

// ---------- Load content ----------
const highlights = document.querySelector('[data-highlights]');
const news = document.querySelector('[data-news]');
if (highlights || news) {
  loadJson('data/updates.json').then(items => {
    const list = (Array.isArray(items) ? items : []).filter(item => item && item.title).sort(byNewest);
    if (highlights) renderHighlights(highlights, list);
    if (news) renderNews(news, list);
  }).catch(() => {
    const note = el('p', { class: 'empty-note', text: 'Updates could not be loaded. Please refresh the page.' });
    (highlights?.querySelector('[data-grid]') || news).replaceChildren(note);
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
