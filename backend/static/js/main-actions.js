async function selectCategory(category) {
    if (!ensureDisplayNameSetupComplete()) return;
    state.selectedCategory = category;
    try {
        await apiFetchUserEvals();
    } catch (e) {
        console.error('User evaluation load failed', e);
    }
    navigateTo('list', renderGameList);
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
    navigateTo('category', renderCategorySelection);
}

async function openMyPage() {
    if (!ensureDisplayNameSetupComplete()) return;
    try {
        await apiFetchMyPage();
        state.profileBadgeSelection = state.myPageData?.profile_badge_key || '';
        syncSeenUnlockedBadges(state.myPageData);
        navigateTo('mypage', renderMyPage);
    } catch (e) {
        showAppMessage(t('mypage_load_error'), { tone: 'error' });
    }
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
    state.profileBadgeSelection = data.profile_badge_key;
    showAppMessage(t('profile_badge_save_success'), { tone: 'success' });
    renderMyPage();
}

async function setCommentSort(sortKey) {
    state.commentSort = sortKey;
    rerenderCurrentCommentsView();
}

async function toggleCommentReaction(evaluationId, reactionType) {
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
    state.selectedGame = state.games[state.selectedCategory].find(m => m.blind_id === blindId);
    if (!state.selectedGame) return;
    state.isPlayLaunching = true;
    state.playModelCommentsResult = null;
    state.playCommentsLoading = true;
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

async function loadSelectedModelComments(options = {}) {
    const { showLoading = false } = options;
    if (!state.selectedCategory || !state.selectedGame) return;

    state.playCommentsLoading = !!showLoading;
    if (showLoading) {
        rerenderCurrentCommentsView();
    }

    try {
        const data = await apiFetchResults(state.selectedCategory);
        const modelResult = (data.results || []).find(result => (
            (state.selectedGame.model_key && result.model_key === state.selectedGame.model_key)
            || (!state.selectedGame.model_key && result.blind_id === state.selectedGame.blind_id)
        )) || null;
        state.playModelCommentsResult = modelResult;
    } catch (e) {
        state.playModelCommentsResult = null;
    } finally {
        state.playCommentsLoading = false;
        if (state.currentView?.id === 'play') {
            rerenderCurrentCommentsView();
        }
    }
}

async function submitEvaluation() {
    if (state.isEvaluationSubmitting) return;
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
        const res = await apiSubmitEvaluation(payload);
        if (res.ok) {
            showAppMessage(t('evaluation_submit_success'), { tone: 'success' });
            await apiFetchUserEvals();
            const myPageData = await apiFetchMyPage();
            notifyNewUnlockedBadges(myPageData, { shouldNotify: true });
            document.getElementById('comment').value = '';
            await loadSelectedModelComments({ showLoading: false });
        } else {
            const err = await res.json();
            const translatedDetail = translateApiDetail(err?.detail);
            showAppMessage(t('evaluation_submit_error', { detail: translatedDetail || err?.detail || 'Unknown error' }), { tone: 'error' });
        }
    } catch (e) {
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
