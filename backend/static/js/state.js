const API_BASE = '/api';

let state = {
    nickname: '',
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
    signupEmailTimerId: null,
    games: {},
    categories: [],
    selectedCategory: null,
    selectedGame: null,
    userEvals: [],
    myPageData: null,
    resultsData: [],
    playModelCommentsResult: null,
    playCommentsLoading: false,
    resultsSort: 'avg_total',
    commentSort: 'latest',
    profileBadgeSelection: '',
    isLoginSubmitting: false,
    isEvaluationSubmitting: false,
    isAdmin: false,
    adminToken: '',
    privacyReturnView: null,
    pendingReactionIds: new Set(),
    pendingReplyIds: new Set(),
    pendingBlindIds: new Set(),
    expandedCommentIds: new Set()
};

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

function checkEvaluated(gameType, blindModelId) {
    return state.userEvals.some(e => e.game_type === gameType && e.blind_model_id === blindModelId);
}

function getActualModelNameIfEvaluated(gameType, blindModelId) {
    const evalData = state.userEvals.find(e => e.game_type === gameType && e.blind_model_id === blindModelId);
    return evalData ? evalData.actual_model_name : null;
}

function checkAllEvaluated(gameType) {
    const models = state.games[gameType];
    if (!models) return false;
    return models.every(m => checkEvaluated(gameType, m.blind_id));
}
