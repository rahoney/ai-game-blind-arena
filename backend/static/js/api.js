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

async function getCurrentAuthHeaders(includeJson = false) {
    const headers = includeJson ? { 'Content-Type': 'application/json' } : {};
    if (firebaseAuth?.currentUser) {
        const token = await firebaseAuth.currentUser.getIdToken();
        headers.Authorization = `Bearer ${token}`;
    }
    return headers;
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

async function apiCheckLoginIdAvailability(loginId) {
    const res = await fetch(`${API_BASE}/profile/login-id-availability?login_id=${encodeURIComponent(loginId)}`, {
        cache: 'no-store'
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.detail || 'login_id_check_failed');
    }
    return data;
}

async function apiResolveLoginIdEmail(loginId) {
    const res = await fetch(`${API_BASE}/auth/login-id-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login_id: loginId })
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.detail || 'invalid_recovery_input');
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
        body: JSON.stringify({ ...payload, language: state.language || 'ko' })
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.detail || 'invalid_recovery_input');
    }
    return data;
}

async function apiSendCurrentUserPasswordReset(idToken) {
    const res = await fetch(`${API_BASE}/auth/me/password-reset?lang=${encodeURIComponent(state.language || 'ko')}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'X-Client-Language': state.language || 'ko'
        }
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.detail || 'mail_send_failed');
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
    const headers = await getCurrentAuthHeaders();
    const nickname = getCurrentProfileDisplayName();
    const url = headers.Authorization ? `${API_BASE}/user_evals` : `${API_BASE}/user_evals/${encodeURIComponent(nickname)}`;
    if (!headers.Authorization && !nickname) return;
    const res = await fetch(url, { headers });
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
    const headers = await getCurrentAuthHeaders(true);
    await fetch(`${API_BASE}/play`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ game_type: gameType, blind_model_id: blindId })
    });
    // Refresh game list behind the scenes to update play count
    await apiFetchGames();
}

async function apiSubmitEvaluation(payload) {
    const headers = await getCurrentAuthHeaders(true);
    return await fetch(`${API_BASE}/evaluate`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
    });
}

async function apiFetchResults(gameType) {
    const nickname = getCurrentProfileDisplayName();
    const headers = await getCurrentAuthHeaders();
    if (!headers.Authorization && state.adminToken) headers['X-Admin-Token'] = state.adminToken;
    const nicknameQuery = !headers.Authorization && nickname ? `?nickname=${encodeURIComponent(nickname)}` : '';
    const res = await fetch(`${API_BASE}/results/${gameType}${nicknameQuery}`, { headers });
    return await res.json();
}

async function apiFetchMyPage() {
    const nickname = getCurrentProfileDisplayName();
    const headers = await getCurrentAuthHeaders();
    const url = headers.Authorization ? `${API_BASE}/mypage` : `${API_BASE}/mypage/${encodeURIComponent(nickname)}`;
    if (!headers.Authorization && !nickname) return null;
    const res = await fetch(url, { headers });
    const data = await res.json();
    state.myPageData = data;
    return data;
}

async function apiUpdateProfileBadge(badgeKey) {
    const headers = await getCurrentAuthHeaders(true);
    return await fetch(`${API_BASE}/mypage/profile-badge`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            badge_key: badgeKey
        })
    });
}

async function apiToggleCommentReaction(evaluationId, reactionType) {
    const headers = await getCurrentAuthHeaders(true);
    return await fetch(`${API_BASE}/comment-reaction`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            evaluation_id: evaluationId,
            reaction_type: reactionType
        })
    });
}

async function apiSubmitCommentReply(evaluationId, reply) {
    const headers = await getCurrentAuthHeaders(true);
    return await fetch(`${API_BASE}/comment-reply`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            evaluation_id: evaluationId,
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
    const headers = await getCurrentAuthHeaders(true);
    if (!headers.Authorization) headers['X-Admin-Token'] = state.adminToken;
    return await fetch(`${API_BASE}/admin/blind`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            target_type: targetType,
            target_id: targetId,
            is_blinded: isBlinded
        })
    });
}
