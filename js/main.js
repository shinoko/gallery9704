// ==================== GALLERY9704 Main Logic ====================

const STORAGE_KEY = 'gallery9704-maintenance';
const STATIC_EXPORT = window.GALLERY9704_STATIC_EXPORT === true;

const state = {
    mode: 'browse',
    sidebarVisible: true,
    currentFilters: { keyword: '', theme: '', author: '', dateFrom: '', dateTo: '' },
    maintenance: { records: {}, deletedIds: [] },
    selectedIds: new Set(),
    filteredData: [],
    modalOpen: false,
    modalSeriesIndex: 0,
    modalImageIndex: 0,
    dirty: false
};

const els = {
    nav: document.querySelector('.nav'),
    sidebar: document.getElementById('sidebar'),
    navToggle: document.getElementById('navToggle'),
    sidebarClose: document.getElementById('sidebarClose'),
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
    themeFilter: document.getElementById('themeFilter'),
    authorFilter: document.getElementById('authorFilter'),
    dateFrom: document.getElementById('dateFrom'),
    dateTo: document.getElementById('dateTo'),
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
    initFacets();
    initListeners();
    if (window.innerWidth <= 1024) closeSidebar();
    updateMode('browse');
});

function initFacets() {
    refreshFacets();
}

function refreshFacets() {
    const currentTheme = els.themeFilter.value;
    const currentAuthor = els.authorFilter.value;
    const visibleRecords = galleryData.filter((series) => !isDeleted(series)).map(getDisplaySeries);
    optionize(els.themeFilter, uniqueSorted([...(galleryFacets.themes || []), ...visibleRecords.map((series) => series.theme)]), '全部主题');
    optionize(els.authorFilter, uniqueSorted([...(galleryFacets.authors || []), ...visibleRecords.map((series) => series.author)]), '全部账号');
    els.themeFilter.value = Array.from(els.themeFilter.options).some((option) => option.value === currentTheme) ? currentTheme : '';
    els.authorFilter.value = Array.from(els.authorFilter.options).some((option) => option.value === currentAuthor) ? currentAuthor : '';
}

function optionize(select, values, placeholder) {
    select.textContent = '';
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = placeholder;
    select.appendChild(empty);
    values.forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    });
}

function uniqueSorted(values) {
    return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
}

function initListeners() {
    els.navToggle.addEventListener('click', toggleSidebar);
    els.sidebarClose.addEventListener('click', closeSidebar);
    els.browseModeBtn.addEventListener('click', () => updateMode('browse'));
    els.maintainModeBtn.addEventListener('click', () => updateMode('maintain'));
    els.selectVisible.addEventListener('click', selectVisibleRecords);
    els.clearSelection.addEventListener('click', clearSelection);
    els.deleteSelected.addEventListener('click', deleteSelectedRecords);
    els.saveMaintenance.addEventListener('click', saveMaintenance);
    els.exportMaintenance.addEventListener('click', exportMaintenance);
    els.exportStatic.addEventListener('click', exportStaticBrowse);
    els.applyFilters.addEventListener('click', applyFilterAndRender);
    els.resetFilters.addEventListener('click', resetAndRender);
    els.keywordSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') applyFilterAndRender();
    });

    els.modalClose.addEventListener('click', closeModal);
    els.modalPrev.addEventListener('click', () => navigateModal(-1));
    els.modalNext.addEventListener('click', () => navigateModal(1));
    els.imageModal.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-backdrop')) closeModal();
    });
    document.addEventListener('keydown', handleKeyPress);
}

function openSidebar() {
    state.sidebarVisible = true;
    els.sidebar.classList.remove('hidden');
}

function toggleSidebar() {
    state.sidebarVisible = !state.sidebarVisible;
    els.sidebar.classList.toggle('hidden', !state.sidebarVisible);
}

function closeSidebar() {
    state.sidebarVisible = false;
    els.sidebar.classList.add('hidden');
}

function updateMode(mode) {
    if (STATIC_EXPORT && mode === 'maintain') return;
    state.mode = mode;
    document.body.dataset.mode = mode;
    els.browseModeBtn.classList.toggle('active', mode === 'browse');
    els.maintainModeBtn.classList.toggle('active', mode === 'maintain');
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
    return state.maintenance.deletedIds.includes(getRecordId(series));
}

function getDisplaySeries(series) {
    const patch = state.maintenance.records[getRecordId(series)] || {};
    const theme = patch.theme || series.theme || series.title || '';
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

function getDateForFilter(series) {
    return normalizeIsoDate(getDisplaySeries(series).date);
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

function applyFilterAndRender() {
    state.currentFilters.keyword = els.keywordSearch.value.trim().toLowerCase();
    state.currentFilters.theme = els.themeFilter.value;
    state.currentFilters.author = els.authorFilter.value;
    state.currentFilters.dateFrom = els.dateFrom.value;
    state.currentFilters.dateTo = els.dateTo.value;

    state.filteredData = galleryData
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
            if (state.currentFilters.theme && displaySeries.theme !== state.currentFilters.theme) return false;
            if (state.currentFilters.author && displaySeries.author !== state.currentFilters.author) return false;
            return true;
        })
        .map(getDisplaySeries)
        .sort(compareByPostTimeDesc);

    renderSeries();
}

function resetAndRender() {
    els.keywordSearch.value = '';
    els.themeFilter.value = '';
    els.authorFilter.value = '';
    els.dateFrom.value = '';
    els.dateTo.value = '';
    state.currentFilters = { keyword: '', theme: '', author: '', dateFrom: '', dateTo: '' };
    applyFilterAndRender();
}

function renderSeries() {
    const container = els.seriesList;
    container.innerHTML = '';

    if (state.filteredData.length === 0) {
        els.emptyState.style.display = 'flex';
        updateSelectionState();
        return;
    }

    els.emptyState.style.display = 'none';

    state.filteredData.forEach((series, seriesIndex) => {
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
                    <h2 class="series-title">${escapeHtml(series.title)}</h2>
                </div>
                <a class="weibo-link" href="${escapeHtml(series.postUrl)}" target="_blank" rel="noreferrer">微博</a>
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

        if (state.mode === 'maintain') {
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

    updateSelectionState();
}

function formatCardMeta(series) {
    return [
        series.postDate ? `${series.postDate} 发布` : '',
        series.author || ''
    ].filter(Boolean).join(' / ');
}

function renderMaintenanceForm(series) {
    const form = document.createElement('form');
    form.className = 'maintenance-form';
    form.innerHTML = `
        <div class="maintenance-grid">
            <label>
                <span>活动主题</span>
                <input name="theme" class="filter-input" value="${escapeHtml(series.theme || '')}">
            </label>
            <label>
                <span>维护状态</span>
                <select name="status" class="filter-select">
                    <option value="todo"${series.status === 'todo' ? ' selected' : ''}>待处理</option>
                    <option value="reviewed"${series.status === 'reviewed' ? ' selected' : ''}>已确认</option>
                    <option value="needs-info"${series.status === 'needs-info' ? ' selected' : ''}>需补充</option>
                    <option value="ignored"${series.status === 'ignored' ? ' selected' : ''}>忽略</option>
                </select>
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
            status: String(formData.get('status') || 'todo'),
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
    if (state.mode !== 'maintain') return;
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
            body: JSON.stringify({ id, patch })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `保存失败：${response.status}`);

        const sourceIndex = galleryData.findIndex((series) => getRecordId(series) === id);
        if (sourceIndex !== -1) {
            galleryData[sourceIndex] = {
                ...galleryData[sourceIndex],
                title: patch.theme || galleryData[sourceIndex].title,
                theme: patch.theme || galleryData[sourceIndex].theme,
                tags: patch.tags || galleryData[sourceIndex].tags,
                status: patch.status || 'todo',
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
            body: JSON.stringify({ ids })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `删除失败：${response.status}`);

        const idSet = new Set(ids.map(String));
        for (let i = galleryData.length - 1; i >= 0; i -= 1) {
            if (idSet.has(getRecordId(galleryData[i]))) galleryData.splice(i, 1);
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
