document.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('keydown', event => {
    if (event.keyCode === 123 ||
       (event.ctrlKey && event.shiftKey && (event.keyCode === 73 || event.keyCode === 74 || event.key === 'I' || event.key === 'J')) ||
       (event.ctrlKey && (event.keyCode === 85 || event.key === 'U'))) {
        event.preventDefault();
        return false;
    }
});

let CLIENT_RESERVED_NICKNAME_TERMS = [
    'admin', 'administrator', 'moderator', 'operator', 'staff', 'manager',
    '관리자', '운영자', '매니저', '스태프', '공식', '마스터'
];

let CLIENT_BANNED_NICKNAME_TERMS = [
    'fuck', 'shit', 'bitch', 'sex', 'porn', 'penis', 'vagina',
    '섹스', '야동', '보지', '자지', '씨발', '시발', '병신', '좆', '존나'
];

async function loadNicknameBlocklist() {
    try {
        const response = await fetch('/api/nickname-blocklist.csv', { cache: 'no-store' });
        const csvText = await response.text();
        const rows = csvText.replace(/^\uFEFF/, '').split(/\r?\n/).slice(1);
        const reservedTerms = new Set(CLIENT_RESERVED_NICKNAME_TERMS);
        const bannedTerms = new Set(CLIENT_BANNED_NICKNAME_TERMS);

        for (const row of rows) {
            if (!row.trim()) continue;
            const [banned = '', reserved = ''] = row.split(',');
            const bannedValue = banned.trim();
            const reservedValue = reserved.trim();
            if (bannedValue) bannedTerms.add(bannedValue);
            if (reservedValue) reservedTerms.add(reservedValue);
        }

        CLIENT_RESERVED_NICKNAME_TERMS = [...reservedTerms];
        CLIENT_BANNED_NICKNAME_TERMS = [...bannedTerms];
    } catch (e) {
        console.warn('Failed to load nickname blocklist CSV.', e);
    }
}

function validateDisplayNameInput(displayName) {
    const trimmed = (displayName || '').trim();
    if (!trimmed) return 'nickname_required';

    const lowered = trimmed.toLowerCase();
    if (CLIENT_RESERVED_NICKNAME_TERMS.some(term => term.charCodeAt(0) < 128 ? lowered.includes(term) : trimmed.includes(term))) {
        return 'nickname_reserved';
    }
    if (CLIENT_BANNED_NICKNAME_TERMS.some(term => term.charCodeAt(0) < 128 ? lowered.includes(term) : trimmed.includes(term))) {
        return 'nickname_banned';
    }
    if (/[\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]/.test(trimmed)) {
        return 'nickname_jamo_only';
    }
    if (/^[A-Za-z0-9가-힣]{3,14}$/.test(trimmed)) {
        return null;
    }
    return 'nickname_format';
}

function formatWaitTime(seconds) {
    const s = parseInt(seconds) || 0;
    if (state.language === 'ko') {
        if (s >= 60) {
            const m = Math.floor(s / 60);
            const remainingS = s % 60;
            return remainingS > 0 ? `${m}분 ${remainingS}초` : `${m}분`;
        }
        return `${s}초`;
    }

    if (s >= 60) {
        const m = Math.floor(s / 60);
        const remainingS = s % 60;
        const mText = m > 1 ? 'minutes' : 'minute';
        const sText = remainingS > 1 ? 'seconds' : 'second';
        return remainingS > 0 ? `${m} ${mText} ${remainingS} ${sText}` : `${m} ${mText}`;
    }
    return s > 1 ? `${s} seconds` : `${s} second`;
}

function getDisplayNameErrorMessage(errorKey) {
    if (typeof errorKey === 'string' && errorKey.includes(':') && errorKey.startsWith('rate_limit_')) {
        const parts = errorKey.split(':');
        const key = parts[0];
        const waitTime = parts[1] || '0';
        return t(key, { seconds: formatWaitTime(waitTime) });
    }
    return t(errorKey || 'nickname_generic_error');
}

function translateApiDetail(detail) {
    if (!detail) return t('nickname_generic_error');
    return getDisplayNameErrorMessage(detail);
}

function handleNicknameFocus(input) {
    if (!input) return;
    input.dataset.placeholder = input.dataset.placeholder || input.getAttribute('placeholder') || '';
    input.setAttribute('placeholder', '');
}

function handleNicknameBlur(input) {
    if (!input) return;
    if (input.value) return;
    input.setAttribute('placeholder', input.dataset.placeholder || t('nickname_placeholder'));
}

function showAppMessage(message, options = {}) {
    const { tone = 'info', title = '', allowHtml = false } = options;
    const toneMeta = {
        success: { icon: '✓', accent: '#10b981', glow: 'rgba(16,185,129,0.24)' },
        error: { icon: '!', accent: '#ef4444', glow: 'rgba(239,68,68,0.22)' },
        info: { icon: 'i', accent: '#6366f1', glow: 'rgba(99,102,241,0.22)' },
    };

    const meta = toneMeta[tone] || toneMeta.info;
    const overlay = document.createElement('div');
    overlay.className = 'app-modal-overlay';
    const messageMarkup = allowHtml
        ? String(message || '').replace(/\n/g, '<br>')
        : escapeHtml(String(message || '')).replace(/\n/g, '<br>');

    overlay.innerHTML = `
        <div class="app-modal app-modal-${tone}" role="alertdialog" aria-modal="true" aria-live="assertive">
            <div class="app-modal-badge" style="--modal-accent:${meta.accent}; --modal-glow:${meta.glow};">${meta.icon}</div>
            ${title ? `<h3 class="app-modal-title">${escapeHtml(title)}</h3>` : ''}
            <div class="app-modal-message">${messageMarkup}</div>
            <div class="app-modal-actions">
                <button type="button" class="app-modal-confirm">${state.language === 'ko' ? '확인' : 'OK'}</button>
            </div>
        </div>
    `;

    const cleanup = () => overlay.remove();
    document.body.appendChild(overlay);

    overlay.querySelector('.app-modal-confirm')?.addEventListener('click', cleanup);
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) cleanup();
    });
    document.addEventListener('keydown', function handleEscape(event) {
        if (event.key === 'Escape') {
            cleanup();
            document.removeEventListener('keydown', handleEscape);
        }
    }, { once: true });
}

window.alert = function customAlert(message) {
    showAppMessage(message);
};

function getEffectiveEnglishLetterCount(text) {
    let count = 0;
    let previous = null;
    let streak = 0;

    for (const char of text || '') {
        if (!/[A-Za-z]/.test(char)) continue;
        const lowered = char.toLowerCase();
        if (lowered === previous) streak += 1;
        else {
            previous = lowered;
            streak = 1;
        }
        if (streak <= 2) count += 1;
    }

    return count;
}

function validateCommentInput(comment) {
    const trimmed = (comment || '').trim();
    if (!trimmed) return 'comment_required';

    const lowered = trimmed.toLowerCase();
    if (CLIENT_BANNED_NICKNAME_TERMS.some(term => term.charCodeAt(0) < 128 ? lowered.includes(term) : trimmed.includes(term))) {
        return 'comment_banned';
    }

    const completeHangulCount = (trimmed.match(/[가-힣]/g) || []).length;
    const effectiveEnglishCount = getEffectiveEnglishLetterCount(trimmed);
    if (completeHangulCount >= 3 || effectiveEnglishCount >= 4) return null;
    return 'comment_too_short';
}

function getBadgeSeenStorageKey(displayName) {
    return `badge_seen_${displayName}`;
}

function notifyNewUnlockedBadges(mypageData, { shouldNotify = false } = {}) {
    if (!shouldNotify || !mypageData?.display_name) return;
    const storageKey = getBadgeSeenStorageKey(mypageData.display_name);
    const seen = new Set(JSON.parse(localStorage.getItem(storageKey) || '[]'));
    const unlocked = mypageData.unlocked_badge_keys || [];
    const newlyUnlocked = unlocked.filter(key => !seen.has(key));
    if (newlyUnlocked.length) {
        const highlightedBadges = newlyUnlocked
            .map((key) => `<span class="app-modal-highlight">${escapeHtml(t(key))}</span>`)
            .join(', ');
        showAppMessage(t('badge_unlocked_alert', { badges: highlightedBadges }), { tone: 'success', allowHtml: true });
        localStorage.setItem(storageKey, JSON.stringify(unlocked));
    }
}

function syncSeenUnlockedBadges(mypageData) {
    if (!mypageData?.display_name) return;
    localStorage.setItem(getBadgeSeenStorageKey(mypageData.display_name), JSON.stringify(mypageData.unlocked_badge_keys || []));
}

function preserveContentScroll(callback) {
    const contentLayer = document.getElementById('content-layer');
    const previousScrollTop = contentLayer ? contentLayer.scrollTop : 0;
    callback();
    if (contentLayer) {
        requestAnimationFrame(() => {
            contentLayer.scrollTop = previousScrollTop;
        });
    }
}

function rerenderCurrentCommentsView() {
    if (state.currentView?.id === 'results') {
        const resultsCommentsSection = document.getElementById('results-comments-section');
        if (resultsCommentsSection) {
            resultsCommentsSection.innerHTML = renderResultsCommentsSection();
        }
        return;
    }

    if (state.currentView?.id === 'play') {
        const playCommentsContent = document.getElementById('play-comments-content');
        if (playCommentsContent) {
            playCommentsContent.innerHTML = renderPlayModelCommentsContent();
        }
    }
}

async function refreshCurrentCommentsView() {
    if (state.currentView?.id === 'play') {
        await loadSelectedModelComments({ showLoading: false });
        return;
    }

    if (state.currentView?.id === 'results') {
        const data = await apiFetchResults(state.selectedCategory);
        state.isAdmin = !!data.is_admin;
        const results = data.results || [];
        results.forEach(r => {
            const sum = parseFloat(r.avg_control || 0) +
                        parseFloat(r.avg_structure || 0) +
                        parseFloat(r.avg_presentation || 0) +
                        parseFloat(r.avg_difficulty || 0) +
                        parseFloat(r.avg_fun || 0) +
                        parseFloat(r.avg_overall || 0);
            r.avg_total = (sum / 6).toFixed(1);
        });
        results.sort((a, b) => parseFloat(b[state.resultsSort]) - parseFloat(a[state.resultsSort]));
        state.resultsData = results;
        rerenderCurrentCommentsView();
    }
}

function toggleReplies(evaluationId) {
    if (state.expandedCommentIds.has(evaluationId)) state.expandedCommentIds.delete(evaluationId);
    else state.expandedCommentIds.add(evaluationId);
    rerenderCurrentCommentsView();
}

async function submitCommentReply(evaluationId) {
    const replyElement = document.getElementById(`reply-input-${evaluationId}`);
    if (!replyElement) return;

    const replyText = replyElement.value.trim();
    const validationError = validateCommentInput(replyText);
    if (validationError) {
        alert(t(validationError));
        return;
    }
    if (state.pendingReplyIds.has(evaluationId)) return;

    try {
        state.pendingReplyIds.add(evaluationId);
        rerenderCurrentCommentsView();
        const res = await apiSubmitCommentReply(evaluationId, replyText);
        if (!res.ok) {
            const err = await res.json();
            const translatedDetail = translateApiDetail(err?.detail);
            showAppMessage(t('reply_submit_error', { detail: translatedDetail || err?.detail || 'Unknown error' }), { tone: 'error' });
            return;
        }

        state.expandedCommentIds.add(evaluationId);
        await refreshCurrentCommentsView();
    } catch (e) {
        showAppMessage(t('reply_submit_network_error'), { tone: 'error' });
    } finally {
        state.pendingReplyIds.delete(evaluationId);
        rerenderCurrentCommentsView();
    }
}
