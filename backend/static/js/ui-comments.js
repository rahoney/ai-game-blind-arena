function formatCommentDate(createdAt) {
    return createdAt ? new Date(createdAt).toLocaleString(state.language === 'ko' ? 'ko-KR' : 'en-US') : '';
}

const COMMENT_PROFILE_PANEL_BG = 'var(--surface-bg)';
const COMMENT_PROFILE_PANEL_TEXT = 'var(--text-color)';
const COMMENT_CONTENT_PANEL_BG = 'var(--card-bg)';
const COMMENT_CONTENT_PANEL_BORDER = 'var(--border-color)';
const COMMENT_CONTENT_TEXT = 'var(--text-color)';
const COMMENT_CONTENT_MUTED = 'var(--text-muted)';
const COMMENT_REPLY_SECTION_BG = 'var(--surface-elevated)';
const COMMENT_TEXTAREA_BG = 'var(--surface-bg)';
const COMMENT_TEXTAREA_BORDER = 'var(--border-color)';

function isMobileCommentLayout() {
    return typeof window !== 'undefined' && window.matchMedia?.('(max-width: 640px)').matches;
}

function renderCommentReactionButton(comment, reactionType, symbol, count, activeColor) {
    const canInteract = canParticipateWithAccount();
    const isActive = comment.user_reaction === reactionType;
    const isPending = state.pendingReactionIds.has(`${comment.id}:${reactionType}`);
    const isMobile = isMobileCommentLayout();
    return `
        <button type="button" ${canInteract ? `onclick="toggleCommentReaction('${comment.id}', '${reactionType}')"` : '' }
            ${(!canInteract || isPending) ? 'disabled' : ''}
            style="display:inline-flex; align-items:center; gap:${isMobile ? '0.12rem' : '0.28rem'}; padding:0; border:none; background:transparent; color:${isActive ? activeColor : COMMENT_CONTENT_TEXT}; cursor:${(!canInteract || isPending) ? 'not-allowed' : 'pointer'}; font-weight:800; opacity:${(!canInteract || isPending) ? '0.45' : '1'}; width:auto; min-width:auto; box-shadow:none; font-size:${isMobile ? '0.72rem' : '1rem'};">
            <span style="font-size:${isMobile ? '0.74rem' : '1.12rem'}; line-height:1;">${symbol}</span>
            <span>${count}</span>
        </button>
    `;
}

function renderReplyCard(reply) {
    const blindKey = `reply:${reply.id}`;
    const isPendingBlind = state.pendingBlindIds.has(blindKey);
    const isMobile = isMobileCommentLayout();
    const replyProfileWidth = isMobile ? 44 : 72;
    const replyBadgeSize = isMobile ? 28 : 44;
    const blindButton = state.isAdmin ? `
        <button type="button" onclick="toggleBlindTarget('reply', '${reply.id}', ${reply.is_blinded ? 'false' : 'true'})"
            ${isPendingBlind ? 'disabled' : ''}
            style="width:auto; padding:${isMobile ? '0.25rem 0.42rem' : '0.45rem 0.7rem'}; font-size:${isMobile ? '0.66rem' : '0.8rem'}; border-radius:999px; opacity:${isPendingBlind ? '0.6' : '1'}; cursor:${isPendingBlind ? 'not-allowed' : 'pointer'};">
            ${reply.is_blinded ? t('admin_unblind') : t('admin_blind')}
        </button>
    ` : '';

    return `
        <div style="display:grid; grid-template-columns:${replyProfileWidth}px minmax(0, 1fr); gap:${isMobile ? '0.45rem' : '0.9rem'}; padding:${isMobile ? '0.45rem 0' : '0.85rem 0'}; border-top:1px solid var(--border-color); min-width:0;">
            <div style="display:flex; flex-direction:column; align-items:center; gap:${isMobile ? '0.18rem' : '0.35rem'}; background:${COMMENT_PROFILE_PANEL_BG}; padding:${isMobile ? '0.32rem 0.2rem' : '0.55rem 0.45rem'}; border-radius:${isMobile ? '10px' : '16px'}; color:${COMMENT_PROFILE_PANEL_TEXT}; box-shadow:0 10px 24px rgba(0, 0, 0, 0.16); border:1px solid var(--border-color); min-width:0;">
                <div style="width:${replyBadgeSize}px; height:${replyBadgeSize}px;">${renderBadgeSvg(reply.badge?.stage_key || 'badge_egg', replyBadgeSize)}</div>
                <div style="font-size:${isMobile ? '0.58rem' : '0.78rem'}; font-weight:700; text-align:center; line-height:1.25; word-break:break-word; max-width:100%;">${escapeHtml(reply.display_name)}</div>
            </div>
            <div style="border:1px solid ${COMMENT_CONTENT_PANEL_BORDER}; border-radius:${isMobile ? '10px' : '14px'}; padding:${isMobile ? '0.48rem 0.55rem' : '0.8rem 0.9rem'}; background:${COMMENT_CONTENT_PANEL_BG}; box-shadow:0 8px 24px rgba(0, 0, 0, 0.16); min-width:0;">
                <div style="display:flex; justify-content:space-between; gap:${isMobile ? '0.35rem' : '1rem'}; align-items:flex-start; margin-bottom:0.25rem;">
                    <div style="font-size:${isMobile ? '0.58rem' : '0.8rem'}; color:${COMMENT_CONTENT_MUTED};">${formatCommentDate(reply.created_at)}</div>
                    <div style="display:flex; align-items:center; gap:${isMobile ? '0.3rem' : '0.6rem'};">
                        ${blindButton}
                    </div>
                </div>
                <div style="font-size:${isMobile ? '0.72rem' : '0.95rem'}; line-height:${isMobile ? '1.4' : '1.55'}; white-space:pre-wrap; overflow-wrap:anywhere; color:${reply.is_blinded ? COMMENT_CONTENT_MUTED : COMMENT_CONTENT_TEXT};">${reply.is_blinded && !state.isAdmin ? t('blinded_message') : escapeHtml(reply.reply)}</div>
            </div>
        </div>
    `;
}

function renderCommentCard(comment, options = {}) {
    const {
        actual_model_name = '',
        includeModelName = false,
        compact = false,
    } = options;
    const canInteract = canParticipateWithAccount();
    const isExpanded = canInteract && state.expandedCommentIds.has(comment.id);
    const isPendingReply = state.pendingReplyIds.has(comment.id);
    const replies = comment.replies || [];
    const blindKey = `comment:${comment.id}`;
    const isPendingBlind = state.pendingBlindIds.has(blindKey);
    const isMobile = isMobileCommentLayout();
    const badgeSize = isMobile ? 24 : (compact ? 64 : 72);
    const profileColumnWidth = compact ? 92 : 100;
    const profileBoxPadding = isMobile ? '0.18rem 0.3rem' : (compact ? '0.8rem 0.5rem' : '0.9rem 0.6rem');
    const profileRadius = isMobile ? '8px' : (compact ? '18px' : '20px');
    const contentPadding = isMobile ? '0.58rem 0.65rem' : (compact ? '1rem 1.05rem' : '1rem 1.1rem');
    const commentGap = isMobile ? '0.28rem' : (compact ? '1rem' : '1.2rem');
    const panelRadius = isMobile ? '12px' : '18px';
    const mobileCommentGrid = isMobile ? 'minmax(0, 1fr)' : `${profileColumnWidth}px minmax(0, 1fr)`;
    const profileDirection = isMobile ? 'row' : 'column';

    const repliesHtml = isExpanded
        ? `
            <div style="margin-top:${isMobile ? '0.55rem' : '1rem'}; padding:${isMobile ? '0.55rem' : '0.9rem 1rem'}; border-radius:${isMobile ? '10px' : '14px'}; background:${COMMENT_REPLY_SECTION_BG}; border:1px solid var(--border-color); min-width:0;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:${isMobile ? '0.4rem' : '1rem'}; margin-bottom:${isMobile ? '0.45rem' : '0.75rem'};">
                    <div style="font-size:${isMobile ? '0.68rem' : '0.95rem'}; font-weight:700; color:${COMMENT_CONTENT_MUTED};">${t('replies_count', { count: replies.length })}</div>
                    <button type="button" class="secondary" onclick="toggleReplies('${comment.id}')" ${canInteract ? '' : 'disabled'} style="width:auto; min-height:0; height:auto; padding:${isMobile ? '0.18rem 0.45rem' : '0.55rem 0.9rem'}; font-size:${isMobile ? '0.66rem' : '0.95rem'}; line-height:1.15; opacity:${canInteract ? '1' : '0.55'}; cursor:${canInteract ? 'pointer' : 'not-allowed'};">${t('replies_toggle_close')}</button>
                </div>
                <div style="margin-bottom:${isMobile ? '0.5rem' : '0.9rem'};">
                    ${replies.length ? replies.map(renderReplyCard).join('') : `<div style="padding:0.35rem 0; color:${COMMENT_CONTENT_MUTED};">${t('replies_empty')}</div>`}
                </div>
                <div style="display:grid; gap:${isMobile ? '0.45rem' : '0.65rem'};">
                    <textarea id="reply-input-${comment.id}" rows="3" maxlength="150" placeholder="${t('reply_placeholder')}" style="width:100%; padding:${isMobile ? '0.62rem' : '1rem'}; font-size:${isMobile ? '0.78rem' : '0.98rem'}; border-radius:${isMobile ? '9px' : '12px'}; background:${COMMENT_TEXTAREA_BG}; color:${COMMENT_CONTENT_TEXT}; border:1px solid ${COMMENT_TEXTAREA_BORDER}; line-height:1.5;"></textarea>
                    <div style="display:flex; justify-content:flex-end;">
                        <button type="button" onclick="submitCommentReply('${comment.id}')" ${isPendingReply ? 'disabled' : ''} style="width:auto; min-height:0; height:auto; padding:${isMobile ? '0.22rem 0.6rem' : '0.75rem 1rem'}; font-size:${isMobile ? '0.72rem' : '0.95rem'}; line-height:1.15; opacity:${isPendingReply ? '0.65' : '1'}; cursor:${isPendingReply ? 'not-allowed' : 'pointer'};">${t('reply_submit')}</button>
                    </div>
                </div>
            </div>
        `
        : `
            <div style="display:flex; align-items:center; gap:${isMobile ? '0.4rem' : '0.8rem'}; margin-top:${isMobile ? '0.55rem' : '1rem'};">
                <div style="font-size:${isMobile ? '0.68rem' : '0.95rem'}; font-weight:700; color:${COMMENT_CONTENT_MUTED};">${t('replies_count', { count: replies.length })}</div>
                <button type="button" class="secondary" onclick="toggleReplies('${comment.id}')" ${canInteract ? '' : 'disabled'} style="width:auto; min-height:0; height:auto; padding:${isMobile ? '0.18rem 0.45rem' : '0.55rem 0.9rem'}; font-size:${isMobile ? '0.66rem' : '0.95rem'}; line-height:1.15; opacity:${canInteract ? '1' : '0.55'}; cursor:${canInteract ? 'pointer' : 'not-allowed'};">${t('replies_toggle_open')}</button>
            </div>
        `;

    return `
        <div class="comment-card-wrap" style="max-width:1100px; margin:0 auto ${isMobile ? '0.65rem' : '1.2rem'}; min-width:0;">
            <div style="display:grid; grid-template-columns:${mobileCommentGrid}; gap:${commentGap}; align-items:start; width:100%; min-width:0;">
                <div style="display:flex; flex-direction:${profileDirection}; align-items:center; justify-content:${isMobile ? 'flex-start' : 'center'}; gap:${isMobile ? '0.32rem' : '0.55rem'}; background:${COMMENT_PROFILE_PANEL_BG}; padding:${profileBoxPadding}; border-radius:${profileRadius}; color:${COMMENT_PROFILE_PANEL_TEXT}; box-shadow:0 14px 32px rgba(0, 0, 0, 0.18); border:1px solid var(--border-color); min-width:0; width:${isMobile ? 'fit-content' : 'auto'}; max-width:100%;">
                    <div style="width:${badgeSize}px; height:${badgeSize}px;">${renderBadgeSvg(comment.badge?.stage_key || 'badge_egg', badgeSize)}</div>
                    <div style="font-size:${isMobile ? '0.64rem' : '0.84rem'}; font-weight:800; text-align:${isMobile ? 'left' : 'center'}; line-height:1.2; word-break:break-word; max-width:100%;">${escapeHtml(comment.display_name)}</div>
                </div>
                <div style="border:1px solid ${COMMENT_CONTENT_PANEL_BORDER}; border-radius:${panelRadius}; background:${COMMENT_CONTENT_PANEL_BG}; padding:${contentPadding}; box-shadow:0 14px 32px rgba(0, 0, 0, 0.18); min-width:0; overflow:hidden;">
                    <div style="display:flex; justify-content:space-between; gap:${isMobile ? '0.4rem' : '1rem'}; align-items:flex-start; margin-bottom:${isMobile ? '0.35rem' : '0.55rem'};">
                        <div>
                            <div style="font-size:${isMobile ? '0.58rem' : '0.82rem'}; color:${COMMENT_CONTENT_MUTED};">${formatCommentDate(comment.created_at)}</div>
                            ${includeModelName ? `<div style="font-size:${isMobile ? '0.72rem' : '0.94rem'}; font-weight:800; color:${COMMENT_CONTENT_TEXT}; margin-top:0.18rem;">${escapeHtml(actual_model_name)}</div>` : ''}
                        </div>
                        <div style="display:flex; gap:${isMobile ? '0.34rem' : '0.8rem'}; flex-wrap:nowrap; align-items:center; justify-content:flex-end;">
                            ${renderCommentReactionButton(comment, 'like', '👍', comment.like_count || 0, '#ef4444')}
                            ${renderCommentReactionButton(comment, 'dislike', '👎', comment.dislike_count || 0, 'var(--text-muted)')}
                            ${state.isAdmin ? `
                                <button type="button" onclick="toggleBlindTarget('comment', '${comment.id}', ${comment.is_blinded ? 'false' : 'true'})"
                                    ${isPendingBlind ? 'disabled' : ''}
                                    style="width:auto; padding:${isMobile ? '0.25rem 0.42rem' : '0.45rem 0.7rem'}; font-size:${isMobile ? '0.66rem' : '0.8rem'}; border-radius:999px; opacity:${isPendingBlind ? '0.6' : '1'}; cursor:${isPendingBlind ? 'not-allowed' : 'pointer'};">
                                    ${comment.is_blinded ? t('admin_unblind') : t('admin_blind')}
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    <div style="font-size:${isMobile ? '0.78rem' : '1rem'}; line-height:${isMobile ? '1.45' : '1.65'}; white-space:pre-wrap; overflow-wrap:anywhere; color:${comment.is_blinded ? COMMENT_CONTENT_MUTED : COMMENT_CONTENT_TEXT};">${comment.is_blinded && !state.isAdmin ? t('blinded_message') : escapeHtml(comment.comment)}</div>
                    ${repliesHtml}
                </div>
            </div>
        </div>
    `;
}

function renderCommentParticipationNotice() {
    if (canParticipateWithAccount()) return '';
    return `
        <div class="comment-login-notice">
            <div class="comment-login-notice-text">${t('comment_login_required_notice')}</div>
            <button type="button" class="primary-action comment-login-notice-button" onclick="openAuthDialog('login')">${t('menu_login')}</button>
        </div>
    `;
}

function renderPlayModelCommentsContent() {
    if (state.playCommentsLoading) {
        return `<div style="color:var(--text-muted);">${t('play_comments_loading')}</div>`;
    }

    const modelResult = state.playModelCommentsResult;
    const comments = [...(modelResult?.comments || [])]
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const title = t('play_comments_title');

    if (!comments.length) {
        return `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1rem;">
                <h3 style="margin:0; color:var(--primary);">${title}</h3>
                <div style="font-size:0.92rem; color:var(--text-muted);">${t('comments_count', { count: 0 })}</div>
            </div>
            ${renderCommentParticipationNotice()}
            <div style="color:var(--text-muted);">${t('play_comments_empty')}</div>
        `;
    }

    return `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1rem;">
            <h3 style="margin:0; color:var(--primary);">${title}</h3>
            <div style="font-size:0.92rem; color:var(--text-muted);">${t('comments_count', { count: comments.length })}</div>
        </div>
        ${renderCommentParticipationNotice()}
        ${comments.map((comment) => renderCommentCard(comment, { compact: true })).join('')}
    `;
}

function renderPlayModelCommentsSection() {
    return `
        <div class="card play-comments-card" style="max-width:1100px; margin:0 auto;">
            <div id="play-comments-content">
                ${renderPlayModelCommentsContent()}
            </div>
        </div>
    `;
}

function getSortedCommentEntries(results = state.resultsData || []) {
    const commentEntries = results.flatMap((result) =>
        (result.comments || []).map((comment) => ({
            actual_model_name: result.actual_model_name,
            blind_id: result.blind_id,
            comment,
        }))
    );

    return [...commentEntries].sort((a, b) => {
        if (state.commentSort === 'likes' && (b.comment.like_count || 0) !== (a.comment.like_count || 0)) {
            return (b.comment.like_count || 0) - (a.comment.like_count || 0);
        }
        return new Date(b.comment.created_at || 0) - new Date(a.comment.created_at || 0);
    });
}

function renderResultsCommentsSection(results = state.resultsData || []) {
    const sortedCommentEntries = getSortedCommentEntries(results);
    const lockedModelNames = getLockedTopResultModelNames(results);
    const commentsSectionsHtml = sortedCommentEntries.length ? `
        <div class="card results-comments-card" style="margin-top: 1.5rem; padding:1.5rem 1.25rem; max-width:100%;">
            ${sortedCommentEntries.map((entry) => {
                const isLockedModel = lockedModelNames.has(entry.actual_model_name);
                return renderCommentCard(entry.comment, {
                    actual_model_name: isLockedModel ? '' : entry.actual_model_name,
                    includeModelName: !isLockedModel,
                });
            }).join('')}
        </div>
    ` : `
        <div class="card" style="margin-top: 1.5rem; color: var(--text-muted); text-align: center;">
            ${t('comments_no_models')}
        </div>
    `;

    return `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-top:2.5rem; margin-bottom:0.5rem;">
            <h3 style="margin:0; color:var(--primary); font-size:1.6rem;">${t('comments_section_title')}</h3>
            <div style="display:flex; gap:0.6rem; flex-wrap:wrap;">
                <button type="button" class="comment-sort-button ${state.commentSort === 'latest' ? 'active' : ''}" onclick="setCommentSort('latest')">${t('comments_sort_latest')}</button>
                <button type="button" class="comment-sort-button ${state.commentSort === 'likes' ? 'active' : ''}" onclick="setCommentSort('likes')">${t('comments_sort_likes')}</button>
            </div>
        </div>
        ${renderCommentParticipationNotice()}
        ${commentsSectionsHtml}
    `;
}

function hasEvaluatedCurrentCategory() {
    if (!state.selectedCategory) return false;
    return state.userEvals.some((item) => item.game_type === state.selectedCategory);
}

function shouldLockTopResultModelNames() {
    return !state.isAdmin && !hasEvaluatedCurrentCategory();
}

function getLockedTopResultModelNames(results = state.resultsData || []) {
    if (!shouldLockTopResultModelNames()) return new Set();
    return new Set(results.slice(0, 3).map((item) => item.actual_model_name).filter(Boolean));
}

function renderLockedResultModelName(rankNumber) {
    return `
        <div class="results-model-lock" aria-label="${t('results_model_locked_label')}">
            <span class="results-model-lock-icon" aria-hidden="true">🔒</span>
            <span class="results-model-lock-bars" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
            </span>
            <span class="results-model-lock-rank">Top ${rankNumber}</span>
        </div>
    `;
}

async function renderResults(sortKey = state.resultsSort || 'avg_total', options = {}) {
    const { preserveScroll = false } = options;
    const el = document.getElementById('view-results');
    if (!el) return;
    state.resultsSort = sortKey;
    const contentLayer = document.getElementById('content-layer');
    const previousScrollTop = preserveScroll && contentLayer ? contentLayer.scrollTop : 0;
    const cachedResultsData = getCachedResultsData(state.selectedCategory);

    if (!cachedResultsData) {
        el.innerHTML = `
            <div style="width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                <div style="font-size: 1.5rem; color: var(--text-muted);">Loading results...</div>
            </div>
        `;
    }

    try {
        let data = cachedResultsData;
        if (!data && state.resultsRefreshPromises?.[state.selectedCategory]) {
            data = await state.resultsRefreshPromises[state.selectedCategory];
        }
        if (!data) {
            data = await apiFetchResults(state.selectedCategory);
        }
        state.isAdmin = !!data.is_admin;
        const results = data.results || [];

        results.forEach((r) => {
            const sum = parseFloat(r.avg_control || 0) +
                        parseFloat(r.avg_structure || 0) +
                        parseFloat(r.avg_presentation || 0) +
                        parseFloat(r.avg_difficulty || 0) +
                        parseFloat(r.avg_fun || 0) +
                        parseFloat(r.avg_overall || 0);
            r.avg_total = (sum / 6).toFixed(1);
        });

        results.sort((a, b) => parseFloat(b[sortKey]) - parseFloat(a[sortKey]));
        state.resultsData = results;
        const lockedModelNames = getLockedTopResultModelNames(results);
        const shouldShowResultsLockNotice = lockedModelNames.size > 0;
        const lockNoticeRowHtml = shouldShowResultsLockNotice ? `
            <tr class="results-lock-notice-row">
                <td colspan="10">
                    <div class="results-lock-notice">${t('results_top_models_locked_notice')}</div>
                </td>
            </tr>
        ` : '';

        const getHeader = (key, label) => {
            const isActive = sortKey === key;
            const arrow = isActive ? ' ↓' : '';
            return `<th class="results-header-cell results-sort-header ${isActive ? 'active' : ''}" onclick="renderResults('${key}')"><span>${label}${arrow}</span></th>`;
        };

        const rowsHtml = results.map((r, index) => {
            const rankNumber = index + 1;
            const isModelNameLocked = lockedModelNames.has(r.actual_model_name);
            let rankHtml = `${index + 1}`;
            let rowStyle = 'border-bottom: 1px solid var(--border-color); transition: background 0.3s;';
            let medal = '';

            if (index === 0) {
                rankHtml = `<span style="font-size: 1.4rem;">🥇</span>`;
                rowStyle += ' background: rgba(251, 191, 36, 0.1); font-weight: bold;';
                medal = `<div style="font-size:0.75rem; color: #fbbf24; margin-top: 2px;">Highest</div>`;
            } else if (index === 1) {
                rankHtml = `<span style="font-size: 1.2rem;">🥈</span>`;
                rowStyle += ' background: rgba(148, 163, 184, 0.08);';
            } else if (index === 2) {
                rankHtml = `<span style="font-size: 1.1rem;">🥉</span>`;
                rowStyle += ' background: rgba(180, 83, 9, 0.08);';
            }

            return `
                <tr style="${rowStyle}">
                    <td style="padding: 1.2rem 0.5rem; text-align: center; font-weight: 700;">${rankHtml}</td>
                    <td style="padding: 1.2rem 0.8rem; text-align: left; min-width: 150px;">
                        ${isModelNameLocked ? renderLockedResultModelName(rankNumber) : `<strong style="font-size: 1.05rem; display: block; line-height: 1.2;">${escapeHtml(r.actual_model_name)}</strong>`}
                        ${medal}
                    </td>
                    <td style="padding: 1rem 0.5rem; text-align: center; font-weight: 900; color: var(--primary); font-size: 1.1rem; background: rgba(99, 102, 241, 0.05);">${r.avg_total}</td>
                    <td style="padding: 1rem 0.5rem; text-align: center;">${r.avg_control}</td>
                    <td style="padding: 1rem 0.5rem; text-align: center;">${r.avg_structure}</td>
                    <td style="padding: 1rem 0.5rem; text-align: center;">${r.avg_presentation}</td>
                    <td style="padding: 1rem 0.5rem; text-align: center;">${r.avg_difficulty}</td>
                    <td style="padding: 1rem 0.5rem; text-align: center;">${r.avg_fun}</td>
                    <td style="padding: 1rem 0.5rem; text-align: center;">${r.avg_overall}</td>
                    <td style="padding: 1rem 0.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">${r.participant_count}</td>
                </tr>
            `;
        }).join('');

        el.innerHTML = `
            <div class="results-page-shell">
                <div class="results-page-heading">
                    <button class="secondary" style="width: auto;" onclick="navigateTo('list', renderGameList)">← ${t('btn_back')}</button>
                    <h2 style="font-size: 2.2rem; color: var(--primary); margin: 0;">${state.language === 'ko' ? '전체 모델 비교 평가' : 'Overall Model Comparison'}</h2>
                    <div style="width: 100px;"></div>
                </div>
                <div class="card results-table-shell">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th class="results-header-cell">Rank</th>
                                <th class="results-header-cell results-model-header">Model</th>
                                ${getHeader('avg_total', t('eval_total'))}
                                ${getHeader('avg_control', t('eval_control'))}
                                ${getHeader('avg_structure', t('eval_structure'))}
                                ${getHeader('avg_presentation', t('eval_presentation'))}
                                ${getHeader('avg_difficulty', t('eval_difficulty'))}
                                ${getHeader('avg_fun', t('eval_fun'))}
                                ${getHeader('avg_overall', t('eval_overall'))}
                                <th class="results-header-cell results-evaluator-header">${state.language === 'ko' ? '평가자 수' : 'Evaluators'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${lockNoticeRowHtml}
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
                <div id="results-comments-section">
                    ${renderResultsCommentsSection(results)}
                </div>
            </div>
        `;
        if (preserveScroll && contentLayer) {
            requestAnimationFrame(() => {
                contentLayer.scrollTop = previousScrollTop;
            });
        }
    } catch (e) {
        el.innerHTML = `
            <div style="text-align: center;">
                <p style="color: #ef4444; font-size: 1.2rem;">Failed to load results.</p>
                <button class="secondary" onclick="navigateTo('list', renderGameList)">← ${t('btn_back')}</button>
            </div>
        `;
        if (preserveScroll && contentLayer) {
            requestAnimationFrame(() => {
                contentLayer.scrollTop = previousScrollTop;
            });
        }
    }
}
