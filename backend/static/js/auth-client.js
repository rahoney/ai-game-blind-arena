let firebaseAuth = null;
let firebaseAnalytics = null;

function getAccountDisplayName() {
    const profile = state.account?.profile || {};
    return profile.display_name || state.authUser?.displayName || state.authUser?.email || '';
}

function getLinkedProviderIds() {
    return (firebaseAuth?.currentUser?.providerData || [])
        .map((provider) => provider.providerId)
        .filter(Boolean);
}

function hasLinkedProvider(providerId) {
    return getLinkedProviderIds().includes(providerId);
}

function setSignedOutState() {
    state.authUser = null;
    state.account = null;
    state.isAdmin = false;
    state.adminToken = '';
}

function setAuthMode(mode) {
    state.authMode = ['signup', 'display_name', 'help', 'find_id', 'reset_password'].includes(mode) ? mode : 'login';
    renderLogin();
}

function getFriendlyAuthError(error, mode = 'login') {
    const code = error?.code || '';
    const messages = {
        ko: {
            invalidEmail: mode === 'signup' ? '회원가입 입력 정보가 올바르지 않습니다.' : '로그인 정보가 올바르지 않습니다.',
            wrongCredentials: '로그인 정보가 올바르지 않습니다.',
            weakPassword: '비밀번호는 6자 이상으로 입력하세요.',
            emailInUse: '이미 가입된 이메일입니다. 로그인하거나 비밀번호 찾기를 이용하세요.',
            popupClosed: '로그인이 취소되었습니다.',
            unauthorizedDomain: '현재 접속 주소가 Firebase 로그인 허용 도메인에 등록되어 있지 않습니다.',
            resetSent: '비밀번호 재설정 메일을 보냈습니다.',
            resetEmailRequired: '비밀번호를 찾을 이메일을 입력하세요.',
            resetEmailInvalid: '이메일 주소를 올바르게 입력하세요.',
            invalidRecoveryInput: '입력이 잘못되었습니다.',
            recoveryRateLimited: '입력 오류가 너무 많습니다. 잠시 후 다시 시도하세요.',
            mailServiceNotConfigured: '메일 발송 기능이 아직 설정되지 않았습니다.',
            mailSendFailed: '메일 발송 중 문제가 발생했습니다.',
            generic: mode === 'signup' ? '회원가입 처리 중 문제가 발생했습니다.' : '로그인 처리 중 문제가 발생했습니다.',
        },
        en: {
            invalidEmail: mode === 'signup' ? 'The sign-up information is not valid.' : 'The login information is not valid.',
            wrongCredentials: 'The login information is not valid.',
            weakPassword: 'Enter a password with at least 6 characters.',
            emailInUse: 'This email is already registered. Log in or reset your password.',
            popupClosed: 'Sign-in was cancelled.',
            unauthorizedDomain: 'This address is not registered as an authorized Firebase login domain.',
            resetSent: 'Password reset email sent.',
            resetEmailRequired: 'Enter your email to reset your password.',
            resetEmailInvalid: 'Enter a valid email address.',
            invalidRecoveryInput: 'The information is not valid.',
            recoveryRateLimited: 'Too many failed attempts. Try again later.',
            mailServiceNotConfigured: 'Email delivery is not configured yet.',
            mailSendFailed: 'Failed to send email.',
            generic: mode === 'signup' ? 'Sign-up failed.' : 'Login failed.',
        },
    };
    const bucket = messages[state.language || 'ko'] || messages.ko;

    if (code === 'auth/invalid-email') return bucket.invalidEmail;
    if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') return bucket.wrongCredentials;
    if (code === 'auth/weak-password') return bucket.weakPassword;
    if (code === 'auth/email-already-in-use') return bucket.emailInUse;
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return bucket.popupClosed;
    if (code === 'auth/unauthorized-domain') return bucket.unauthorizedDomain;
    if (code === 'auth/reset-email-required') return bucket.resetEmailRequired;
    if (code === 'auth/reset-invalid-email') return bucket.resetEmailInvalid;
    if (code === 'auth/reset-sent') return bucket.resetSent;
    if (code === 'invalid_recovery_input') return bucket.invalidRecoveryInput;
    if (String(code).startsWith('recovery_rate_limited')) return bucket.recoveryRateLimited;
    if (code === 'mail_service_not_configured') return bucket.mailServiceNotConfigured;
    if (code === 'mail_send_failed') return bucket.mailSendFailed;
    return bucket.generic;
}

function getDisplayNameValidationError(displayName) {
    if (!displayName) return t('auth_display_name_required');
    return '';
}

function getIdentityFormValues() {
    return {
        login_id: document.getElementById('auth-login-id')?.value.trim() || '',
        real_name: document.getElementById('auth-real-name')?.value.trim() || '',
        display_name: document.getElementById('auth-display-name')?.value.trim() || '',
    };
}

async function initializeFirebaseAuth() {
    if (typeof firebase === 'undefined') {
        state.authReady = true;
        state.authConfigured = false;
        return;
    }

    try {
        const config = await apiFetchAuthConfig();
        state.authConfigured = !!config.configured;
        if (!config.configured) {
            state.authReady = true;
            return;
        }

        if (!firebase.apps.length) {
            firebase.initializeApp({
                apiKey: config.apiKey,
                authDomain: config.authDomain,
                projectId: config.projectId,
                appId: config.appId,
                storageBucket: config.storageBucket || undefined,
                messagingSenderId: config.messagingSenderId || undefined,
                measurementId: config.measurementId || undefined,
            });
        }

        firebaseAuth = firebase.auth();
        if (config.measurementId && firebase.analytics) {
            firebaseAnalytics = firebase.analytics();
        }

        await new Promise((resolve) => {
            const unsubscribe = firebaseAuth.onAuthStateChanged(async (user) => {
                try {
                    if (!user) {
                        setSignedOutState();
                    } else {
                        state.authUser = user;
                        const token = await user.getIdToken();
                        state.account = await apiFetchAuthMe(token);
                        state.isAdmin = !!state.account?.is_admin;
                    }
                } catch (e) {
                    console.error('Auth state sync failed', e);
                    setSignedOutState();
                } finally {
                    state.authReady = true;
                    renderSidebar();
                    unsubscribe();
                    resolve();
                }
            });
        });
    } catch (e) {
        console.error('Firebase auth initialization failed', e);
        state.authConfigured = false;
        state.authReady = true;
    }
}

async function refreshAccountFromFirebaseUser() {
    if (!firebaseAuth?.currentUser) return null;
    const token = await firebaseAuth.currentUser.getIdToken(true);
    state.account = await apiFetchAuthMe(token);
    state.isAdmin = !!state.account?.is_admin;
    renderSidebar();
    return state.account;
}

async function handleEmailAuth(mode) {
    if (!firebaseAuth || state.isLoginSubmitting) return;
    const email = document.getElementById('auth-email')?.value.trim();
    const password = document.getElementById('auth-password')?.value;
    const passwordConfirm = document.getElementById('auth-password-confirm')?.value;
    const identity = getIdentityFormValues();
    if (!email || !password) {
        showAppMessage(t('auth_email_password_required'), { tone: 'error' });
        return;
    }
    if (mode === 'signup') {
        if (!identity.login_id || !identity.real_name || !identity.display_name) {
            showAppMessage(t('auth_signup_identity_required'), { tone: 'error' });
            return;
        }
        if (password !== passwordConfirm) {
            showAppMessage(t('auth_password_confirm_mismatch'), { tone: 'error' });
            return;
        }
    }

    try {
        state.isLoginSubmitting = true;
        if (mode === 'signup') {
            await firebaseAuth.createUserWithEmailAndPassword(email, password);
            await firebaseAuth.currentUser.updateProfile({ displayName: identity.display_name });
            await saveProfileIdentity(identity);
            await firebaseAuth.currentUser.sendEmailVerification();
            showAppMessage(t('auth_email_verification_sent'), { tone: 'success' });
        } else {
            await firebaseAuth.signInWithEmailAndPassword(email, password);
        }
        await refreshAccountFromFirebaseUser();
        if (state.account?.profile && !state.account.profile.display_name_set) {
            state.authMode = 'display_name';
            renderLogin();
            return;
        }
        navigateTo('category', renderCategorySelection);
    } catch (e) {
        showAppMessage(getFriendlyAuthError(e, mode), { tone: 'error' });
        if (mode === 'signup' && firebaseAuth.currentUser) {
            state.authMode = 'display_name';
            renderLogin();
        }
    } finally {
        state.isLoginSubmitting = false;
    }
}

async function handleGoogleLogin() {
    if (!firebaseAuth || state.isLoginSubmitting) return;
    try {
        state.isLoginSubmitting = true;
        const provider = new firebase.auth.GoogleAuthProvider();
        await firebaseAuth.signInWithPopup(provider);
        await refreshAccountFromFirebaseUser();
        if (state.account?.profile && !state.account.profile.display_name_set) {
            state.authMode = 'display_name';
            navigateTo('login', renderLogin);
            return;
        }
        navigateTo('category', renderCategorySelection);
    } catch (e) {
        showAppMessage(getFriendlyAuthError(e, 'login'), { tone: 'error' });
    } finally {
        state.isLoginSubmitting = false;
    }
}

async function handlePasswordReset() {
    if (!firebaseAuth || state.isLoginSubmitting) return;
    const payload = {
        real_name: document.getElementById('auth-real-name')?.value.trim() || '',
        login_id: document.getElementById('auth-login-id')?.value.trim() || '',
        email: document.getElementById('auth-email')?.value.trim() || '',
    };
    if (!payload.real_name || !payload.login_id || !payload.email) {
        showAppMessage(getFriendlyAuthError({ code: 'invalid_recovery_input' }, 'login'), { tone: 'error' });
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        showAppMessage(getFriendlyAuthError({ code: 'invalid_recovery_input' }, 'login'), { tone: 'error' });
        return;
    }

    try {
        const data = await apiRecoverPassword(payload);
        await firebaseAuth.sendPasswordResetEmail(data.email);
        showAppMessage(getFriendlyAuthError({ code: 'auth/reset-sent' }, 'login'), { tone: 'success' });
    } catch (e) {
        showAppMessage(getFriendlyAuthError({ code: e?.message || 'invalid_recovery_input' }, 'login'), { tone: 'error' });
    }
}

async function saveDisplayName(displayName) {
    if (!firebaseAuth?.currentUser) return null;
    const token = await firebaseAuth.currentUser.getIdToken(true);
    state.account = await apiUpdateProfileDisplayName(token, displayName);
    state.isAdmin = !!state.account?.is_admin;
    return state.account;
}

async function saveProfileIdentity(identity) {
    if (!firebaseAuth?.currentUser) return null;
    const token = await firebaseAuth.currentUser.getIdToken(true);
    state.account = await apiUpdateProfileIdentity(token, identity);
    state.isAdmin = !!state.account?.is_admin;
    return state.account;
}

async function syncSocialProviders() {
    if (!firebaseAuth?.currentUser) return null;
    const token = await firebaseAuth.currentUser.getIdToken(true);
    state.account = await apiUpdateSocialProviders(token, getLinkedProviderIds());
    state.isAdmin = !!state.account?.is_admin;
    renderSidebar();
    return state.account;
}

async function handleLinkGoogleProvider() {
    if (!firebaseAuth?.currentUser || state.isLoginSubmitting) return;
    try {
        state.isLoginSubmitting = true;
        const provider = new firebase.auth.GoogleAuthProvider();
        await firebaseAuth.currentUser.linkWithPopup(provider);
        await syncSocialProviders();
        showAppMessage(t('auth_social_link_success'), { tone: 'success' });
    } catch (e) {
        const code = e?.code || '';
        const message = code === 'auth/provider-already-linked'
            ? t('auth_social_already_linked')
            : t('auth_social_link_error');
        showAppMessage(message, { tone: 'error' });
    } finally {
        state.isLoginSubmitting = false;
    }
}

async function handleDisplayNameSubmit() {
    if (!firebaseAuth || state.isLoginSubmitting) return;
    const displayName = document.getElementById('auth-display-name')?.value.trim();
    const displayNameError = getDisplayNameValidationError(displayName);
    if (displayNameError) {
        showAppMessage(displayNameError, { tone: 'error' });
        return;
    }

    try {
        state.isLoginSubmitting = true;
        await firebaseAuth.currentUser.updateProfile({ displayName });
        await saveDisplayName(displayName);
        state.authMode = 'login';
        renderSidebar();
        navigateTo('category', renderCategorySelection);
    } catch (e) {
        const detail = e?.message || '';
        const message = detail === 'display_name_taken'
            ? t('auth_display_name_taken')
            : getNicknameErrorMessage(detail || 'nickname_generic_error');
        showAppMessage(message, { tone: 'error' });
    } finally {
        state.isLoginSubmitting = false;
    }
}

async function handleFindId() {
    const payload = {
        real_name: document.getElementById('auth-real-name')?.value.trim() || '',
        display_name: document.getElementById('auth-display-name')?.value.trim() || '',
        email: document.getElementById('auth-email')?.value.trim() || '',
    };
    if (!payload.real_name || !payload.display_name || !payload.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        showAppMessage(getFriendlyAuthError({ code: 'invalid_recovery_input' }, 'login'), { tone: 'error' });
        return;
    }
    try {
        const data = await apiRecoverLoginId(payload);
        const mailButton = data.email_send_available
            ? `<button type="button" class="message-action-button" onclick="handleSendLoginIdEmail()">${t('auth_send_login_id_email')}</button>`
            : '';
        state.lastLoginIdRecoveryPayload = payload;
        showAppMessage(
            `${t('auth_find_id_result', { login_id: data.masked_login_id })}${mailButton}`,
            { tone: 'success', allowHtml: true }
        );
    } catch (e) {
        showAppMessage(getFriendlyAuthError({ code: e?.message || 'invalid_recovery_input' }, 'login'), { tone: 'error' });
    }
}

async function handleSendLoginIdEmail() {
    if (!state.lastLoginIdRecoveryPayload) {
        showAppMessage(getFriendlyAuthError({ code: 'invalid_recovery_input' }, 'login'), { tone: 'error' });
        return;
    }
    try {
        await apiSendLoginIdEmail(state.lastLoginIdRecoveryPayload);
        showAppMessage(t('auth_login_id_email_sent'), { tone: 'success' });
    } catch (e) {
        showAppMessage(getFriendlyAuthError({ code: e?.message || 'mail_send_failed' }, 'login'), { tone: 'error' });
    }
}

async function signOutAccount() {
    if (firebaseAuth) {
        await firebaseAuth.signOut();
    }
    setSignedOutState();
    renderSidebar();
}
