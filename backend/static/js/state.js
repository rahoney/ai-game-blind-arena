const RUNTIME_CONFIG = Object.freeze({
    environment: window.VEILPLAYS_CONFIG?.environment || 'development',
    frontendOrigin: window.VEILPLAYS_CONFIG?.frontendOrigin || '',
    apiOrigin: window.VEILPLAYS_CONFIG?.apiOrigin || '',
    gaMeasurementId: window.VEILPLAYS_CONFIG?.gaMeasurementId || '',
});

function resolveRuntimeOrigin(value, fallbackOrigin) {
    try {
        return new URL(value || fallbackOrigin).origin;
    } catch (e) {
        return fallbackOrigin;
    }
}

const FRONTEND_ORIGIN = resolveRuntimeOrigin(RUNTIME_CONFIG.frontendOrigin, window.location.origin);
const API_ORIGIN = resolveRuntimeOrigin(RUNTIME_CONFIG.apiOrigin, window.location.origin);
const API_BASE = `${API_ORIGIN}/api`;

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
    accountDisplayNameChange: {
        open: false,
        displayName: '',
        available: null,
        checking: false,
        submitting: false,
    },
    accountLoginIdSetup: {
        open: false,
        email: '',
        codeSent: false,
        expiresAt: 0,
        token: '',
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
    accountLoginIdSetupTimerId: null,
    games: {},
    categories: [],
    gamesLoading: false,
    gamesRefreshPromise: null,
    selectedCategory: null,
    selectedGame: null,
    blindSeed: '',
    isPlayLaunching: false,
    userEvals: [],
    userEvalsLoading: false,
    userEvalsRefreshPromise: null,
    userEvalsFetchedAt: 0,
    myPageData: null,
    myPageLoading: false,
    myPageReturnView: null,
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
    authBusyContext: '',
    authPerformance: [],
    authDialogOpen: false,
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
    if (unsafe === null || typeof unsafe === 'undefined') return "";
    return String(unsafe)
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
