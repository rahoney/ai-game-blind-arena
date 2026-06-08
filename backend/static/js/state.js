const API_BASE = '/api';

let state = {
    authUser: null,
    account: null,
    authConfigured: false,
    authReady: false,
    authMode: 'login',
    signupEmailVerification: {
        email: '',
        codeSent: false,
        expiresAt: 0,
        token: '',
    },
    accountEmailChange: {
        open: false,
        email: '',
        codeSent: false,
        expiresAt: 0,
    },
    loginIdAvailability: {
        value: '',
        status: 'idle',
        message: '',
    },
    displayNameAvailability: {
        value: '',
        status: 'idle',
        message: '',
    },
    signupEmailTimerId: null,
    accountEmailChangeTimerId: null,
    games: {},
    categories: [],
    selectedCategory: null,
    selectedGame: null,
    blindSeed: '',
    isPlayLaunching: false,
    userEvals: [],
    myPageData: null,
    mypageAccountManagementOpen: false,
    resultsData: [],
    playModelCommentsResult: null,
    playCommentsLoading: false,
    resultsSort: 'avg_total',
    commentSort: 'latest',
    profileBadgeSelection: '',
    isLoginSubmitting: false,
    isEvaluationSubmitting: false,
    isAdmin: false,
    privacyReturnView: null,
    pendingReactionIds: new Set(),
    pendingReplyIds: new Set(),
    pendingBlindIds: new Set(),
    expandedCommentIds: new Set()
};

function readSessionValue(key) {
    try {
        return sessionStorage.getItem(key) || '';
    } catch (e) {
        return '';
    }
}

function writeSessionValue(key, value) {
    try {
        sessionStorage.setItem(key, value);
    } catch (e) {
        // Session storage may be unavailable in hardened browser contexts.
    }
}

function removeSessionValue(key) {
    try {
        sessionStorage.removeItem(key);
    } catch (e) {
        // Session storage may be unavailable in hardened browser contexts.
    }
}

function createBlindSeed() {
    if (window.crypto?.getRandomValues) {
        const bytes = new Uint32Array(4);
        window.crypto.getRandomValues(bytes);
        return Array.from(bytes, (value) => value.toString(36)).join('');
    }
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

function ensureBlindSeed() {
    if (!state.blindSeed) {
        state.blindSeed = readSessionValue('blind_seed');
    }
    if (!state.blindSeed) {
        state.blindSeed = createBlindSeed();
        writeSessionValue('blind_seed', state.blindSeed);
    }
    return state.blindSeed;
}

function resetBlindSeed() {
    state.blindSeed = createBlindSeed();
    writeSessionValue('blind_seed', state.blindSeed);
    return state.blindSeed;
}

function clearBlindSeed() {
    state.blindSeed = '';
    removeSessionValue('blind_seed');
    removeSessionValue('blind_seed_uid');
}

function syncBlindSeedForAuthUser(uid) {
    if (!uid) {
        clearBlindSeed();
        return;
    }
    const previousUid = readSessionValue('blind_seed_uid');
    if (previousUid !== uid || !readSessionValue('blind_seed')) {
        resetBlindSeed();
        writeSessionValue('blind_seed_uid', uid);
        return;
    }
    state.blindSeed = readSessionValue('blind_seed');
}

// HTML Escaping function to prevent XSS attacks
function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function checkEvaluated(gameType, modelRef) {
    return state.userEvals.some(e => (
        e.game_type === gameType
        && (
            (modelRef?.model_key && e.model_key === modelRef.model_key)
            || (!modelRef?.model_key && e.blind_model_id === modelRef?.blind_id)
            || e.blind_model_id === modelRef
        )
    ));
}

function getActualModelNameIfEvaluated(gameType, modelRef) {
    const evalData = state.userEvals.find(e => (
        e.game_type === gameType
        && (
            (modelRef?.model_key && e.model_key === modelRef.model_key)
            || (!modelRef?.model_key && e.blind_model_id === modelRef?.blind_id)
            || e.blind_model_id === modelRef
        )
    ));
    return evalData ? evalData.actual_model_name : null;
}

function checkAllEvaluated(gameType) {
    const models = state.games[gameType];
    if (!models) return false;
    return models.every(m => checkEvaluated(gameType, m));
}
