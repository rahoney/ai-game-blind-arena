async function apiFetchGames() {
    const lang = state.language || 'ko';
    const res = await fetch(`${API_BASE}/games?lang=${lang}`);
    const data = await res.json();
    state.games = data.games;
    state.categories = data.categories || [];
}

async function apiFetchAuthConfig() {
    const res = await fetch(`${API_BASE}/auth/config`, { cache: 'no-store' });
    return await res.json();
}

async function apiFetchAuthMe(idToken) {
    const res = await fetch(`${API_BASE}/auth/me`, {
        headers: {
            'Authorization': `Bearer ${idToken}`
        }
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.detail || 'auth_failed');
    }
    return data;
}

async function apiUpdateProfileDisplayName(idToken, displayName) {
    const res = await fetch(`${API_BASE}/profile/display-name`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ display_name: displayName })
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.detail || 'profile_display_name_error');
    }
    return data;
}

async function apiUpdateProfileIdentity(idToken, payload) {
    const res = await fetch(`${API_BASE}/profile/identity`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.detail || 'profile_identity_error');
    }
    return data;
}

async function apiRequestSignupEmailCode(email) {
    const res = await fetch(`${API_BASE}/auth/signup/email-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.detail || 'mail_send_failed');
    }
    return data;
}

async function apiConfirmSignupEmailCode(email, code) {
    const res = await fetch(`${API_BASE}/auth/signup/confirm-email-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.detail || 'invalid_verification_code');
    }
    return data;
}

async function apiRecoverLoginId(payload) {
    const res = await fetch(`${API_BASE}/auth/recovery/find-login-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.detail || 'invalid_recovery_input');
    }
    return data;
}

async function apiRecoverPassword(payload) {
    const res = await fetch(`${API_BASE}/auth/recovery/password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.detail || 'invalid_recovery_input');
    }
    return data;
}

async function apiSendLoginIdEmail(payload) {
    const res = await fetch(`${API_BASE}/auth/recovery/send-login-id-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.detail || 'mail_send_failed');
    }
    return data;
}

async function apiUpdateSocialProviders(idToken, providers) {
    const res = await fetch(`${API_BASE}/profile/social-providers`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ providers })
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.detail || 'social_provider_update_error');
    }
    return data;
}

async function apiFetchUserEvals() {
    if (!state.nickname) return;
    const res = await fetch(`${API_BASE}/user_evals/${state.nickname}`);
    const data = await res.json();
    state.userEvals = data.evals;
}

async function apiNicknameLogin(nickname) {
    return await fetch(`${API_BASE}/nickname/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname })
    });
}

async function apiRecordPlay(gameType, blindId) {
    await fetch(`${API_BASE}/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_type: gameType, blind_model_id: blindId, nickname: state.nickname || null })
    });
    // Refresh game list behind the scenes to update play count
    await apiFetchGames();
}

async function apiSubmitEvaluation(payload) {
    return await fetch(`${API_BASE}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}

async function apiFetchResults(gameType) {
    const nicknameQuery = state.nickname ? `?nickname=${encodeURIComponent(state.nickname)}` : '';
    const headers = state.adminToken ? { 'X-Admin-Token': state.adminToken } : {};
    const res = await fetch(`${API_BASE}/results/${gameType}${nicknameQuery}`, { headers });
    return await res.json();
}

async function apiFetchMyPage() {
    if (!state.nickname) return null;
    const res = await fetch(`${API_BASE}/mypage/${encodeURIComponent(state.nickname)}`);
    const data = await res.json();
    state.myPageData = data;
    return data;
}

async function apiUpdateProfileBadge(badgeKey) {
    return await fetch(`${API_BASE}/mypage/profile-badge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            nickname: state.nickname,
            badge_key: badgeKey
        })
    });
}

async function apiToggleCommentReaction(evaluationId, reactionType) {
    return await fetch(`${API_BASE}/comment-reaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            evaluation_id: evaluationId,
            nickname: state.nickname,
            reaction_type: reactionType
        })
    });
}

async function apiSubmitCommentReply(evaluationId, reply) {
    return await fetch(`${API_BASE}/comment-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            evaluation_id: evaluationId,
            nickname: state.nickname,
            reply
        })
    });
}

async function apiAdminAuth(nickname, password) {
    return await fetch(`${API_BASE}/admin/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, password })
    });
}

async function apiAdminToggleBlind(targetType, targetId, isBlinded) {
    return await fetch(`${API_BASE}/admin/blind`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Admin-Token': state.adminToken
        },
        body: JSON.stringify({
            target_type: targetType,
            target_id: targetId,
            is_blinded: isBlinded
        })
    });
}
