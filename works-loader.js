(() => {
    const WORKS_SOURCE = 'works.md';
    const LARGE_BREAKPOINT = 2200;
    const SMALL_PAGE_SIZE = 4;
    const LARGE_PAGE_SIZE = 6;
    const MAGAZINE_SIZE = 2;
    const YOUTUBE_EMBED_BASE = 'https://www.youtube.com/embed/';

    const state = {
        entries: [],
        currentPage: 1,
        itemsPerPage: SMALL_PAGE_SIZE,
    };

    let filmsContainer;
    let paginationContainer;
    let resizeTimer;

    document.addEventListener('DOMContentLoaded', () => {
        filmsContainer = document.getElementById('films');
        paginationContainer = document.getElementById('films-pagination');

        if (!filmsContainer) {
            return;
        }

        state.itemsPerPage = getItemsPerPage();
        loadWorks();
        window.addEventListener('resize', handleResize);
    });

    function getItemsPerPage() {
        return window.innerWidth >= LARGE_BREAKPOINT ? LARGE_PAGE_SIZE : SMALL_PAGE_SIZE;
    }

    function handleResize() {
        clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
            const next = getItemsPerPage();
            if (next !== state.itemsPerPage) {
                state.itemsPerPage = next;
                state.currentPage = 1;
            }
            if (!state.entries.length) {
                return;
            }
            render();
        }, 150);
    }

    async function loadWorks() {
        try {
            const response = await fetch(WORKS_SOURCE, { cache: 'no-cache' });
            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }
            const text = await response.text();
            state.entries = parseWorks(text);
            if (!state.entries.length) {
                renderEmpty();
                return;
            }
            render();
        } catch (error) {
            console.error('Failed to load works.', error);
            renderEmpty();
        }
    }

    function parseWorks(content = '') {
        const lines = content.split(/\r?\n/);
        const entries = [];
        const buffer = [];

        const pushBuffer = () => {
            if (buffer.length === 4) {
                const entry = buildEntry(buffer);
                if (entry) {
                    entries.push(entry);
                }
            }
            buffer.length = 0;
        };

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) {
                pushBuffer();
                continue;
            }
            if (line.startsWith('#')) {
                continue;
            }
            buffer.push(line);
            if (buffer.length === 4) {
                pushBuffer();
            }
        }
        pushBuffer();
        return entries;
    }

    function buildEntry([numberTitle, clientLine, thumbnailLine, urlLine]) {
        const { number, title } = parseNumberAndTitle(numberTitle);
        const client = (clientLine || '').trim();
        const youtubeId = extractYouTubeId(urlLine);

        if (!title || !client || !youtubeId) {
            return null;
        }

        return {
            number,
            title,
            client,
            thumbnail: buildThumbnailPath(thumbnailLine),
            youtubeId,
        };
    }

    function parseNumberAndTitle(source = '') {
        const trimmed = source.trim();
        const match = trimmed.match(/^(\d+)\s+(.*)$/);
        if (!match) {
            return { number: '', title: trimmed };
        }
        return { number: match[1], title: match[2].trim() };
    }

    function buildThumbnailPath(value = '') {
        const sanitized = value.trim().replace(/^assets\//i, '');
        const parts = sanitized.split(/[\\/]/);
        const filename = parts.pop() || '';
        return filename ? `assets/${filename}` : '';
    }

    function extractYouTubeId(url = '') {
        const trimmed = url.trim();
        if (!trimmed) {
            return '';
        }

        try {
            const parsed = new URL(trimmed);
            const hostname = parsed.hostname.replace(/^www\./i, '');
            if (hostname === 'youtu.be') {
                return parsed.pathname.replace('/', '');
            }
            if (hostname.includes('youtube')) {
                const fromParam = parsed.searchParams.get('v');
                if (fromParam) {
                    return fromParam;
                }
                const segments = parsed.pathname.split('/').filter(Boolean);
                return segments.pop() || '';
            }
        } catch (error) {
            // ignored: fall back to regex
        }

        const fallbackMatch = trimmed.match(/(?:v=|be\/)([a-zA-Z0-9_-]{6,})/);
        return fallbackMatch ? fallbackMatch[1] : '';
    }

    function render() {
        if (!filmsContainer) {
            return;
        }
        const totalPages = Math.max(1, Math.ceil(state.entries.length / state.itemsPerPage));
        if (state.currentPage > totalPages) {
            state.currentPage = totalPages;
        }
        renderFilms();
        renderPagination(totalPages);
    }

    function renderFilms() {
        filmsContainer.textContent = '';
        const startIndex = (state.currentPage - 1) * state.itemsPerPage;
        const items = state.entries.slice(startIndex, startIndex + state.itemsPerPage);

        if (!items.length) {
            renderEmpty();
            return;
        }

        setGridColumns(calculateColumns(items.length));

        let magazine = null;
        items.forEach((entry, index) => {
            if (index % MAGAZINE_SIZE === 0) {
                magazine = document.createElement('div');
                magazine.className = 'magazine';
                filmsContainer.appendChild(magazine);
            }
            magazine.appendChild(createFilm(entry));
        });
    }

    function renderPagination(totalPages) {
        if (!paginationContainer) {
            return;
        }

        paginationContainer.textContent = '';

        if (totalPages <= 1) {
            paginationContainer.classList.add('hidden');
            return;
        }

        paginationContainer.classList.remove('hidden');

        for (let page = 1; page <= totalPages; page += 1) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = page.toString();
            if (page === state.currentPage) {
                button.classList.add('active');
            }
            button.addEventListener('click', () => {
                if (page === state.currentPage) {
                    return;
                }
                state.currentPage = page;
                render();
                filmsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            paginationContainer.appendChild(button);
        }
    }

    function renderEmpty() {
        if (!filmsContainer) {
            return;
        }
        setGridColumns(1);
        filmsContainer.textContent = '';
        const message = document.createElement('p');
        message.className = 'films-empty';
        message.textContent = 'Works will be published soon.';
        filmsContainer.appendChild(message);
        if (paginationContainer) {
            paginationContainer.classList.add('hidden');
        }
    }

    function calculateColumns(itemCount) {
        if (!itemCount) {
            return 1;
        }

        const width = window.innerWidth;
        if (width < 1200) {
            return 1;
        }

        if (width < 2200) {
            return Math.min(2, Math.max(1, itemCount));
        }

        const preferred = 3;
        if (itemCount < preferred) {
            return Math.min(2, Math.max(1, itemCount));
        }

        if (itemCount % preferred === 1) {
            return 2;
        }

        return preferred;
    }

    function setGridColumns(columnCount) {
        if (!filmsContainer) {
            return;
        }
        filmsContainer.style.setProperty('--film-columns', String(columnCount));
    }

    function createFilm(entry) {
        const film = document.createElement('div');
        film.className = 'film';
        film.dataset.video = `${YOUTUBE_EMBED_BASE}${entry.youtubeId}`;
        film.dataset.number = entry.number;
        film.appendChild(buildTitleNode(entry.title));
        film.appendChild(buildClientNode(entry.client));
        film.appendChild(buildImageNode(entry));
        film.addEventListener('click', () => handleFilmClick(film.dataset.video));
        return film;
    }

    function buildTitleNode(title) {
        const li = document.createElement('li');
        const span = document.createElement('span');
        span.className = 't1';
        appendTitle(span, title);
        li.appendChild(span);
        return li;
    }

    function buildClientNode(client) {
        const li = document.createElement('li');
        const span = document.createElement('span');
        span.className = 't2';
        span.textContent = client;
        li.appendChild(span);
        return li;
    }

    function buildImageNode(entry) {
        const img = document.createElement('img');
        img.className = 'filmCover';
        img.src = entry.thumbnail;
        img.alt = entry.title;
        img.loading = 'lazy';
        return img;
    }

    function appendTitle(container, title) {
        if (!title.includes('|')) {
            const strong = document.createElement('strong');
            strong.textContent = title.trim();
            container.appendChild(strong);
            return;
        }

        const [primary, ...restParts] = title.split('|');
        const strong = document.createElement('strong');
        strong.textContent = primary.trim();
        container.appendChild(strong);
        container.appendChild(document.createTextNode(` | ${restParts.join('|').trim()}`));
    }

    function handleFilmClick(embedUrl = '') {
        if (!embedUrl) {
            return;
        }

        if (typeof window.openVideo === 'function') {
            window.openVideo(embedUrl);
            return;
        }

        const iframe = document.getElementById('player');
        const videoSection = document.getElementById('video');
        if (iframe) {
            const autoplayUrl = embedUrl.includes('autoplay=1')
                ? embedUrl
                : `${embedUrl}${embedUrl.includes('?') ? '&' : '?'}autoplay=1`;
            iframe.src = autoplayUrl;
        }
        if (videoSection) {
            videoSection.classList.add('opened');
            videoSection.setAttribute('aria-hidden', 'false');
        }
    }
})();
