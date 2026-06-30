async function apiFetchGames() {
    const lang = state.language || 'ko';
    const blindSeed = encodeURIComponent(ensureBlindSeed());
    const res = await fetch(`${API_BASE}/games?lang=${lang}&blind_seed=${blindSeed}`);
    const data = await res.json();
    state.games = data.games;
    state.categories = data.categories || [];
}

async function apiFetchAuthConfig() {
    const res = await fetch(`${API_BASE}/auth/config`, { cache: 'no-store' });
    return await res.json();
}

async function apiFetchAuthMe(idToken, options = {}) {
    const includeLinkedProviders = options.includeLinkedProviders !== false;
    const linkedProviderQuery = includeLinkedProviders ? '' : '?include_linked_providers=false';
    const res = await fetch(`${API_BASE}/auth/me${linkedProviderQuery}`, {
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
        if (typeof markAuthActivity === 'function') markAuthActivity();
        const token = await firebaseAuth.currentUser.getIdToken();
        headers.Authorization = `Bearer ${token}`;
    }
    return headers;
}

async function apiUpdateProfileDisplayName(idToken, payload) {
    const res = await fetch(`${API_BASE}/profile/display-name`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(payload)
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
        body: JSON.stringify({ email, language: state.language || 'ko' })
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

async function apiCheckDisplayNameAvailability(displayName) {
    const res = await fetch(`${API_BASE}/profile/display-name-availability?display_name=${encodeURIComponent(displayName)}`, {
        cache: 'no-store'
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.detail || 'display_name_check_failed');
    }
    return data;
}

async function apiCheckMyDisplayNameAvailability(displayName) {
    const headers = await getCurrentAuthHeaders();
    const res = await fetch(`${API_BASE}/auth/me/display-name/check?display_name=${encodeURIComponent(displayName)}`, {
        cache: 'no-store',
        headers,
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.detail || 'display_name_check_failed');
    }
    return data;
}

async function apiChangeMyDisplayName(displayName) {
    const headers = await getCurrentAuthHeaders(true);
    const res = await fetch(`${API_BASE}/auth/me/display-name`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ display_name: displayName }),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.detail || 'display_name_change_failed');
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

async function apiRequestCurrentUserEmailChangeCode(idToken, email) {
    const res = await fetch(`${API_BASE}/auth/me/email-change/code`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ email, language: state.language || 'ko' })
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.detail || 'mail_send_failed');
    }
    return data;
}

async function apiConfirmCurrentUserEmailChange(idToken, email, code) {
    const res = await fetch(`${API_BASE}/auth/me/email-change/confirm`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ email, code })
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.detail || 'invalid_verification_code');
    }
    return data;
}

async function apiRequestCurrentUserLoginIdCode(idToken, email) {
    const res = await fetch(`${API_BASE}/auth/me/login-id/code`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ email, language: state.language || 'ko' })
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.detail || 'mail_send_failed');
    }
    return data;
}

async function apiCreateCurrentUserLoginId(idToken, payload) {
    const res = await fetch(`${API_BASE}/auth/me/login-id`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.detail || 'login_id_create_failed');
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

async function apiStartBackendOAuthLink(providerKey) {
    const url = `${API_BASE}/auth/oauth/${encodeURIComponent(providerKey)}/link/start`;
    let res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: await getCurrentAuthHeaders()
    });
    if (res.status === 401 && firebaseAuth?.currentUser) {
        const token = await firebaseAuth.currentUser.getIdToken(true);
        res = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
    }
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.detail || 'oauth_link_start_failed');
    }
    return data;
}

async function apiRecordFirebaseProviderLink(idToken, providerKey) {
    const res = await fetch(`${API_BASE}/auth/provider/${encodeURIComponent(providerKey)}/link-record`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${idToken}`
        }
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.detail || 'provider_link_record_failed');
    }
    return data;
}

async function apiUnlinkAuthProvider(providerKey) {
    const url = `${API_BASE}/auth/provider/${encodeURIComponent(providerKey)}/link`;
    let res = await fetch(url, {
        method: 'DELETE',
        headers: await getCurrentAuthHeaders()
    });
    if (res.status === 401 && firebaseAuth?.currentUser) {
        const token = await firebaseAuth.currentUser.getIdToken(true);
        res = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
    }
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.detail || 'auth_provider_unlink_failed');
    }
    return data;
}

async function apiDeleteAccount(idToken) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    let res;
    try {
        res = await fetch(`${API_BASE}/profile/account`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ confirm: true }),
            signal: controller.signal
        });
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new Error('account_delete_timeout');
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.detail || 'account_delete_failed');
    }
    return data;
}

async function apiFetchUserEvals() {
    const headers = await getCurrentAuthHeaders();
    if (!headers.Authorization) return;
    const res = await fetch(`${API_BASE}/user_evals`, { headers });
    const data = await res.json();
    state.userEvals = data.evals;
}

async function apiRecordPlay(gameType, blindId, blindModelToken = '') {
    const headers = await getCurrentAuthHeaders(true);
    if (!headers.Authorization) return false;
    const res = await fetch(`${API_BASE}/play`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ game_type: gameType, blind_model_id: blindId, blind_model_token: blindModelToken })
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || 'play_recording_failed');
    }
    const model = state.games?.[gameType]?.find((item) => item.blind_id === blindId);
    if (model) {
        model.play_count = Number(model.play_count || 0) + 1;
    }
    return true;
}

async function apiSubmitEvaluation(payload) {
    const headers = await getCurrentAuthHeaders(true);
    return await fetch(`${API_BASE}/evaluate`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
    });
}

function getCachedResultsData(gameType) {
    return state.resultsCache?.[gameType] || null;
}

function setCachedResultsData(gameType, data) {
    if (!gameType || !data) return data;
    state.resultsCache = {
        ...(state.resultsCache || {}),
        [gameType]: data,
    };
    return data;
}

function invalidateResultsCache(gameType) {
    if (!gameType || !state.resultsCache?.[gameType]) return;
    const nextCache = { ...state.resultsCache };
    delete nextCache[gameType];
    state.resultsCache = nextCache;
}

async function apiFetchResults(gameType) {
    const headers = await getCurrentAuthHeaders();
    const res = await fetch(`${API_BASE}/results/${encodeURIComponent(gameType)}`, { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.detail || 'results_fetch_failed');
    }
    return setCachedResultsData(gameType, data);
}

function apiPrefetchResults(gameType) {
    if (!gameType) return Promise.resolve(null);
    const cached = getCachedResultsData(gameType);
    if (cached) return Promise.resolve(cached);
    if (state.resultsRefreshPromises?.[gameType]) return state.resultsRefreshPromises[gameType];

    const promise = apiFetchResults(gameType)
        .catch((error) => {
            console.error('Results prefetch failed', error);
            return null;
        })
        .finally(() => {
            const nextPromises = { ...(state.resultsRefreshPromises || {}) };
            delete nextPromises[gameType];
            state.resultsRefreshPromises = nextPromises;
        });

    state.resultsRefreshPromises = {
        ...(state.resultsRefreshPromises || {}),
        [gameType]: promise,
    };
    return promise;
}

async function apiFetchMyPage() {
    const headers = await getCurrentAuthHeaders();
    if (!headers.Authorization) return null;
    const res = await fetch(`${API_BASE}/mypage`, { headers });
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

async function apiAdminToggleBlind(targetType, targetId, isBlinded) {
    const headers = await getCurrentAuthHeaders(true);
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

async function apiFetchAdminOverview(query = '') {
    const headers = await getCurrentAuthHeaders(true);
    const params = new URLSearchParams();
    if (query) params.set('query', query);
    const res = await fetch(`${API_BASE}/admin/overview?${params.toString()}`, { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.detail || 'admin_overview_failed');
    state.adminOverview = data;
    return data;
}

async function apiAdminUserAction(profileId, action, reason = '') {
    const headers = await getCurrentAuthHeaders(true);
    const method = action === 'delete' ? 'DELETE' : 'POST';
    const endpoint = action === 'delete'
        ? `${API_BASE}/admin/users/${encodeURIComponent(profileId)}`
        : `${API_BASE}/admin/users/${encodeURIComponent(profileId)}/${action}`;
    const res = await fetch(endpoint, {
        method,
        headers,
        body: JSON.stringify({ reason })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.detail || 'admin_user_action_failed');
    return data;
}
