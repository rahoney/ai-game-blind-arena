async function selectCategory(category) {
    if (!ensureDisplayNameSetupComplete()) return;
    state.selectedCategory = category;
    navigateTo('list', renderGameList);
    apiPrefetchResults(category);
    refreshUserEvaluations({ minFreshMs: 10000 })
        .catch((e) => {
            console.error('User evaluation load failed', e);
        });
}

async function handleLogout() {
    try {
        await signOutAccount();
    } catch (e) {
        console.error('Sign out failed', e);
    }
    state.selectedCategory = null;
    state.selectedGame = null;
    state.userEvals = [];
    state.myPageData = null;
    state.playModelCommentsResult = null;
    state.playCommentsLoading = false;
    state.profileBadgeSelection = '';
    state.isAdmin = false;
    state.resultsCache = {};
    state.resultsRefreshPromises = {};
    navigateTo('home', renderLanding);
}

async function openMyPage() {
    if (!ensureDisplayNameSetupComplete()) return;
    if (state.currentView?.id !== 'mypage') {
        state.myPageReturnView = state.currentView ? { ...state.currentView } : null;
    }
    state.myPageLoading = true;
    navigateTo('mypage', renderMyPage);
    apiFetchMyPage()
        .then((data) => {
            state.profileBadgeSelection = data?.profile_badge_key || '';
            syncSeenUnlockedBadges(data);
            renderGlobalNavigation();
            if (state.currentView?.id === 'mypage') {
                renderMyPage();
            }
        })
        .catch(() => {
            showAppMessage(t('mypage_load_error'), { tone: 'error' });
        })
        .finally(() => {
            state.myPageLoading = false;
            if (state.currentView?.id === 'mypage') {
                renderMyPage();
            }
        });
}

function closeMyPage() {
    const previous = state.myPageReturnView;
    state.myPageReturnView = null;
    if (previous?.func && previous.id !== 'mypage') {
        navigateTo(previous.id, previous.func, ...(previous.args || []));
        return;
    }
    navigateTo('home', renderLanding);
}

function selectProfileBadge(badgeKey) {
    state.profileBadgeSelection = badgeKey;
    renderMyPage();
}

async function saveProfileBadge() {
    if (!state.profileBadgeSelection) return;
    const res = await apiUpdateProfileBadge(state.profileBadgeSelection);
    const data = await res.json();
    if (!res.ok) {
        const translatedDetail = translateApiDetail(data?.detail);
        showAppMessage(t('profile_badge_save_error', { detail: translatedDetail || data?.detail || 'Unknown error' }), { tone: 'error' });
        return;
    }
    if (state.myPageData) {
        state.myPageData.profile_badge_key = data.profile_badge_key;
        state.myPageData.badge = {
            ...(state.myPageData.badge || {}),
            stage_key: data.profile_badge_key,
        };
    }
    if (state.account?.profile) {
        state.account.profile.profile_badge_key = data.profile_badge_key;
    }
    state.profileBadgeSelection = data.profile_badge_key;
    showAppMessage(t('profile_badge_save_success'), { tone: 'success' });
    renderMyPage();
    renderGlobalNavigation();
}

async function setCommentSort(sortKey) {
    state.commentSort = sortKey;
    rerenderCurrentCommentsView();
}

async function toggleCommentReaction(evaluationId, reactionType) {
    if (!canParticipateWithAccount()) {
        openAuthDialog('login');
        return;
    }
    const reactionKey = `${evaluationId}:${reactionType}`;
    if (state.pendingReactionIds.has(reactionKey)) return;
    try {
        state.pendingReactionIds.add(reactionKey);
        rerenderCurrentCommentsView();
        const res = await apiToggleCommentReaction(evaluationId, reactionType);
        const data = await res.json();
        if (!res.ok) {
            showAppMessage(getDisplayNameErrorMessage(data.detail || 'comment_reaction_error'), { tone: 'error' });
            return;
        }
        invalidateResultsCache(state.selectedCategory);
        await refreshCurrentCommentsView();
    } catch (e) {
        showAppMessage(t('comment_reaction_network_error'), { tone: 'error' });
    } finally {
        state.pendingReactionIds.delete(reactionKey);
        rerenderCurrentCommentsView();
    }
}

async function toggleBlindTarget(targetType, targetId, nextBlindState) {
    const blindKey = `${targetType}:${targetId}`;
    if (!state.isAdmin || state.pendingBlindIds.has(blindKey)) return;
    try {
        state.pendingBlindIds.add(blindKey);
        rerenderCurrentCommentsView();
        const res = await apiAdminToggleBlind(targetType, targetId, nextBlindState);
        const data = await res.json();
        if (!res.ok) {
            const translatedDetail = translateApiDetail(data?.detail);
            showAppMessage(t('admin_blind_error', { detail: translatedDetail || data?.detail || 'Unknown error' }), { tone: 'error' });
            return;
        }
        invalidateResultsCache(state.selectedCategory);
        await refreshCurrentCommentsView();
    } catch (e) {
        showAppMessage(t('admin_blind_network_error'), { tone: 'error' });
    } finally {
        state.pendingBlindIds.delete(blindKey);
        rerenderCurrentCommentsView();
    }
}

async function playGame(blindId) {
    if (state.isPlayLaunching) return;
    const isMobileViewport = window.matchMedia?.('(max-width: 768px), (pointer: coarse)').matches;
    if (isMobileViewport && !window.confirm(t('mobile_play_confirm'))) return;
    state.selectedGame = state.games[state.selectedCategory].find(m => m.blind_id === blindId);
    if (!state.selectedGame) return;
    state.isPlayLaunching = true;
    state.playModelCommentsResult = null;
    const cachedResultsData = getCachedResultsData(state.selectedCategory);
    if (cachedResultsData) {
        applySelectedModelCommentsFromResults(cachedResultsData);
    }
    state.playCommentsLoading = !cachedResultsData;
    navigateTo('play', renderPlayArea);

    const selectedCategory = state.selectedCategory;
    const selectedBlindId = blindId;

    apiRecordPlay(selectedCategory, selectedBlindId, state.selectedGame.blind_model_token || '')
        .then(async () => {
            if (!getCurrentProfileDisplayName()) return;
            try {
                const myPageData = await apiFetchMyPage();
                notifyNewUnlockedBadges(myPageData, { shouldNotify: true });
            } catch (e) {
                // Ignore badge refresh failures during play launch.
            }
        })
        .catch(() => {
            // Play launch should not be blocked by statistics recording failures.
        });

    try {
        await loadSelectedModelComments({ showLoading: true });
    } finally {
        state.isPlayLaunching = false;
        if (state.currentView?.id === 'list') {
            renderGameList();
        }
    }
}

function applySelectedModelCommentsFromResults(data) {
    if (!data) return null;
    state.isAdmin = !!data.is_admin;
    const modelResult = (data.results || []).find(result => (
        (state.selectedGame.model_key && result.model_key === state.selectedGame.model_key)
        || (!state.selectedGame.model_key && result.blind_id === state.selectedGame.blind_id)
    )) || null;
    state.playModelCommentsResult = modelResult;
    return modelResult;
}

async function loadSelectedModelComments(options = {}) {
    const { showLoading = false } = options;
    if (!state.selectedCategory || !state.selectedGame) return;

    const cachedData = getCachedResultsData(state.selectedCategory);
    if (cachedData) {
        applySelectedModelCommentsFromResults(cachedData);
        state.playCommentsLoading = false;
    } else {
        state.playCommentsLoading = !!showLoading;
    }

    if (showLoading && state.currentView?.id === 'play') {
        rerenderCurrentCommentsView();
    }

    try {
        const data = await apiFetchResults(state.selectedCategory);
        applySelectedModelCommentsFromResults(data);
    } catch (e) {
        if (!cachedData) {
            state.playModelCommentsResult = null;
        }
    } finally {
        state.playCommentsLoading = false;
        if (state.currentView?.id === 'play') {
            rerenderCurrentCommentsView();
        }
    }
}

async function readResponseErrorDetail(res, fallback = 'Unknown error') {
    try {
        const text = await res.text();
        if (!text) return fallback;
        try {
            const data = JSON.parse(text);
            return data?.detail || text || fallback;
        } catch (parseError) {
            return text || fallback;
        }
    } catch (readError) {
        return fallback;
    }
}

async function submitEvaluation() {
    if (state.isEvaluationSubmitting) return;
    if (!canParticipateWithAccount()) {
        openAuthDialog('login');
        return;
    }
    const missingScoreKeys = EVALUATION_SCORE_KEYS.filter((key) => !state.evaluationTouchedScores.has(key));
    if (missingScoreKeys.length) {
        showAppMessage(t('evaluation_scores_required'), { tone: 'error' });
        return;
    }
    const commentInput = document.getElementById('comment').value.trim();
    const commentValidationError = validateCommentInput(commentInput);
    if (commentValidationError) {
        alert(t(commentValidationError));
        return;
    }

    const payload = {
        game_type: state.selectedCategory,
        blind_model_id: state.selectedGame.blind_id,
        blind_model_token: state.selectedGame.blind_model_token || '',
        score_control: parseInt(document.getElementById('score-control').value),
        score_structure: parseInt(document.getElementById('score-structure').value),
        score_presentation: parseInt(document.getElementById('score-presentation').value),
        score_difficulty: parseInt(document.getElementById('score-difficulty').value),
        score_fun: parseInt(document.getElementById('score-fun').value),
        score_overall: parseInt(document.getElementById('score-overall').value),
        comment: commentInput
    };

    const submitButton = document.getElementById('evaluation-submit-btn');
    try {
        state.isEvaluationSubmitting = true;
        if (submitButton) submitButton.disabled = true;
        let res;
        try {
            res = await apiSubmitEvaluation(payload);
        } catch (requestError) {
            console.error('Evaluation submit request failed', requestError);
            showAppMessage(t('evaluation_submit_network_error'), { tone: 'error' });
            return;
        }

        if (!res.ok) {
            const rawDetail = await readResponseErrorDetail(res, `HTTP ${res.status}`);
            const translatedDetail = translateApiDetail(rawDetail);
            console.error('Evaluation submit response failed', {
                status: res.status,
                detail: rawDetail,
            });
            showAppMessage(t('evaluation_submit_error', { detail: translatedDetail || rawDetail || 'Unknown error' }), { tone: 'error' });
            return;
        }

        try {
            showAppMessage(t('evaluation_submit_success'), { tone: 'success' });
            const commentField = document.getElementById('comment');
            if (commentField) {
                commentField.value = '';
            }
        } catch (uiError) {
            console.error('Evaluation success UI update failed', uiError);
        }

        try {
            await refreshUserEvaluations({ rerender: false, force: true });
        } catch (e) {
            console.error('User evaluation refresh failed after submit', e);
        }

        try {
            const myPageData = await apiFetchMyPage();
            if (myPageData) {
                notifyNewUnlockedBadges(myPageData, { shouldNotify: true });
            }
        } catch (e) {
            console.error('My page refresh failed after submit', e);
        }

        try {
            invalidateResultsCache(state.selectedCategory);
            await loadSelectedModelComments({ showLoading: false });
        } catch (e) {
            console.error('Comment refresh failed after submit', e);
        }
    } catch (unexpectedError) {
        console.error('Unexpected evaluation submit flow error', unexpectedError);
        showAppMessage(t('evaluation_submit_network_error'), { tone: 'error' });
    } finally {
        state.isEvaluationSubmitting = false;
        if (submitButton) submitButton.disabled = false;
    }
}

async function init() {
    await loadDisplayNameBlocklist();
    await apiFetchGames();
    renderLogin();
}
