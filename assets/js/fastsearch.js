import * as params from '@params';

const resList = document.getElementById('searchResults');
const sInput = document.getElementById('searchInput');
const searchBox = document.getElementById('searchbox');

let fuse;
let currentElement = null;
let firstResult = null;
let lastResult = null;

const defaultFuseOptions = {
    distance: 100,
    threshold: 0.4,
    ignoreLocation: true,
    keys: ['title', 'permalink', 'summary', 'content']
};

const buildFuseOptions = () => {
    if (!params.fuseOpts) {
        return defaultFuseOptions;
    }

    return {
        isCaseSensitive: params.fuseOpts.iscasesensitive ?? false,
        includeScore: params.fuseOpts.includescore ?? false,
        includeMatches: params.fuseOpts.includematches ?? false,
        minMatchCharLength: params.fuseOpts.minmatchcharlength ?? 1,
        shouldSort: params.fuseOpts.shouldsort ?? true,
        findAllMatches: params.fuseOpts.findallmatches ?? false,
        keys: params.fuseOpts.keys ?? defaultFuseOptions.keys,
        location: params.fuseOpts.location ?? 0,
        threshold: params.fuseOpts.threshold ?? defaultFuseOptions.threshold,
        distance: params.fuseOpts.distance ?? defaultFuseOptions.distance,
        ignoreLocation: params.fuseOpts.ignorelocation ?? defaultFuseOptions.ignoreLocation
    };
};

const debounce = (fn, delay) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = window.setTimeout(() => fn(...args), delay);
    };
};

const reset = () => {
    currentElement = null;
    firstResult = null;
    lastResult = null;
    resList.innerHTML = '';
    sInput.value = '';
    sInput.focus();
};

const setActiveResult = (element) => {
    document.querySelectorAll('.focus').forEach((item) => item.classList.remove('focus'));

    if (!element) {
        return;
    }

    element.focus();
    element.parentElement?.classList.add('focus');
    currentElement = element;
};

const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getQueryTerms = (query) => normalizeText(query)
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

const getMatch = (result, key) => {
    if (!Array.isArray(result.matches)) {
        return null;
    }

    return result.matches.find((match) => match.key === key && match.value);
};

const trimSnippetWindow = (text, start, end, radius = 95) => {
    const left = Math.max(0, start - radius);
    const right = Math.min(text.length, end + radius);
    let windowStart = left;
    let windowEnd = right;

    if (windowStart > 0) {
        const nextSpace = text.indexOf(' ', windowStart);
        if (nextSpace > windowStart && nextSpace - windowStart < 28) {
            windowStart = nextSpace + 1;
        }
    }

    if (windowEnd < text.length) {
        const prevSpace = text.lastIndexOf(' ', windowEnd);
        if (prevSpace > windowStart && windowEnd - prevSpace < 28) {
            windowEnd = prevSpace;
        }
    }

    return {
        end: windowEnd,
        prefix: windowStart > 0 ? '...' : '',
        start: windowStart,
        suffix: windowEnd < text.length ? '...' : ''
    };
};

const mergeRanges = (ranges) => {
    const sorted = ranges
        .filter(([start, end]) => end > start)
        .sort(([a], [b]) => a - b);

    const merged = [];
    for (const [start, end] of sorted) {
        const previous = merged[merged.length - 1];
        if (previous && start <= previous[1]) {
            previous[1] = Math.max(previous[1], end);
        } else {
            merged.push([start, end]);
        }
    }

    return merged;
};

const snippetTextFromMatch = (match) => {
    if (!match || !match.value) {
        return '';
    }

    const value = String(match.value);
    const indices = Array.isArray(match.indices) && match.indices.length
        ? match.indices
        : [[0, Math.min(value.length - 1, 0)]];
    const [firstStart, firstEnd] = indices[0];
    const window = trimSnippetWindow(value, firstStart, firstEnd + 1);

    return normalizeText(window.prefix + value.slice(window.start, window.end) + window.suffix);
};

const highlightQueryTerms = (text, query) => {
    const terms = getQueryTerms(query);
    if (!text || !terms.length) {
        return text ? [{ text, match: false }] : [];
    }

    const flags = params.fuseOpts?.iscasesensitive ? 'g' : 'gi';
    const pattern = new RegExp(terms.map(escapeRegExp).join('|'), flags);
    const ranges = [];
    let match;

    while ((match = pattern.exec(text)) !== null) {
        ranges.push([match.index, match.index + match[0].length]);

        if (match[0].length === 0) {
            pattern.lastIndex += 1;
        }
    }

    const merged = mergeRanges(ranges);
    const parts = [];
    let cursor = 0;

    for (const [start, end] of merged) {
        if (start > cursor) {
            parts.push({ text: text.slice(cursor, start), match: false });
        }
        parts.push({ text: text.slice(start, end), match: true });
        cursor = end;
    }

    if (cursor < text.length) {
        parts.push({ text: text.slice(cursor), match: false });
    }

    return parts.filter((part) => part.text);
};

const buildSnippet = (result, query) => {
    const contentSnippet = snippetTextFromMatch(getMatch(result, 'content'));
    if (contentSnippet) {
        return highlightQueryTerms(contentSnippet, query);
    }

    const summarySnippet = snippetTextFromMatch(getMatch(result, 'summary'));
    if (summarySnippet) {
        return highlightQueryTerms(summarySnippet, query);
    }

    const fallback = normalizeText(result.item.summary || result.item.content);
    if (!fallback) {
        return [];
    }

    const text = fallback.length > 190 ? fallback.slice(0, 187).trimEnd() + '...' : fallback;
    return highlightQueryTerms(text, query);
};

const appendSnippetParts = (element, parts) => {
    for (const part of parts) {
        if (!part.match) {
            element.appendChild(document.createTextNode(part.text));
            continue;
        }

        const mark = document.createElement('mark');
        mark.className = 'search-result-match';
        mark.textContent = part.text;
        element.appendChild(mark);
    }
};

const renderResults = (results, query = '') => {
    if (!Array.isArray(results) || results.length === 0) {
        resList.innerHTML = '';
        firstResult = lastResult = currentElement = null;
        return;
    }

    const fragment = document.createDocumentFragment();

    for (const result of results) {
        const li = document.createElement('li');
        const text = document.createElement('span');
        text.className = 'search-result-text';

        const title = document.createElement('span');
        title.className = 'mtm-search-result-label';
        title.textContent = result.item.title;

        const snippet = buildSnippet(result, query);
        text.appendChild(title);

        if (snippet.length) {
            const snippetElement = document.createElement('span');
            snippetElement.className = 'search-result-snippet';
            appendSnippetParts(snippetElement, snippet);
            text.appendChild(snippetElement);
        }

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '24');
        svg.setAttribute('height', '24');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.classList.add('feather', 'feather-chevrons-right');

        svg.innerHTML = '<polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline>';

        const link = document.createElement('a');
        link.className = 'entry-link';
        link.href = result.item.permalink;
        link.setAttribute('aria-label', result.item.title);

        li.appendChild(text);
        li.appendChild(svg);
        li.appendChild(link);
        fragment.appendChild(li);
    }

    resList.innerHTML = '';
    resList.appendChild(fragment);
    firstResult = resList.firstElementChild;
    lastResult = resList.lastElementChild;
};

const performSearch = () => {
    if (!fuse) {
        return;
    }

    const query = sInput.value.trim();
    if (!query) {
        renderResults([]);
        return;
    }

    const searchOptions = params.fuseOpts?.limit ? { limit: params.fuseOpts.limit } : undefined;
    const results = searchOptions ? fuse.search(query, searchOptions) : fuse.search(query);
    renderResults(results, query);
};

const initSearch = async () => {
    if (!sInput || !resList) {
        return;
    }

    sInput.disabled = false;
    sInput.focus();

    try {
        const response = await fetch('../index.json');
        if (!response.ok) {
            throw new Error(`Search index load failed: ${response.status}`);
        }

        const data = await response.json();
        if (data) {
            fuse = new Fuse(data, buildFuseOptions());
        }
    } catch (error) {
        console.error(error);
    }
};

window.addEventListener('load', initSearch);

sInput?.addEventListener('input', debounce(performSearch, 150));

sInput?.addEventListener('search', () => {
    if (!sInput.value) {
        reset();
    }
});

document.addEventListener('keydown', (event) => {
    const { key } = event;
    const active = document.activeElement;
    const isInSearchBox = searchBox?.contains(active);

    if (key === 'Escape') {
        reset();
        return;
    }

    if (!firstResult || !isInSearchBox) {
        return;
    }

    if (key === 'ArrowDown') {
        event.preventDefault();

        if (active === sInput) {
            setActiveResult(firstResult.querySelector('.entry-link'));
        } else if (active?.parentElement !== lastResult) {
            setActiveResult(active?.parentElement?.nextElementSibling?.querySelector('.entry-link'));
        }
    } else if (key === 'ArrowUp') {
        event.preventDefault();

        if (active?.parentElement === firstResult) {
            setActiveResult(sInput);
        } else if (active !== sInput) {
            setActiveResult(active?.parentElement?.previousElementSibling?.querySelector('.entry-link'));
        }
    } else if (key === 'ArrowRight') {
        if (active?.matches?.('.entry-link')) {
            active.click();
        }
    }
});
