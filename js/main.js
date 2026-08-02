// ==================== GALLERY9704 Main Logic ====================

const STORAGE_KEY = 'gallery9704-maintenance';
const STATIC_EXPORT = window.GALLERY9704_STATIC_EXPORT === true;
const UNCATEGORIZED_THEME_VALUE = '__uncategorized__';
const INITIAL_RENDER_COUNT = 24;
const RENDER_BATCH_SIZE = 24;
const DATASETS = {
    station: {
        label: '站姐',
        data: typeof galleryData !== 'undefined' ? galleryData : [],
        facets: typeof galleryFacets !== 'undefined' ? galleryFacets : {},
        maintenanceEnabled: true
    },
    official: {
        label: '官方',
        data: typeof officialGalleryData !== 'undefined' ? officialGalleryData : [],
        facets: typeof officialGalleryFacets !== 'undefined' ? officialGalleryFacets : {},
        maintenanceEnabled: true
    }
};
const THEME_TIMELINE = [
    ['横店见面会', '2025-08-05'],
    ['双人机场', '2025-08-15'],
    ['泰国微博文化交流之夜', '2025-08-16'],
    ['泰国双人见面会', '2025-08-17'],
    ['清明上河园见面会', '2025-09-07'],
    ['澳门双人见面会', '2025-09-13'],
    ['微博奇遇记', '2025-09-14'],
    ['FantasticMan活动', '2025-09-22'],
    ['巴黎时装周·25秋', '2025-10-01'],
    ['南京咪豆音乐节', '2025-10-02'],
    ['宝鸡银杏音乐节', '2025-10-04'],
    ['襄阳国潮音乐节', '2025-10-08'],
    ['扬州枣林湾音乐节', '2025-10-18'],
    ['25珑骧活动', '2025-10-28'],
    ['赣州Z纪元巅峰音乐节', '2025-11-15'],
    ['新加坡微博文化交流之夜', '2025-11-16'],
    ['代言人影响力盛典红毯', '2025-11-29'],
    ['T风格论坛', '2025-12-05'],
    ['周日下午3点见生日音乐会', '2026-01-11'],
    ['LOEWE罗意威活动', '2026-01-21'],
    ['深圳奇梦岛开业', '2026-02-01'],
    ['巴黎时装周·26春', '2026-03-02'],
    ['巴黎世家活动', '2026-03-27'],
    ['何日君再来', '2026-03-28'],
    ['QQ音乐巅峰之夜', '2026-03-28'],
    ['MaisonMargiela看秀', '2026-04-01'],
    ['MaisonMargiela晚宴', '2026-04-02'],
    ['26珑骧活动', '2026-04-23'],
    ['澳门WIEA国际娱乐盛典', '2026-04-26'],
    ['同心结', '2026-06-14'],
    ['米兰巴黎时装周·26夏', '2026-06-20'],
    ['搜狐扫楼', '2026-07-03'],
    ['巴黎高定周·26夏', '2026-07-04']
];
const THEME_SORT_META = new Map(THEME_TIMELINE.map(([theme, date], index) => [theme, { date, index }]));

const state = {
    dataType: 'official',
    filterVisible: false,
    mode: 'browse',
    currentFilters: { keyword: '', theme: '', author: '', shootDateFrom: '', shootDateTo: '', postDateFrom: '', postDateTo: '' },
    maintenance: { records: {}, deletedIds: [] },
    selectedIds: new Set(),
    filteredData: [],
    renderLimit: INITIAL_RENDER_COUNT,
    loadMoreObserver: null,
    modalOpen: false,
    modalSeriesIndex: 0,
    modalImageIndex: 0,
    dirty: false
};

const els = {
    nav: document.querySelector('.nav'),
    sidebar: document.getElementById('sidebar'),
    navToggle: document.getElementById('navToggle'),
    stationTab: document.getElementById('stationTab'),
    officialTab: document.getElementById('officialTab'),
    sidebarClose: document.getElementById('sidebarClose'),
    resultCount: document.getElementById('resultCount'),
    browseModeBtn: document.getElementById('browseModeBtn'),
    maintainModeBtn: document.getElementById('maintainModeBtn'),
    selectVisible: document.getElementById('selectVisible'),
    clearSelection: document.getElementById('clearSelection'),
    deleteSelected: document.getElementById('deleteSelected'),
    selectedState: document.getElementById('selectedState'),
    saveMaintenance: document.getElementById('saveMaintenance'),
    exportMaintenance: document.getElementById('exportMaintenance'),
    exportStatic: document.getElementById('exportStatic'),
    dirtyState: document.getElementById('dirtyState'),
    seriesList: document.getElementById('seriesList'),
    emptyState: document.getElementById('emptyState'),
    keywordSearch: document.getElementById('keywordSearch'),
    themeFilterGroup: document.getElementById('themeFilterGroup'),
    themeFilter: document.getElementById('themeFilter'),
    authorFilter: document.getElementById('authorFilter'),
    shootDateFilterGroup: document.getElementById('shootDateFilterGroup'),
    shootDateFrom: document.getElementById('shootDateFrom'),
    shootDateTo: document.getElementById('shootDateTo'),
    postDateFrom: document.getElementById('postDateFrom'),
    postDateTo: document.getElementById('postDateTo'),
    applyFilters: document.getElementById('applyFilters'),
    resetFilters: document.getElementById('resetFilters'),
    imageModal: document.getElementById('imageModal'),
    modalClose: document.getElementById('modalClose'),
    modalPrev: document.getElementById('modalPrev'),
    modalNext: document.getElementById('modalNext'),
    modalImage: document.getElementById('modalImage'),
    modalTitle: document.getElementById('modalTitle'),
    modalDescription: document.getElementById('modalDescription')
};

document.addEventListener('DOMContentLoaded', () => {
    loadMaintenance();
    document.body.dataset.staticExport = STATIC_EXPORT ? 'true' : 'false';
    document.body.dataset.dataType = state.dataType;
    document.body.dataset.filterVisible = state.filterVisible ? 'true' : 'false';
    initFacets();
    initListeners();
    initDateInputs();
    updateMode('browse');
});

function getActiveDataset() {
    return DATASETS[state.dataType] || DATASETS.station;
}

function getActiveData() {
    return getActiveDataset().data || [];
}

function getActiveFacets() {
    return getActiveDataset().facets || {};
}

function isMaintenanceEnabled() {
    return getActiveDataset().maintenanceEnabled && !STATIC_EXPORT;
}

function initFacets() {
    refreshFacets();
}

function refreshFacets() {
    const currentTheme = els.themeFilter.value;
    const currentAuthor = els.authorFilter.value;
    const activeFacets = getActiveFacets();
    const visibleRecords = getActiveData().filter((series) => !isDeleted(series)).map(getDisplaySeries);
    optionize(els.themeFilter, sortedThemes([...(activeFacets.themes || []), ...visibleRecords.map((series) => series.theme)]), '全部主题');
    optionize(els.authorFilter, sortedStrings([...(activeFacets.authors || []), ...visibleRecords.map((series) => series.author)]), '全部账号');
    els.themeFilter.value = Array.from(els.themeFilter.options).some((option) => option.value === currentTheme) ? currentTheme : '';
    els.authorFilter.value = Array.from(els.authorFilter.options).some((option) => option.value === currentAuthor) ? currentAuthor : '';
    updateFilterVisibility();
}

function optionize(select, values, placeholder) {
    select.textContent = '';
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = placeholder;
    select.appendChild(empty);
    values.forEach((item) => {
        const value = typeof item === 'object' ? item.value : item;
        const label = typeof item === 'object' ? item.label : item;
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
    });
}

function uniqueSorted(values) {
    return sortedStrings(values);
}

function sortedStrings(values) {
    return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
}

function sortedThemes(values) {
    const hasUncategorized = values.some((value) => !value);
    const themes = Array.from(new Set(values.filter(Boolean))).sort((a, b) => {
        const metaA = THEME_SORT_META.get(a);
        const metaB = THEME_SORT_META.get(b);
        if (metaA && metaB) {
            const dateCompare = metaA.date.localeCompare(metaB.date);
            if (dateCompare !== 0) return dateCompare;
            return metaA.index - metaB.index;
        }
        if (metaA) return -1;
        if (metaB) return 1;
        return a.localeCompare(b, 'zh-Hans-CN');
    });
    if (hasUncategorized) {
        themes.push({ value: UNCATEGORIZED_THEME_VALUE, label: '未分类活动' });
    }
    return themes;
}

function initListeners() {
    els.navToggle.addEventListener('click', toggleFilterPanel);
    els.stationTab.addEventListener('click', () => updateDataType('station'));
    els.officialTab.addEventListener('click', () => updateDataType('official'));
    els.sidebarClose.addEventListener('click', toggleFilterPanel);
    els.browseModeBtn.addEventListener('click', () => updateMode('browse'));
    els.maintainModeBtn.addEventListener('click', () => updateMode('maintain'));
    els.selectVisible.addEventListener('click', selectVisibleRecords);
    els.clearSelection.addEventListener('click', clearSelection);
    els.deleteSelected.addEventListener('click', deleteSelectedRecords);
    els.saveMaintenance.addEventListener('click', saveMaintenance);
    els.exportMaintenance.addEventListener('click', exportMaintenance);
    els.exportStatic.addEventListener('click', exportStaticBrowse);
    els.applyFilters.addEventListener('click', () => applyFilterAndRender({ scrollTop: true }));
    els.resetFilters.addEventListener('click', resetAndRender);
    els.keywordSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') applyFilterAndRender({ scrollTop: true });
    });

    els.modalClose.addEventListener('click', closeModal);
    els.modalPrev.addEventListener('click', () => navigateModal(-1));
    els.modalNext.addEventListener('click', () => navigateModal(1));
    els.imageModal.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-backdrop')) closeModal();
    });
    document.addEventListener('click', handleOutsideFilterClick);
    document.addEventListener('keydown', handleKeyPress);
}

function handleOutsideFilterClick(event) {
    if (!state.filterVisible) return;
    if (els.sidebar.contains(event.target)) return;
    if (els.navToggle.contains(event.target)) return;
    setFilterPanelVisible(false);
}

function initDateInputs() {
    [els.shootDateFrom, els.shootDateTo, els.postDateFrom, els.postDateTo].forEach((input) => {
        if (!input) return;
        const field = input.closest('.date-field');
        const syncValueState = () => field?.classList.toggle('has-value', Boolean(input.value));

        input.addEventListener('keydown', (event) => {
            if (event.key !== 'Tab') event.preventDefault();
        });
        input.addEventListener('beforeinput', (event) => event.preventDefault());
        input.addEventListener('paste', (event) => event.preventDefault());
        input.addEventListener('drop', (event) => event.preventDefault());
        input.addEventListener('input', syncValueState);
        input.addEventListener('change', syncValueState);

        field?.addEventListener('click', () => {
            input.focus({ preventScroll: true });
            if (typeof input.showPicker === 'function') input.showPicker();
        });
        syncValueState();
    });
}

function updateDateFieldStates() {
    document.querySelectorAll('.date-field').forEach((field) => {
        const input = field.querySelector('input[type="date"]');
        field.classList.toggle('has-value', Boolean(input?.value));
    });
}

function toggleFilterPanel() {
    setFilterPanelVisible(!state.filterVisible);
}

function setFilterPanelVisible(visible) {
    state.filterVisible = visible;
    document.body.dataset.filterVisible = state.filterVisible ? 'true' : 'false';
    els.sidebar.classList.toggle('hidden', !state.filterVisible);
    els.navToggle.setAttribute('aria-pressed', state.filterVisible ? 'true' : 'false');
}

function updateDataType(dataType) {
    if (state.dataType === dataType) return;
    state.dataType = dataType;
    document.body.dataset.dataType = dataType;
    state.selectedIds.clear();
    if (!isMaintenanceEnabled()) state.mode = 'browse';
    els.stationTab.classList.toggle('active', dataType === 'station');
    els.officialTab.classList.toggle('active', dataType === 'official');
    els.stationTab.setAttribute('aria-selected', dataType === 'station' ? 'true' : 'false');
    els.officialTab.setAttribute('aria-selected', dataType === 'official' ? 'true' : 'false');
    resetFilters({ render: false });
    refreshFacets();
    updateMode(state.mode);
}

function updateMode(mode) {
    if (!isMaintenanceEnabled() && mode === 'maintain') return;
    if (!isMaintenanceEnabled()) mode = 'browse';
    state.mode = mode;
    document.body.dataset.mode = mode;
    els.browseModeBtn.classList.toggle('active', mode === 'browse');
    els.maintainModeBtn.classList.toggle('active', mode === 'maintain');
    els.maintainModeBtn.disabled = !isMaintenanceEnabled();
    applyFilterAndRender();
}

function loadMaintenance() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        state.maintenance = {
            records: saved.records && typeof saved.records === 'object' ? saved.records : {},
            deletedIds: Array.isArray(saved.deletedIds) ? saved.deletedIds : []
        };
    } catch {
        state.maintenance = { records: {}, deletedIds: [] };
    }
    markDirty(false);
}

function saveMaintenance() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...state.maintenance,
        updatedAt: new Date().toISOString()
    }));
    markDirty(false);
}

function exportMaintenance() {
    const payload = {
        exportedAt: new Date().toISOString(),
        note: '本文件用于备份或迁移本机浏览器里的维护数据，包含手动修改的主题、拍摄日期、标签、备注和删除卡片记录。',
        ...state.maintenance
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gallery9704-maintenance-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

async function exportStaticBrowse() {
    if (STATIC_EXPORT) return;
    try {
        const response = await fetch('/api/export-static', { method: 'POST' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `导出失败：${response.status}`);
        alert(`静态浏览版已导出：\n${payload.exportPath}`);
    } catch (error) {
        alert(error.message || '导出静态浏览版失败，请确认当前是通过 npm start 启动的服务端项目。');
    }
}

function markDirty(value) {
    state.dirty = value;
    if (!els.dirtyState) return;
    els.dirtyState.textContent = value ? '有未保存修改' : '已同步';
    els.dirtyState.classList.toggle('dirty', value);
}

function getRecordId(series) {
    return String(series.postUrl || series.id || series.label);
}

function isDeleted(series) {
    if (!isMaintenanceEnabled()) return false;
    return state.maintenance.deletedIds.includes(getRecordId(series));
}

function getDisplaySeries(series) {
    const patch = state.maintenance.records[getRecordId(series)] || {};
    const theme = Object.prototype.hasOwnProperty.call(patch, 'theme') ? patch.theme : (series.theme || '');
    const shootDate = patch.date || series.date || '';
    const tags = Array.isArray(patch.tags) ? patch.tags : (series.tags || []);
    return {
        ...series,
        title: theme,
        theme,
        date: shootDate,
        tags,
        status: patch.status || 'todo',
        note: patch.note || ''
    };
}

function getShootDateForFilter(series) {
    return normalizeIsoDate(getDisplaySeries(series).date);
}

function getPostDateForFilter(series) {
    return normalizeIsoDate(series.postDate);
}

function postSortValue(series) {
    const time = String(series.description || '').match(/\d{1,2}:\d{2}/)?.[0] || '00:00';
    return `${series.postDate || ''} ${time}`;
}

function compareByPostTimeDesc(a, b) {
    return postSortValue(b).localeCompare(postSortValue(a));
}

function normalizeIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '';
    const [, month, day] = value.match(/^\d{4}-(\d{2})-(\d{2})$/);
    if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) return '';
    return value;
}

function scrollToPageTop() {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
}

function applyFilterAndRender(options = {}) {
    state.currentFilters.keyword = els.keywordSearch.value.trim().toLowerCase();
    state.currentFilters.theme = els.themeFilter.value;
    state.currentFilters.author = els.authorFilter.value;
    state.currentFilters.shootDateFrom = els.shootDateFrom.value;
    state.currentFilters.shootDateTo = els.shootDateTo.value;
    state.currentFilters.postDateFrom = els.postDateFrom.value;
    state.currentFilters.postDateTo = els.postDateTo.value;
    state.renderLimit = INITIAL_RENDER_COUNT;

    state.filteredData = getActiveData()
        .filter((series) => !isDeleted(series))
        .filter((series) => {
            const displaySeries = getDisplaySeries(series);
            const searchable = [
                displaySeries.title,
                displaySeries.theme,
                displaySeries.author,
                displaySeries.description,
                displaySeries.text,
                displaySeries.note,
                ...(displaySeries.tags || [])
            ].join(' ').toLowerCase();
            if (state.currentFilters.keyword && !searchable.includes(state.currentFilters.keyword)) return false;
            if (state.dataType === 'station') {
                if (state.currentFilters.theme === UNCATEGORIZED_THEME_VALUE && displaySeries.theme) return false;
                if (state.currentFilters.theme && state.currentFilters.theme !== UNCATEGORIZED_THEME_VALUE && displaySeries.theme !== state.currentFilters.theme) return false;
            }
            if (state.currentFilters.author && displaySeries.author !== state.currentFilters.author) return false;
            const shootDate = getShootDateForFilter(series);
            if (state.currentFilters.shootDateFrom && (!shootDate || shootDate < state.currentFilters.shootDateFrom)) return false;
            if (state.currentFilters.shootDateTo && (!shootDate || shootDate > state.currentFilters.shootDateTo)) return false;
            const postDate = getPostDateForFilter(series);
            if (state.currentFilters.postDateFrom && (!postDate || postDate < state.currentFilters.postDateFrom)) return false;
            if (state.currentFilters.postDateTo && (!postDate || postDate > state.currentFilters.postDateTo)) return false;
            return true;
        })
        .map(getDisplaySeries)
        .sort(compareByPostTimeDesc);

    renderSeries();
    if (options.scrollTop) scrollToPageTop();
}

function resetAndRender() {
    resetFilters({ render: true });
}

function resetFilters({ render } = { render: true }) {
    els.keywordSearch.value = '';
    els.themeFilter.value = '';
    els.authorFilter.value = '';
    els.shootDateFrom.value = '';
    els.shootDateTo.value = '';
    els.postDateFrom.value = '';
    els.postDateTo.value = '';
    updateDateFieldStates();
    state.currentFilters = { keyword: '', theme: '', author: '', shootDateFrom: '', shootDateTo: '', postDateFrom: '', postDateTo: '' };
    if (render) applyFilterAndRender({ scrollTop: true });
}

function updateFilterVisibility() {
    const isOfficial = state.dataType === 'official';
    els.themeFilterGroup.classList.toggle('is-hidden', isOfficial);
    els.shootDateFilterGroup.classList.toggle('is-hidden', isOfficial);
    els.maintainModeBtn.disabled = !isMaintenanceEnabled();
}

function updateResultCount() {
    if (!els.resultCount) return;
    els.resultCount.textContent = `${state.filteredData.length} 条`;
}

function disconnectLoadMoreObserver() {
    if (!state.loadMoreObserver) return;
    state.loadMoreObserver.disconnect();
    state.loadMoreObserver = null;
}

function loadMoreSeries() {
    if (state.renderLimit >= state.filteredData.length) return;
    state.renderLimit = Math.min(state.renderLimit + RENDER_BATCH_SIZE, state.filteredData.length);
    renderSeries();
}

function observeLoadMore(target) {
    disconnectLoadMoreObserver();
    if (!target || state.renderLimit >= state.filteredData.length || !('IntersectionObserver' in window)) return;
    state.loadMoreObserver = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMoreSeries();
    }, { rootMargin: '900px 0px' });
    state.loadMoreObserver.observe(target);
}

function renderLoadMoreControl(container) {
    if (state.renderLimit >= state.filteredData.length) {
        disconnectLoadMoreObserver();
        return;
    }
    const control = document.createElement('button');
    control.className = 'load-more';
    control.type = 'button';
    control.textContent = `继续加载 ${Math.min(RENDER_BATCH_SIZE, state.filteredData.length - state.renderLimit)} 条`;
    control.addEventListener('click', loadMoreSeries);
    container.appendChild(control);
    observeLoadMore(control);
}

function renderSeries() {
    const container = els.seriesList;
    container.innerHTML = '';
    updateResultCount();
    disconnectLoadMoreObserver();

    if (state.filteredData.length === 0) {
        els.emptyState.style.display = 'flex';
        updateSelectionState();
        return;
    }

    els.emptyState.style.display = 'none';

    const visibleData = state.filteredData.slice(0, state.renderLimit);
    visibleData.forEach((series, seriesIndex) => {
        const article = document.createElement('article');
        article.className = 'series';
        article.dataset.id = getRecordId(series);

        const header = document.createElement('div');
        header.className = 'series-header';
        header.innerHTML = `
            <div class="series-meta">
                ${state.mode === 'maintain' ? `<label class="select-card"><input type="checkbox" data-select-card value="${escapeHtml(getRecordId(series))}" ${state.selectedIds.has(getRecordId(series)) ? 'checked' : ''}><span></span></label>` : ''}
                <div>
                    <div class="series-label">${escapeHtml(formatCardMeta(series))}</div>
                    ${state.dataType === 'station' && series.title ? `<h2 class="series-title">${escapeHtml(series.title)}</h2>` : ''}
                </div>
                <a class="weibo-link" href="${escapeHtml(series.postUrl)}" target="_blank" rel="noreferrer" aria-label="打开微博原文" title="打开微博原文">
                    <svg class="weibo-icon" width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M14.3 7.8c1.1.8 1.7 1.8 1.5 2.9-.4 2.3-3.7 3.9-7.4 3.6-3.7-.3-6.4-2.4-6-4.7.3-1.6 2.2-2.9 4.6-3.4"/>
                        <path d="M6.2 6.7c.8-1.4 2.2-2.2 3.4-1.8 1.2.4 1.7 1.8 1.2 3.3"/>
                        <path d="M7.1 9.7c-.1.8.7 1.5 1.8 1.6 1.1.1 2-.4 2.1-1.2.1-.8-.7-1.5-1.8-1.6-1.1-.1-2 .4-2.1 1.2Z"/>
                        <path d="M12.1 3.3c1.2.2 2.1 1 2.4 2.1"/>
                        <path d="M12.7 1.4c2.1.3 3.7 1.8 4.1 3.8"/>
                    </svg>
                </a>
            </div>
        `;
        article.appendChild(header);

        const grid = document.createElement('div');
        grid.className = `image-grid count-${Math.min(series.images.length, 3)}`;
        const spans = computeSpans(series.images.length);

        series.images.forEach((imgSrc, imgIndex) => {
            const gridItem = document.createElement('div');
            const spanClass = spans[imgIndex] || '';
            gridItem.className = 'grid-image' + (spanClass ? ' ' + spanClass : '');

            const img = document.createElement('img');
            img.src = imgSrc;
            img.alt = `${series.title} ${imgIndex + 1}`;
            img.loading = 'lazy';
            img.decoding = 'async';
            img.addEventListener('click', () => openModal(seriesIndex, imgIndex));
            gridItem.appendChild(img);

            grid.appendChild(gridItem);
        });
        article.appendChild(grid);

        if (series.tags && series.tags.length > 0) {
            const tagsDiv = document.createElement('div');
            tagsDiv.className = 'series-tags';
            series.tags.forEach((tag) => {
                const tagSpan = document.createElement('span');
                tagSpan.className = 'series-tag';
                tagSpan.textContent = tag;
                tagsDiv.appendChild(tagSpan);
            });
            article.appendChild(tagsDiv);
        }

        if (state.mode === 'maintain' && isMaintenanceEnabled()) {
            article.appendChild(renderMaintenanceForm(series));
            article.appendChild(renderTextPanel(series));
            article.querySelector('[data-select-card]')?.addEventListener('change', (event) => {
                const id = event.currentTarget.value;
                if (event.currentTarget.checked) state.selectedIds.add(id);
                else state.selectedIds.delete(id);
                updateSelectionState();
            });
        }

        container.appendChild(article);
    });

    renderLoadMoreControl(container);
    updateSelectionState();
}

function formatCardMeta(series) {
    if (state.dataType === 'official') {
        return [
            series.postDate ? `${series.postDate} 发布` : '',
            series.author || ''
        ].filter(Boolean).join(' / ');
    }
    return [
        series.date ? `${series.date} 拍摄` : '',
        series.postDate ? `${series.postDate} 发布` : '',
        series.author || ''
    ].filter(Boolean).join(' / ');
}

function getExistingThemeChoices(selectedTheme = '') {
    const activeFacets = getActiveFacets();
    const visibleRecords = getActiveData().filter((series) => !isDeleted(series)).map(getDisplaySeries);
    return sortedThemes([
        ...(activeFacets.themes || []),
        ...visibleRecords.map((series) => series.theme),
        selectedTheme
    ].filter(Boolean)).filter((item) => typeof item !== 'object');
}

function renderThemeOptions() {
    const choices = getExistingThemeChoices();
    return choices.map((theme) => `<option value="${escapeHtml(theme)}"></option>`).join('');
}

function toDomId(value) {
    return String(value || '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80) || 'record';
}

function renderMaintenanceForm(series) {
    const form = document.createElement('form');
    const themeListId = `theme-options-${toDomId(getRecordId(series))}`;
    form.className = 'maintenance-form';
    form.innerHTML = `
        <div class="maintenance-grid">
            <label class="maintenance-theme">
                <span>活动主题</span>
                <input name="theme" class="filter-input" value="${escapeHtml(series.theme || '')}" list="${themeListId}" placeholder="筛选已有主题或新建主题">
                <datalist id="${themeListId}">
                    ${renderThemeOptions()}
                </datalist>
            </label>
            <label>
                <span>标签</span>
                <input name="tags" class="filter-input" value="${escapeHtml((series.tags || []).join('，'))}">
            </label>
            <label class="maintenance-note">
                <span>备注</span>
                <textarea name="note">${escapeHtml(series.note || '')}</textarea>
            </label>
        </div>
        <div class="maintenance-actions">
            <button class="btn btn-primary" type="submit">保存本条</button>
            <button class="btn btn-danger" type="button" data-delete>删除卡片</button>
        </div>
    `;

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const id = getRecordId(series);
        const patch = {
            theme: String(formData.get('theme') || '').trim(),
            tags: splitTags(String(formData.get('tags') || '')),
            note: String(formData.get('note') || '').trim(),
            updatedAt: new Date().toISOString()
        };
        saveRecordPatch(id, patch);
    });

    form.querySelector('[data-delete]').addEventListener('click', () => {
        deleteRecords([getRecordId(series)], `确定删除「${series.title || series.author}」这条微博数据吗？对应的本地图片文件也会被删除。`);
    });

    return form;
}

function renderTextPanel(series) {
    const details = document.createElement('details');
    details.className = 'weibo-text-panel';

    const summary = document.createElement('summary');
    summary.textContent = '微博文案';
    details.appendChild(summary);

    const content = document.createElement('div');
    content.className = 'weibo-text-content';
    content.textContent = series.text || '暂无文案';
    details.appendChild(content);

    return details;
}

function splitTags(value) {
    return value
        .split(/[，,\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function selectVisibleRecords() {
    if (state.mode !== 'maintain' || !isMaintenanceEnabled()) return;
    state.filteredData.forEach((series) => state.selectedIds.add(getRecordId(series)));
    renderSeries();
}

function clearSelection() {
    state.selectedIds.clear();
    renderSeries();
}

function updateSelectionState() {
    const count = state.selectedIds.size;
    if (els.selectedState) els.selectedState.textContent = `已选择 ${count} 条`;
    if (els.deleteSelected) els.deleteSelected.disabled = count === 0;
}

async function saveRecordPatch(id, patch) {
    if (!isMaintenanceEnabled()) return;
    if (STATIC_EXPORT) {
        state.maintenance.records[id] = patch;
        markDirty(true);
        refreshFacets();
        applyFilterAndRender();
        return;
    }

    try {
        const response = await fetch('/api/records/update', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ dataType: state.dataType, id, patch })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `保存失败：${response.status}`);

        const activeData = getActiveData();
        const sourceIndex = activeData.findIndex((series) => getRecordId(series) === id);
        if (sourceIndex !== -1) {
            const hasThemePatch = Object.prototype.hasOwnProperty.call(patch, 'theme');
            activeData[sourceIndex] = {
                ...activeData[sourceIndex],
                title: hasThemePatch ? patch.theme : activeData[sourceIndex].title,
                theme: hasThemePatch ? patch.theme : activeData[sourceIndex].theme,
                tags: patch.tags || activeData[sourceIndex].tags,
                note: patch.note || ''
            };
        }
        delete state.maintenance.records[id];
        markDirty(false);
        refreshFacets();
        applyFilterAndRender();
    } catch (error) {
        alert(error.message || '保存失败，请确认当前是通过 npm start 启动的服务端项目。');
    }
}

function deleteSelectedRecords() {
    const ids = Array.from(state.selectedIds);
    if (!ids.length) return;
    deleteRecords(ids, `确定删除已选择的 ${ids.length} 条微博数据吗？对应的本地图片文件也会被删除。`);
}

async function deleteRecords(ids, message) {
    if (!ids.length) return;
    if (!isMaintenanceEnabled()) return;
    const confirmed = window.confirm(message);
    if (!confirmed) return;

    if (STATIC_EXPORT) {
        alert('静态浏览版不支持删除源数据，请在服务端维护项目中操作。');
        return;
    }

    try {
        const response = await fetch('/api/delete-records', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ dataType: state.dataType, ids })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `删除失败：${response.status}`);

        const idSet = new Set(ids.map(String));
        const activeData = getActiveData();
        for (let i = activeData.length - 1; i >= 0; i -= 1) {
            if (idSet.has(getRecordId(activeData[i]))) activeData.splice(i, 1);
        }
        ids.forEach((id) => {
            state.selectedIds.delete(String(id));
            delete state.maintenance.records[String(id)];
        });
        refreshFacets();
        applyFilterAndRender();
        alert(`已删除 ${payload.deletedRecords || ids.length} 条微博数据，删除图片 ${payload.deletedImages || 0} 个。`);
    } catch (error) {
        alert(error.message || '删除失败，请确认当前是通过 npm start 启动的服务端项目。');
    }
}

function computeSpans(count) {
    return new Array(count).fill('');
}

function openModal(seriesIndex, imageIndex) {
    state.modalOpen = true;
    state.modalSeriesIndex = seriesIndex;
    state.modalImageIndex = imageIndex;
    updateModalContent();
    els.imageModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    state.modalOpen = false;
    els.imageModal.classList.remove('active');
    document.body.style.overflow = '';
}

function navigateModal(direction) {
    const series = state.filteredData[state.modalSeriesIndex];
    let nextImageIndex = state.modalImageIndex + direction;

    if (nextImageIndex >= 0 && nextImageIndex < series.images.length) {
        state.modalImageIndex = nextImageIndex;
    } else if (direction > 0 && state.modalSeriesIndex < state.filteredData.length - 1) {
        state.modalSeriesIndex++;
        state.modalImageIndex = 0;
    } else if (direction < 0 && state.modalSeriesIndex > 0) {
        state.modalSeriesIndex--;
        state.modalImageIndex = state.filteredData[state.modalSeriesIndex].images.length - 1;
    }

    updateModalContent();
}

function updateModalContent() {
    const series = state.filteredData[state.modalSeriesIndex];
    const imgSrc = series.images[state.modalImageIndex];

    els.modalImage.src = imgSrc;
    els.modalImage.alt = series.title;
    els.modalTitle.textContent = series.title;
    els.modalDescription.textContent = `${formatCardMeta(series)} · ${state.modalImageIndex + 1} / ${series.images.length}`;

    const isFirst = state.modalSeriesIndex === 0 && state.modalImageIndex === 0;
    const lastSeries = state.filteredData[state.filteredData.length - 1];
    const isLast = state.modalSeriesIndex === state.filteredData.length - 1 &&
        state.modalImageIndex === lastSeries.images.length - 1;

    els.modalPrev.disabled = isFirst;
    els.modalNext.disabled = isLast;
    els.modalPrev.style.opacity = isFirst ? '0.2' : '1';
    els.modalNext.style.opacity = isLast ? '0.2' : '1';
}

function handleKeyPress(e) {
    if (!state.modalOpen) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowLeft') navigateModal(-1);
    if (e.key === 'ArrowRight') navigateModal(1);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}
