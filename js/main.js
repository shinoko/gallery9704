// ==================== GALLERY9704 Main Logic ====================

const STATIC_EXPORT = window.GALLERY9704_STATIC_EXPORT === true;
const DEFAULT_NO_IMAGE = window.GALLERY9704_DEFAULT_NO_IMAGE === true;
const UNCATEGORIZED_THEME_VALUE = '__uncategorized__';
const INITIAL_RENDER_COUNT = 24;
const RENDER_BATCH_SIZE = 24;
const DATE_PICKER_MIN_YEAR = 2018;
const DATE_PICKER_MIN_MONTH = 6;
const DATE_PICKER_MIN_VALUE = '2018-07-01';
const DATE_PICKER_MAX_YEAR = new Date().getFullYear();
const DATE_PICKER_MAX_VALUE = `${DATE_PICKER_MAX_YEAR}-12-31`;
const NO_IMAGE_PLACEHOLDER_SRC = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="3" height="4" viewBox="0 0 3 4"%3E%3Crect width="3" height="4" fill="%23e3e3df"/%3E%3C/svg%3E';
const APP_CONFIG = window.GALLERY9704_CONFIG || {};
const PLATFORM_CONFIG = Array.isArray(APP_CONFIG.platforms) ? APP_CONFIG.platforms : [];
const PLATFORM_LABELS = Object.fromEntries(PLATFORM_CONFIG.map((platform) => [platform.id, platform.label]));
const PLATFORM_ORDER = PLATFORM_CONFIG.map((platform) => platform.id);
const AUTHOR_ALIASES = APP_CONFIG.authorAliases || {};
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
const THEME_SORT_META = new Map((APP_CONFIG.themes || []).map((theme, index) => [theme.name, {
    date: theme.date || theme.from || '',
    index: Number.isFinite(theme.order) ? theme.order : index
}]));
const datePickerStates = new Map();

const state = {
    dataType: 'official',
    filterVisible: false,
    mode: DEFAULT_NO_IMAGE ? 'maintain' : 'browse',
    currentFilters: { keyword: '', theme: '', author: '', platform: '', shootDateFrom: '', shootDateTo: '', postDateFrom: '', postDateTo: '' },
    selectedIds: new Set(),
    filteredData: [],
    renderLimit: INITIAL_RENDER_COUNT,
    loadMoreObserver: null,
    modalOpen: false,
    modalSeriesIndex: 0,
    modalImageIndex: 0,
    noImageMode: DEFAULT_NO_IMAGE,
    pendingThemeEdits: new Map(),
    savingThemeEdits: false,
    savingThemeIds: new Set(),
    toastTimer: null
};

const els = {
    nav: document.querySelector('.nav'),
    filterBackdrop: document.getElementById('filterBackdrop'),
    toastViewport: document.getElementById('toastViewport'),
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
    saveCardThemes: document.getElementById('saveCardThemes'),
    deleteSelected: document.getElementById('deleteSelected'),
    selectedState: document.getElementById('selectedState'),
    exportStatic: document.getElementById('exportStatic'),
    noImageToggle: document.getElementById('noImageToggle'),
    seriesList: document.getElementById('seriesList'),
    emptyState: document.getElementById('emptyState'),
    keywordSearch: document.getElementById('keywordSearch'),
    themeFilterGroup: document.getElementById('themeFilterGroup'),
    themeFilter: document.getElementById('themeFilter'),
    authorFilter: document.getElementById('authorFilter'),
    platformFilterGroup: document.getElementById('platformFilterGroup'),
    platformFilter: document.getElementById('platformFilter'),
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
    document.body.dataset.staticExport = STATIC_EXPORT ? 'true' : 'false';
    document.body.dataset.dataType = state.dataType;
    document.body.dataset.filterVisible = state.filterVisible ? 'true' : 'false';
    document.body.dataset.filterPopover = 'false';
    initFilterControls();
    initFacets();
    initListeners();
    updateMode(state.mode);
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
    closeFilterPopovers();
    const currentTheme = els.themeFilter.value;
    const currentAuthor = els.authorFilter.value;
    const currentPlatform = els.platformFilter?.value || '';
    const visibleRecords = getActiveData().map(getDisplaySeries);
    optionize(els.themeFilter, sortedThemes(visibleRecords.map((series) => series.theme)), '全部主题');
    optionize(els.authorFilter, sortedStrings(visibleRecords.map(formatAuthorFilterValue)), '全部账号');
    optionize(
        els.platformFilter,
        sortedPlatforms(visibleRecords.map(normalizePlatform)),
        '全部平台'
    );
    els.themeFilter.value = Array.from(els.themeFilter.options).some((option) => option.value === currentTheme) ? currentTheme : '';
    els.authorFilter.value = Array.from(els.authorFilter.options).some((option) => option.value === currentAuthor) ? currentAuthor : '';
    els.platformFilter.value = Array.from(els.platformFilter.options).some((option) => option.value === currentPlatform) ? currentPlatform : '';
    syncCustomSelect(els.themeFilter);
    syncCustomSelect(els.authorFilter);
    syncCustomSelect(els.platformFilter);
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
    syncCustomSelect(select);
}

function initFilterControls() {
    document.querySelectorAll('[data-clear-input]').forEach((button) => {
        const input = document.getElementById(button.dataset.clearInput);
        if (!input) return;
        const sync = () => {
            button.hidden = !input.value;
        };
        input.addEventListener('input', sync);
        input.addEventListener('change', sync);
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            if (input === els.keywordSearch) applyFilterAndRender({ scrollTop: true });
            else updateSelectionState();
        });
        sync();
    });

    document.querySelectorAll('[data-custom-select]').forEach((root) => {
        const select = root.querySelector('select');
        const trigger = root.querySelector('.custom-select-trigger');
        const menu = root.querySelector('.custom-select-menu')
            || document.querySelector(`[data-filter-popover-for="${root.querySelector('select')?.id}"]`);
        if (!select || !trigger || !menu) return;

        trigger.addEventListener('click', (event) => {
            event.stopPropagation();
            const willOpen = !root.classList.contains('is-open');
            closeFilterPopovers();
            root.classList.toggle('is-open', willOpen);
            trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
            menu.hidden = !willOpen;
            if (willOpen) positionFloatingPopover(trigger, menu);
            syncFilterPopoverState();
        });
        trigger.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                trigger.click();
            }
            if (event.key === 'Escape') closeFilterPopovers();
        });
        menu.classList.add('filter-floating-popover');
        menu.dataset.filterPopover = 'true';
        menu.dataset.filterPopoverFor = select.id;
        menu.addEventListener('click', (event) => {
            event.stopPropagation();
            const option = event.target.closest('[data-select-value]');
            if (!option) return;
            select.value = option.dataset.selectValue;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            syncCustomSelect(select);
            closeFilterPopovers();
            trigger.focus({ preventScroll: true });
        });
        document.body.appendChild(menu);
        syncCustomSelect(select);
    });

    initDateInputs();
}

function syncCustomSelect(select) {
    const root = select?.closest('[data-custom-select]');
    if (!root) return;
    const selected = Array.from(select.options).find((option) => option.value === select.value);
    const label = root.querySelector('[data-select-label]');
    const menu = root.querySelector('.custom-select-menu')
        || document.querySelector(`[data-filter-popover-for="${select.id}"]`);
    if (label) label.textContent = selected?.textContent || '';
    if (!menu) return;
    menu.textContent = '';
    Array.from(select.options).forEach((option) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'custom-select-option';
        item.dataset.selectValue = option.value;
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', option.value === select.value ? 'true' : 'false');
        item.textContent = option.textContent;
        menu.appendChild(item);
    });
}

function closeFilterPopovers(except = null) {
    document.querySelectorAll('[data-custom-select].is-open').forEach((root) => {
        if (root === except) return;
        root.classList.remove('is-open');
        root.querySelector('.custom-select-trigger')?.setAttribute('aria-expanded', 'false');
        const select = root.querySelector('select');
        const menu = root.querySelector('.custom-select-menu')
            || document.querySelector(`[data-filter-popover-for="${select?.id}"]`);
        if (menu) menu.hidden = true;
    });
    datePickerStates.forEach((picker) => {
        if (picker.root === except) return;
        setDatePickerOpen(picker, false);
    });
    syncFilterPopoverState();
}

function syncFilterPopoverState() {
    const hasOpenPopover = Boolean(document.querySelector('[data-custom-select].is-open, [data-date-picker].is-open'));
    document.body.dataset.filterPopover = hasOpenPopover ? 'true' : 'false';
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
    els.filterBackdrop?.addEventListener('click', () => setFilterPanelVisible(false));
    els.stationTab.addEventListener('click', () => updateDataType('station'));
    els.officialTab.addEventListener('click', () => updateDataType('official'));
    els.sidebarClose.addEventListener('click', toggleFilterPanel);
    els.browseModeBtn.addEventListener('click', () => updateMode('browse'));
    els.maintainModeBtn.addEventListener('click', () => updateMode('maintain'));
    els.selectVisible.addEventListener('click', selectVisibleRecords);
    els.clearSelection.addEventListener('click', clearSelection);
    els.saveCardThemes.addEventListener('click', saveCardThemes);
    els.deleteSelected.addEventListener('click', deleteSelectedRecords);
    els.exportStatic.addEventListener('click', exportStaticBrowse);
    els.noImageToggle.addEventListener('change', (event) => updateNoImageMode(event.currentTarget.checked));
    els.applyFilters.addEventListener('click', () => applyFilterAndRender({ scrollTop: true }));
    els.resetFilters.addEventListener('click', resetAndRender);
    els.keywordSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') applyFilterAndRender({ scrollTop: true });
    });
    [
        els.keywordSearch,
        els.themeFilter,
        els.authorFilter,
        els.platformFilter,
        els.shootDateFrom,
        els.shootDateTo,
        els.postDateFrom,
        els.postDateTo
    ].filter(Boolean).forEach((control) => {
        control.addEventListener('input', closeFilterPopovers);
        control.addEventListener('change', closeFilterPopovers);
    });

    els.modalClose.addEventListener('click', closeModal);
    els.modalPrev.addEventListener('click', () => navigateModal(-1));
    els.modalNext.addEventListener('click', () => navigateModal(1));
    els.imageModal.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-backdrop')) closeModal();
    });
    document.addEventListener('click', handleOutsideFilterClick);
    document.addEventListener('keydown', handleKeyPress);
    window.addEventListener('resize', () => {
        repositionOpenFilterPopovers();
    });
    els.sidebar.addEventListener('scroll', repositionOpenFilterPopovers, { passive: true });
}

function handleOutsideFilterClick(event) {
    const insideFilterPopover = event.target.closest('[data-custom-select], [data-date-picker], [data-filter-popover]');
    if (!insideFilterPopover) closeFilterPopovers();
    if (!state.filterVisible) return;
    if (insideFilterPopover) return;
    if (els.sidebar.contains(event.target)) return;
    if (els.navToggle.contains(event.target)) return;
    setFilterPanelVisible(false);
}

function initDateInputs() {
    document.querySelectorAll('[data-date-picker]').forEach((root) => {
        const input = root.querySelector('input[type="date"]');
        const trigger = root.querySelector('[data-date-trigger]');
        if (!input || !trigger) return;
        const today = new Date();
        const selected = input.value ? new Date(`${input.value}T00:00:00`) : today;
        input.min = DATE_PICKER_MIN_VALUE;
        input.max = DATE_PICKER_MAX_VALUE;
        const picker = {
            root,
            input,
            trigger,
            popover: root.querySelector('.date-picker-popover'),
            monthLabel: root.querySelector('[data-date-month]'),
            grid: root.querySelector('[data-date-grid]'),
            viewYear: selected.getFullYear(),
            viewMonth: selected.getMonth()
        };
        initDatePickerSelectors(picker);
        picker.popover.classList.add('filter-floating-popover');
        picker.popover.dataset.filterPopover = 'true';
        picker.popover.dataset.filterPopoverFor = input.id;
        picker.popover.addEventListener('click', (event) => event.stopPropagation());
        document.body.appendChild(picker.popover);
        datePickerStates.set(input.id, picker);
        trigger.addEventListener('click', (event) => {
            event.stopPropagation();
            const willOpen = picker.popover.hidden;
            closeFilterPopovers();
            setDatePickerOpen(picker, willOpen);
        });
        picker.previousButton = picker.popover.querySelector('[data-date-prev]');
        picker.nextButton = picker.popover.querySelector('[data-date-next]');
        picker.previousButton?.addEventListener('click', (event) => {
            event.stopPropagation();
            shiftDatePickerMonth(picker, -1);
        });
        picker.nextButton?.addEventListener('click', (event) => {
            event.stopPropagation();
            shiftDatePickerMonth(picker, 1);
        });
        picker.popover.querySelector('[data-date-clear]')?.addEventListener('click', (event) => {
            event.stopPropagation();
            input.value = '';
            input.dispatchEvent(new Event('change', { bubbles: true }));
            syncDatePicker(picker);
            setDatePickerOpen(picker, false);
        });
        syncDatePicker(picker);
    });
}

function initDatePickerSelectors(picker) {
    if (!picker.monthLabel) return;
    picker.monthLabel.textContent = '';
    const yearOptions = [];
    for (let year = DATE_PICKER_MIN_YEAR; year <= DATE_PICKER_MAX_YEAR; year += 1) {
        yearOptions.push({ value: String(year), label: `${year}年` });
    }
    const monthOptions = [];
    for (let month = 0; month < 12; month += 1) {
        monthOptions.push({ value: String(month), label: `${month + 1}月` });
    }

    picker.yearSelect = createDatePickerSelector(picker, 'year', '选择年份', yearOptions, (value) => {
        picker.viewYear = Number(value);
        if (picker.viewYear === DATE_PICKER_MIN_YEAR && picker.viewMonth < DATE_PICKER_MIN_MONTH) {
            picker.viewMonth = DATE_PICKER_MIN_MONTH;
        }
        renderDatePicker(picker);
    });
    picker.monthSelect = createDatePickerSelector(picker, 'month', '选择月份', monthOptions, (value) => {
        picker.viewMonth = Number(value);
        renderDatePicker(picker);
    });
    picker.monthLabel.append(picker.yearSelect.root, picker.monthSelect.root);
}

function createDatePickerSelector(picker, type, ariaLabel, options, onSelect) {
    const root = document.createElement('div');
    root.className = `date-picker-select date-picker-${type}-select`;

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'date-picker-select-trigger';
    trigger.setAttribute('aria-label', ariaLabel);
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const label = document.createElement('span');
    const chevron = document.createElement('span');
    chevron.className = 'custom-select-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    trigger.append(label, chevron);

    const menu = document.createElement('div');
    menu.className = 'custom-select-menu date-picker-select-menu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', `${ariaLabel}选项`);
    menu.hidden = true;
    const optionButtons = options.map((option) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'custom-select-option';
        button.dataset.selectValue = option.value;
        button.setAttribute('role', 'option');
        button.textContent = option.label;
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            if (button.disabled) return;
            onSelect(option.value);
        });
        menu.appendChild(button);
        return button;
    });

    trigger.addEventListener('click', (event) => {
        event.stopPropagation();
        const willOpen = menu.hidden;
        closeDatePickerSelectorMenus(picker);
        menu.hidden = !willOpen;
        root.classList.toggle('is-open', willOpen);
        trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
    root.append(trigger, menu);
    return { root, trigger, label, menu, options, optionButtons, value: '' };
}

function closeDatePickerSelectorMenus(picker) {
    [picker.yearSelect, picker.monthSelect].filter(Boolean).forEach((control) => {
        control.menu.hidden = true;
        control.root.classList.remove('is-open');
        control.trigger.setAttribute('aria-expanded', 'false');
    });
}

function syncDatePickerSelector(control, value) {
    const stringValue = String(value);
    control.value = stringValue;
    control.label.textContent = control.options.find((option) => option.value === stringValue)?.label || '';
    control.optionButtons.forEach((button) => {
        button.setAttribute('aria-selected', button.dataset.selectValue === stringValue ? 'true' : 'false');
    });
}

function updateDateFieldStates() {
    datePickerStates.forEach((picker) => {
        syncDatePicker(picker);
    });
}

function setDatePickerOpen(picker, open) {
    picker.root.classList.toggle('is-open', open);
    picker.root.classList.toggle('align-right', false);
    picker.popover.hidden = !open;
    picker.trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open) closeDatePickerSelectorMenus(picker);
    if (open) {
        renderDatePicker(picker);
        positionDatePicker(picker);
    }
    syncFilterPopoverState();
}

function positionDatePicker(picker) {
    if (!picker.root.classList.contains('is-open')) return;
    positionFloatingPopover(picker.trigger, picker.popover, { width: 248 });
}

function positionFloatingPopover(trigger, popover, options = {}) {
    if (!trigger || !popover || popover.hidden) return;
    const viewportPadding = 8;
    const gap = 6;
    const triggerRect = trigger.getBoundingClientRect();
    const width = Math.min(options.width || triggerRect.width, window.innerWidth - viewportPadding * 2);
    const height = popover.getBoundingClientRect().height;
    const spaceBelow = window.innerHeight - triggerRect.bottom - viewportPadding;
    const spaceAbove = triggerRect.top - viewportPadding;
    const openAbove = spaceBelow < height && spaceAbove > viewportPadding + gap;
    const top = openAbove
        ? Math.max(viewportPadding, triggerRect.top - height - gap)
        : Math.min(window.innerHeight - height - viewportPadding, triggerRect.bottom + gap);
    const left = Math.min(
        Math.max(viewportPadding, triggerRect.left),
        window.innerWidth - width - viewportPadding
    );
    popover.style.width = `${width}px`;
    popover.style.left = `${left}px`;
    popover.style.right = 'auto';
    popover.style.top = `${Math.max(viewportPadding, top)}px`;
}

function repositionOpenFilterPopovers() {
    document.querySelectorAll('[data-custom-select].is-open').forEach((root) => {
        const select = root.querySelector('select');
        const menu = root.querySelector('.custom-select-menu')
            || document.querySelector(`[data-filter-popover-for="${select?.id}"]`);
        positionFloatingPopover(root.querySelector('.custom-select-trigger'), menu);
    });
    datePickerStates.forEach((picker) => positionDatePicker(picker));
}

function shiftDatePickerMonth(picker, offset) {
    const next = new Date(picker.viewYear, picker.viewMonth + offset, 1);
    const nextValue = formatDateValue(next.getFullYear(), next.getMonth(), 1);
    if (nextValue < DATE_PICKER_MIN_VALUE || nextValue > DATE_PICKER_MAX_VALUE) return;
    picker.viewYear = next.getFullYear();
    picker.viewMonth = next.getMonth();
    renderDatePicker(picker);
}

function formatDateValue(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function renderDatePicker(picker) {
    const { viewYear, viewMonth } = picker;
    closeDatePickerSelectorMenus(picker);
    syncDatePickerSelector(picker.yearSelect, viewYear);
    syncDatePickerSelector(picker.monthSelect, viewMonth);
    picker.monthSelect.optionButtons.forEach((button) => {
        const month = Number(button.dataset.selectValue);
        button.disabled = viewYear === DATE_PICKER_MIN_YEAR && month < DATE_PICKER_MIN_MONTH;
    });
    if (picker.previousButton) {
        picker.previousButton.disabled = viewYear === DATE_PICKER_MIN_YEAR && viewMonth === DATE_PICKER_MIN_MONTH;
    }
    if (picker.nextButton) {
        picker.nextButton.disabled = viewYear === DATE_PICKER_MAX_YEAR && viewMonth === 11;
    }
    picker.grid.textContent = '';
    const firstDay = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
    const dayCount = new Date(viewYear, viewMonth + 1, 0).getDate();
    for (let index = 0; index < firstDay; index += 1) {
        const spacer = document.createElement('span');
        spacer.className = 'date-picker-spacer';
        spacer.setAttribute('aria-hidden', 'true');
        picker.grid.appendChild(spacer);
    }
    const today = new Date();
    const todayValue = formatDateValue(today.getFullYear(), today.getMonth(), today.getDate());
    for (let day = 1; day <= dayCount; day += 1) {
        const value = formatDateValue(viewYear, viewMonth, day);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'date-picker-day';
        button.textContent = String(day);
        button.dataset.dateValue = value;
        button.setAttribute('role', 'gridcell');
        if (picker.input.value === value) button.classList.add('is-selected');
        if (todayValue === value) button.classList.add('is-today');
        button.addEventListener('click', () => {
            picker.input.value = value;
            picker.input.dispatchEvent(new Event('change', { bubbles: true }));
            syncDatePicker(picker);
            setDatePickerOpen(picker, false);
        });
        picker.grid.appendChild(button);
    }
}

function syncDatePicker(picker) {
    const value = picker.input.value;
    const valueLabel = picker.root.querySelector('[data-date-value]');
    const placeholder = picker.trigger.getAttribute('aria-label')?.replace(/^(拍摄|发布)/, '') || '选择日期';
    valueLabel.textContent = value || placeholder;
    picker.root.classList.toggle('has-value', Boolean(value));
}

function toggleFilterPanel() {
    setFilterPanelVisible(!state.filterVisible);
}

function setFilterPanelVisible(visible) {
    state.filterVisible = visible;
    document.body.dataset.filterVisible = state.filterVisible ? 'true' : 'false';
    els.sidebar.classList.toggle('hidden', !state.filterVisible);
    els.navToggle.setAttribute('aria-pressed', state.filterVisible ? 'true' : 'false');
    if (!state.filterVisible) closeFilterPopovers();
}

function updateDataType(dataType) {
    if (state.dataType === dataType) return;
    closeFilterPopovers();
    state.dataType = dataType;
    document.body.dataset.dataType = dataType;
    state.selectedIds.clear();
    state.pendingThemeEdits.clear();
    if (!isMaintenanceEnabled()) state.mode = 'browse';
    els.stationTab.classList.toggle('active', dataType === 'station');
    els.officialTab.classList.toggle('active', dataType === 'official');
    els.stationTab.setAttribute('aria-selected', dataType === 'station' ? 'true' : 'false');
    els.officialTab.setAttribute('aria-selected', dataType === 'official' ? 'true' : 'false');
    resetFilters({ render: false });
    refreshFacets();
    updateMode(state.mode);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}

function updateMode(mode) {
    if (!isMaintenanceEnabled() && mode === 'maintain') return;
    if (!isMaintenanceEnabled()) mode = 'browse';
    closeFilterPopovers();
    state.mode = mode;
    document.body.dataset.mode = mode;
    els.browseModeBtn.classList.toggle('active', mode === 'browse');
    els.maintainModeBtn.classList.toggle('active', mode === 'maintain');
    els.maintainModeBtn.disabled = !isMaintenanceEnabled();
    syncNoImageMode();
    applyFilterAndRender();
}

function isNoImageActive() {
    return state.mode === 'maintain' && state.noImageMode;
}

function syncNoImageMode() {
    const active = isNoImageActive();
    document.body.dataset.noImage = active ? 'true' : 'false';
    if (els.noImageToggle) {
        els.noImageToggle.checked = state.noImageMode;
        els.noImageToggle.disabled = state.mode !== 'maintain' || !isMaintenanceEnabled();
    }
}

function updateNoImageMode(enabled) {
    state.noImageMode = Boolean(enabled);
    syncNoImageMode();
    renderSeries();
    if (state.modalOpen) updateModalContent();
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

function getRecordId(series) {
    return String(series.postUrl || series.id || series.label);
}

function getSeriesTheme(series) {
    return series?.theme || '';
}

function getSeriesImageFiles(series) {
    return Array.isArray(series?.imageFiles)
        ? series.imageFiles
        : (Array.isArray(series?.images) ? series.images : []);
}

function getSeriesMaintenanceNote(series) {
    return series?.maintenance?.note || series?.maintenanceNote || series?.note || '';
}

function getSeriesPostTimeText(series) {
    return series?.postTimeText || series?.description || '';
}

function getDisplaySeries(series) {
    const id = getRecordId(series);
    const theme = state.pendingThemeEdits.has(id) ? state.pendingThemeEdits.get(id) : getSeriesTheme(series);
    return {
        ...series,
        theme,
        tags: series.tags || []
    };
}

function getShootDateForFilter(series) {
    return normalizeIsoDate(getDisplaySeries(series).shootDate || series.date);
}

function getPostDateForFilter(series) {
    return normalizeIsoDate(series.postDate);
}

function normalizePlatform(series) {
    return PLATFORM_LABELS[series?.platform] ? series.platform : 'weibo';
}

function formatAuthorFilterValue(series) {
    const author = typeof series === 'string' ? series : series?.author;
    return AUTHOR_ALIASES[author] || author || '';
}

function formatPlatformLabel(seriesOrPlatform) {
    const platform = typeof seriesOrPlatform === 'string' ? seriesOrPlatform : normalizePlatform(seriesOrPlatform);
    return PLATFORM_LABELS[platform] || platform || '微博';
}

function sortedPlatforms(platforms) {
    return Array.from(new Set(platforms.filter(Boolean)))
        .sort((a, b) => {
            const indexA = PLATFORM_ORDER.indexOf(a);
            const indexB = PLATFORM_ORDER.indexOf(b);
            if (indexA >= 0 && indexB >= 0) return indexA - indexB;
            if (indexA >= 0) return -1;
            if (indexB >= 0) return 1;
            return a.localeCompare(b);
        })
        .map((platform) => ({ value: platform, label: formatPlatformLabel(platform) }));
}

function postSortValue(series) {
    const time = String(getSeriesPostTimeText(series)).match(/\d{1,2}:\d{2}/)?.[0] || '00:00';
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

function showToast(message, type = 'info') {
    if (!els.toastViewport) return;
    window.clearTimeout(state.toastTimer);
    els.toastViewport.textContent = '';
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    els.toastViewport.appendChild(toast);
    state.toastTimer = window.setTimeout(() => {
        toast.remove();
    }, 3000);
}

function validateDateRanges() {
    const ranges = [
        { label: '拍摄时间', from: els.shootDateFrom, to: els.shootDateTo },
        { label: '发布时间', from: els.postDateFrom, to: els.postDateTo }
    ];
    const invalidRange = ranges.find(({ from, to }) => from?.value && to?.value && from.value > to.value);
    if (!invalidRange) return true;
    showToast(`${invalidRange.label}的开始日期不能晚于结束日期，请重新选择。`, 'error');
    datePickerStates.get(invalidRange.from.id)?.trigger?.focus({ preventScroll: true });
    return false;
}

function applyFilterAndRender(options = {}) {
    closeFilterPopovers();
    if (!validateDateRanges()) return;
    state.currentFilters.keyword = els.keywordSearch.value.trim().toLowerCase();
    state.currentFilters.theme = els.themeFilter.value;
    state.currentFilters.author = els.authorFilter.value;
    state.currentFilters.platform = els.platformFilter.value;
    state.currentFilters.shootDateFrom = els.shootDateFrom.value;
    state.currentFilters.shootDateTo = els.shootDateTo.value;
    state.currentFilters.postDateFrom = els.postDateFrom.value;
    state.currentFilters.postDateTo = els.postDateTo.value;
    state.renderLimit = INITIAL_RENDER_COUNT;

    state.filteredData = getActiveData()
        .filter((series) => {
            const displaySeries = getDisplaySeries(series);
            const searchable = [
                displaySeries.title,
                displaySeries.theme,
                displaySeries.author,
                formatAuthorFilterValue(displaySeries),
                formatPlatformLabel(displaySeries),
                getSeriesPostTimeText(displaySeries),
                displaySeries.text,
                getSeriesMaintenanceNote(displaySeries),
                ...(displaySeries.tags || [])
            ].join(' ').toLowerCase();
            if (state.currentFilters.keyword && !searchable.includes(state.currentFilters.keyword)) return false;
            if (state.dataType === 'station') {
                if (state.currentFilters.theme === UNCATEGORIZED_THEME_VALUE && displaySeries.theme) return false;
                if (state.currentFilters.theme && state.currentFilters.theme !== UNCATEGORIZED_THEME_VALUE && displaySeries.theme !== state.currentFilters.theme) return false;
            }
            if (state.currentFilters.author && formatAuthorFilterValue(displaySeries) !== state.currentFilters.author) return false;
            if (state.currentFilters.platform && normalizePlatform(displaySeries) !== state.currentFilters.platform) return false;
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
    closeFilterPopovers();
    els.keywordSearch.value = '';
    document.querySelectorAll('[data-clear-input]').forEach((button) => {
        const input = document.getElementById(button.dataset.clearInput);
        if (input) button.hidden = !input.value;
    });
    els.themeFilter.value = '';
    els.authorFilter.value = '';
    els.platformFilter.value = '';
    syncCustomSelect(els.themeFilter);
    syncCustomSelect(els.authorFilter);
    syncCustomSelect(els.platformFilter);
    els.shootDateFrom.value = '';
    els.shootDateTo.value = '';
    els.postDateFrom.value = '';
    els.postDateTo.value = '';
    updateDateFieldStates();
    state.currentFilters = { keyword: '', theme: '', author: '', platform: '', shootDateFrom: '', shootDateTo: '', postDateFrom: '', postDateTo: '' };
    if (render) applyFilterAndRender({ scrollTop: true });
}

function updateFilterVisibility() {
    const isOfficial = state.dataType === 'official';
    els.themeFilterGroup.classList.toggle('is-hidden', isOfficial);
    els.platformFilterGroup.classList.toggle('is-hidden', !isOfficial);
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
    const previousLimit = state.renderLimit;
    state.renderLimit = Math.min(state.renderLimit + RENDER_BATCH_SIZE, state.filteredData.length);
    els.seriesList.querySelector('.load-more')?.remove();
    appendSeriesRange(previousLimit, state.renderLimit);
    renderLoadMoreControl(els.seriesList);
    updateSelectionState();
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

    appendSeriesRange(0, state.renderLimit);
    renderLoadMoreControl(container);
    updateSelectionState();
}

function appendSeriesRange(start, end) {
    const fragment = document.createDocumentFragment();
    state.filteredData.slice(start, end).forEach((series, offset) => {
        fragment.appendChild(renderSeriesItem(series, start + offset));
    });
    els.seriesList.appendChild(fragment);
}

function renderSeriesItem(series, seriesIndex) {
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
                ${state.dataType === 'station' && series.theme ? `<h2 class="series-title">${escapeHtml(series.theme)}</h2>` : ''}
            </div>
            ${renderSourceLink(series)}
        </div>
    `;
    article.appendChild(header);

    const grid = document.createElement('div');
    const imageFiles = getSeriesImageFiles(series);
    grid.className = `image-grid count-${Math.min(imageFiles.length, 3)}`;
    const spans = computeSpans(imageFiles.length);

    imageFiles.forEach((imgSrc, imgIndex) => {
        const gridItem = document.createElement('div');
        const spanClass = spans[imgIndex] || '';
        gridItem.className = 'grid-image' + (spanClass ? ' ' + spanClass : '');

        const img = document.createElement('img');
        img.src = isNoImageActive() ? NO_IMAGE_PLACEHOLDER_SRC : imgSrc;
        if (isNoImageActive()) img.dataset.realSrc = imgSrc;
        img.alt = `${series.theme || series.author || '图库图片'} ${imgIndex + 1}`;
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
        article.appendChild(renderMaintenanceActions(series));
        article.querySelector('[data-select-card]')?.addEventListener('change', (event) => {
            const id = event.currentTarget.value;
            if (event.currentTarget.checked) state.selectedIds.add(id);
            else state.selectedIds.delete(id);
            updateSelectionState();
        });
    }

    return article;
}

function formatCardMeta(series) {
    if (state.dataType === 'official') {
        return [
            series.postDate ? `${series.postDate} 发布` : '',
            series.author || '',
            formatPlatformLabel(series)
        ].filter(Boolean).join(' / ');
    }
    return [
        series.shootDate ? `${series.shootDate} 拍摄` : '',
        series.postDate ? `${series.postDate} 发布` : '',
        series.author || ''
    ].filter(Boolean).join(' / ');
}

function renderSourceLink(series) {
    if (!series.postUrl) return '';
    const platform = normalizePlatform(series);
    const href = getSourceHref(series);
    const label = getSourceLinkLabel(series);
    return `
        <a class="source-link weibo-link platform-${escapeHtml(platform)}" href="${escapeHtml(href)}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
            ${renderSourceIcon(platform)}
        </a>
    `;
}

function getSourceHref(series) {
    return series.webUrl || series.pcUrl || series.postUrl;
}

function getSourceLinkLabel(series) {
    const platform = normalizePlatform(series);
    if (platform !== 'xiaohongshu') return '打开微博原文';
    return /[?&]xsec_token=/.test(getSourceHref(series))
        ? '打开小红书笔记'
        : '打开小红书笔记（PC 端可能需要 App 扫码，后续采集到 xsec_token 后可改善）';
}

function renderSourceIcon(platform) {
    if (platform === 'xiaohongshu') {
        return `
            <svg class="xhs-icon" width="16" height="16" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12.9 35.4c-.7-4.9-1-9.7-.8-14.6.1-4.5 1.2-6.1 5.7-6.6 4.1-.4 8.3-.4 12.4 0 4.5.5 5.6 2.1 5.7 6.6.2 4.9-.1 9.7-.8 14.6"/>
                <path d="M16.8 20.5c4.8.4 9.6.4 14.4 0"/>
                <path d="M17.4 27.1c4.4.4 8.8.4 13.2 0"/>
                <path d="M19.1 33.7c3.3.3 6.5.3 9.8 0"/>
                <path d="M19 11.8c.2-2.1 1.9-3.7 4-3.9h2c2.1.2 3.8 1.8 4 3.9"/>
                <path d="M14.1 39c6.6 1.6 13.2 1.6 19.8 0"/>
            </svg>
        `;
    }
    return `
        <svg class="weibo-icon" width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M14.3 7.8c1.1.8 1.7 1.8 1.5 2.9-.4 2.3-3.7 3.9-7.4 3.6-3.7-.3-6.4-2.4-6-4.7.3-1.6 2.2-2.9 4.6-3.4"/>
            <path d="M6.2 6.7c.8-1.4 2.2-2.2 3.4-1.8 1.2.4 1.7 1.8 1.2 3.3"/>
            <path d="M7.1 9.7c-.1.8.7 1.5 1.8 1.6 1.1.1 2-.4 2.1-1.2.1-.8-.7-1.5-1.8-1.6-1.1-.1-2 .4-2.1 1.2Z"/>
            <path d="M12.1 3.3c1.2.2 2.1 1 2.4 2.1"/>
            <path d="M12.7 1.4c2.1.3 3.7 1.8 4.1 3.8"/>
        </svg>
    `;
}

function getMaintenanceThemeChoices(selectedTheme = '') {
    const activeFacets = getActiveFacets();
    const recordThemes = getActiveData().map(getDisplaySeries).map((item) => item.theme);
    const pendingThemes = Array.from(state.pendingThemeEdits.values());
    return sortedThemes([
        ...(activeFacets.themes || []),
        ...recordThemes,
        ...pendingThemes,
        selectedTheme
    ]).filter((item) => typeof item !== 'object');
}

function renderThemeOptions(selectedTheme = '') {
    return getMaintenanceThemeChoices(selectedTheme)
        .map((theme) => `<option value="${escapeHtml(theme)}"></option>`)
        .join('');
}

function toDomId(value) {
    return String(value || '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80) || 'record';
}

function renderMaintenanceForm(series) {
    const form = document.createElement('div');
    const id = getRecordId(series);
    const sourceSeries = getActiveData().find((item) => getRecordId(item) === id) || series;
    const originalTheme = sourceSeries.theme || '';
    const currentTheme = state.pendingThemeEdits.has(id) ? state.pendingThemeEdits.get(id) : (series.theme || '');
    const themeListId = `theme-options-${toDomId(id)}`;
    form.className = 'maintenance-form';
    form.innerHTML = `
        <div class="maintenance-grid">
            <label class="maintenance-theme">
                <span>活动主题</span>
                <input name="theme" class="filter-input" value="${escapeHtml(currentTheme)}" list="${themeListId}" placeholder="输入活动主题">
                <datalist id="${themeListId}">
                    ${renderThemeOptions(currentTheme)}
                </datalist>
            </label>
        </div>
    `;

    form.querySelector('input[name="theme"]').addEventListener('input', (event) => {
        const theme = event.currentTarget.value.trim();
        if (theme === originalTheme) state.pendingThemeEdits.delete(id);
        else state.pendingThemeEdits.set(id, theme);
        updateCardThemeSaveState();
    });

    return form;
}

function renderMaintenanceActions(series) {
    const actions = document.createElement('div');
    const id = getRecordId(series);
    actions.className = 'maintenance-card-actions';
    actions.innerHTML = `
        <button class="btn btn-primary" type="button" data-card-save-theme>保存主题</button>
        <button class="btn btn-danger" type="button" data-card-delete>删除</button>
    `;
    actions.querySelector('[data-card-save-theme]').addEventListener('click', () => saveCardTheme(series));
    actions.querySelector('[data-card-delete]').addEventListener('click', () => {
        deleteRecords([id], '确定删除这条数据吗？对应的本地图片文件也会被删除。');
    });
    return actions;
}

function renderTextPanel(series) {
    const details = document.createElement('details');
    details.className = 'weibo-text-panel';

    const summary = document.createElement('summary');
    summary.textContent = normalizePlatform(series) === 'xiaohongshu' ? '小红书笔记正文' : '微博文案';
    details.appendChild(summary);

    const content = document.createElement('div');
    content.className = 'weibo-text-content';
    content.textContent = series.text || '暂无文案';
    details.appendChild(content);

    return details;
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
    updateCardThemeSaveState();
}

function updateCardThemeSaveState() {
    if (els.saveCardThemes) {
        els.saveCardThemes.disabled = state.savingThemeEdits || state.pendingThemeEdits.size === 0;
    }
    document.querySelectorAll('[data-card-save-theme]').forEach((button) => {
        const id = button.closest('.series')?.dataset.id;
        const saving = state.savingThemeEdits || state.savingThemeIds.has(id);
        button.disabled = saving || !state.pendingThemeEdits.has(id);
        button.textContent = saving ? '保存中…' : '保存主题';
    });
    document.querySelectorAll('[data-card-delete]').forEach((button) => {
        const id = button.closest('.series')?.dataset.id;
        button.disabled = state.savingThemeIds.has(id);
    });
}

async function saveCardTheme(series) {
    if (state.mode !== 'maintain' || !isMaintenanceEnabled()) return;
    const id = getRecordId(series);
    if (!state.pendingThemeEdits.has(id) || state.savingThemeIds.has(id)) return;
    const theme = state.pendingThemeEdits.get(id);
    state.savingThemeIds.add(id);
    updateCardThemeSaveState();

    try {
        await saveRecordPatchRequest(id, { theme, updatedAt: new Date().toISOString() });
        applyThemeEditsToActiveData(new Map([[id, theme]]));
        if (state.pendingThemeEdits.get(id) === theme) state.pendingThemeEdits.delete(id);
        refreshFacets();
        applyFilterAndRender();
        alert('已保存这条微博的活动主题。');
    } catch (error) {
        alert(error.message || '保存活动主题失败，请确认当前是通过 npm start 启动的服务端项目。');
    } finally {
        state.savingThemeIds.delete(id);
        updateCardThemeSaveState();
    }
}

async function saveCardThemes() {
    if (state.mode !== 'maintain' || !isMaintenanceEnabled()) return;
    const edits = new Map(state.pendingThemeEdits);
    if (!edits.size) return;
    state.savingThemeEdits = true;
    updateCardThemeSaveState();

    try {
        const updatedAt = new Date().toISOString();
        // Each request rewrites the shared metadata file; keep them ordered to avoid read/write races.
        for (const [id, theme] of edits) {
            await saveRecordPatchRequest(id, { theme, updatedAt });
        }
        applyThemeEditsToActiveData(edits);
        edits.forEach((theme, id) => {
            if (state.pendingThemeEdits.get(id) === theme) state.pendingThemeEdits.delete(id);
        });
        refreshFacets();
        applyFilterAndRender();
        alert(`已保存 ${edits.size} 条活动主题。`);
    } catch (error) {
        alert(error.message || '保存活动主题失败，请确认当前是通过 npm start 启动的服务端项目。');
    } finally {
        state.savingThemeEdits = false;
        updateCardThemeSaveState();
    }
}

function applyThemeEditsToActiveData(edits) {
    const activeData = getActiveData();
    activeData.forEach((series, index) => {
        const id = getRecordId(series);
        if (!edits.has(id)) return;
        activeData[index] = applyPatchToSeries(series, { theme: edits.get(id) });
    });
}

function applyPatchToSeries(series, patch) {
    const hasThemePatch = Object.prototype.hasOwnProperty.call(patch, 'theme');
    return {
        ...series,
        theme: hasThemePatch ? patch.theme : series.theme
    };
}

async function saveRecordPatchRequest(id, patch) {
    const response = await fetch('/api/records/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dataType: state.dataType, id, patch })
    });
    const payload = await readJsonResponse(response);
    if (!response.ok) throw new Error(payload.error || `保存失败：${response.status}`);
    return payload;
}

async function readJsonResponse(response) {
    const text = await response.text();
    if (!text.trim()) return {};
    try {
        return JSON.parse(text);
    } catch {
        throw new Error('服务端返回了无效响应，请重启 npm start 后重试。');
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
            state.pendingThemeEdits.delete(String(id));
            state.savingThemeIds.delete(String(id));
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
    const imageFiles = getSeriesImageFiles(series);
    let nextImageIndex = state.modalImageIndex + direction;

    if (nextImageIndex >= 0 && nextImageIndex < imageFiles.length) {
        state.modalImageIndex = nextImageIndex;
    } else if (direction > 0 && state.modalSeriesIndex < state.filteredData.length - 1) {
        state.modalSeriesIndex++;
        state.modalImageIndex = 0;
    } else if (direction < 0 && state.modalSeriesIndex > 0) {
        state.modalSeriesIndex--;
        state.modalImageIndex = getSeriesImageFiles(state.filteredData[state.modalSeriesIndex]).length - 1;
    }

    updateModalContent();
}

function updateModalContent() {
    const series = state.filteredData[state.modalSeriesIndex];
    const imageFiles = getSeriesImageFiles(series);
    const imgSrc = imageFiles[state.modalImageIndex];

    els.modalImage.src = isNoImageActive() ? NO_IMAGE_PLACEHOLDER_SRC : imgSrc;
    if (isNoImageActive()) els.modalImage.dataset.realSrc = imgSrc;
    else delete els.modalImage.dataset.realSrc;
    els.modalImage.alt = series.theme || series.author || '图库图片';
    els.modalTitle.textContent = series.theme || series.author || '图库图片';
    els.modalDescription.textContent = `${formatCardMeta(series)} · ${state.modalImageIndex + 1} / ${imageFiles.length}`;

    const isFirst = state.modalSeriesIndex === 0 && state.modalImageIndex === 0;
    const lastSeries = state.filteredData[state.filteredData.length - 1];
    const lastSeriesImages = getSeriesImageFiles(lastSeries);
    const isLast = state.modalSeriesIndex === state.filteredData.length - 1 &&
        state.modalImageIndex === lastSeriesImages.length - 1;

    els.modalPrev.disabled = isFirst;
    els.modalNext.disabled = isLast;
    els.modalPrev.style.opacity = isFirst ? '0.2' : '1';
    els.modalNext.style.opacity = isLast ? '0.2' : '1';
}

function handleKeyPress(e) {
    if (e.key === 'Escape') {
        closeFilterPopovers();
        if (state.modalOpen) closeModal();
        return;
    }
    if (!state.modalOpen) return;
    if (e.key === 'ArrowLeft') navigateModal(-1);
    if (e.key === 'ArrowRight') navigateModal(1);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}
