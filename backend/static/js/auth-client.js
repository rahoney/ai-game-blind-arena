let firebaseAuth = null;
let firebaseAnalytics = null;

function getAccountDisplayName() {
    const profile = state.account?.profile || {};
    return profile.display_name || state.authUser?.displayName || state.authUser?.email || '';
}

function getCurrentProfileDisplayName() {
    return (state.account?.profile?.display_name || '').trim();
}

function getLinkedProviderIds() {
    return (firebaseAuth?.currentUser?.providerData || [])
        .map((provider) => provider.providerId)
        .filter(Boolean);
}

function normalizeProviderKey(providerKey) {
    const aliases = {
        'google.com': 'google',
        password: 'password',
    };
    return aliases[providerKey] || providerKey;
}

function getLinkedProviderKeys() {
    const backendProviders = state.account?.linked_providers || state.account?.profile?.social_providers || [];
    const firebaseProviders = getLinkedProviderIds().map(normalizeProviderKey);
    return Array.from(new Set([...backendProviders.map(normalizeProviderKey), ...firebaseProviders])).filter(Boolean);
}

function hasLinkedProvider(providerKey) {
    return getLinkedProviderKeys().includes(normalizeProviderKey(providerKey));
}

const SOCIAL_AUTH_PROVIDERS = {
    google: {
        providerId: 'google.com',
        createProvider: () => new firebase.auth.GoogleAuthProvider(),
    },
};

const BACKEND_OAUTH_PROVIDERS = {
    kakao: {
        startUrl: '/api/auth/oauth/kakao/start',
    },
    naver: {
        startUrl: '/api/auth/oauth/naver/start',
    },
    github: {
        startUrl: '/api/auth/oauth/github/start',
    },
    discord: {
        startUrl: '/api/auth/oauth/discord/start',
    },
    steam: {
        startUrl: '/api/auth/oauth/steam/start',
    },
};

function setSignedOutState() {
    state.authUser = null;
    state.account = null;
    state.isAdmin = false;
    clearBlindSeed();
}

function setAuthMode(mode) {
    state.authMode = ['signup', 'display_name', 'verify_email', 'help', 'find_id', 'reset_password'].includes(mode) ? mode : 'login';
    if (state.authMode !== 'signup') {
        stopSignupEmailCountdown();
        state.loginIdAvailability = { value: '', status: 'idle', message: '' };
        state.displayNameAvailability = { value: '', status: 'idle', message: '' };
    }
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
            passwordResetLinkFailed: '비밀번호 재설정 링크를 생성하지 못했습니다. 잠시 후 다시 시도하세요.',
            signupEmailVerificationNotConfigured: '이메일 인증 기능을 준비 중입니다. 잠시 후 다시 시도해 주세요.',
            loginIdTaken: '중복된 아이디입니다.',
            displayNameTaken: '이미 사용 중인 표시 닉네임입니다.',
            loginIdFormat: '아이디는 영문과 숫자 4~15자만 사용할 수 있습니다.',
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
            passwordResetLinkFailed: 'Failed to create the password reset link. Please try again later.',
            signupEmailVerificationNotConfigured: 'Email verification is being prepared. Please try again shortly.',
            loginIdTaken: 'This ID is already taken.',
            displayNameTaken: 'This display name is already in use.',
            loginIdFormat: 'Use only 4-15 letters or numbers.',
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
    if (code === 'password_reset_link_failed') return bucket.passwordResetLinkFailed;
    if (code === 'signup_email_verification_not_configured') return bucket.signupEmailVerificationNotConfigured;
    if (code === 'login_id_taken') return bucket.loginIdTaken;
    if (code === 'display_name_taken') return bucket.displayNameTaken;
    if (code === 'login_id_format') return bucket.loginIdFormat;
    return bucket.generic;
}

function getDisplayNameValidationError(displayName) {
    if (!displayName) return t('auth_display_name_required');
    const validationError = validateDisplayNameInput(displayName);
    return validationError ? getDisplayNameErrorMessage(validationError) : '';
}

function getIdentityFormValues() {
    return {
        login_id: document.getElementById('auth-login-id')?.value.trim() || '',
        real_name: document.getElementById('auth-real-name')?.value.trim() || '',
        display_name: document.getElementById('auth-display-name')?.value.trim() || '',
        email_verification_token: state.signupEmailVerification?.token || '',
        language: state.language || 'ko',
    };
}

function isValidLoginId(loginId) {
    return /^[A-Za-z0-9]{4,15}$/.test(loginId || '');
}

function isValidSignupPassword(password) {
    return /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/.test(password || '');
}

function isEmailPasswordUser(user = firebaseAuth?.currentUser) {
    return !!user?.providerData?.some((provider) => provider.providerId === 'password');
}

function needsEmailVerification(user = firebaseAuth?.currentUser) {
    return !!(user?.email && isEmailPasswordUser(user) && !user.emailVerified);
}

function isValidEmailInput(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
}

function isValidSignupForm() {
    const password = document.getElementById('auth-password')?.value || '';
    const passwordConfirm = document.getElementById('auth-password-confirm')?.value || '';
    const identity = getIdentityFormValues();
    return (
        !!state.signupEmailVerification?.token
        && isValidLoginId(identity.login_id)
        && state.loginIdAvailability?.value === identity.login_id
        && state.loginIdAvailability?.status === 'available'
        && isValidRealName(identity.real_name)
        && !validateDisplayNameInput(identity.display_name)
        && state.displayNameAvailability?.value === identity.display_name
        && state.displayNameAvailability?.status === 'available'
        && isValidSignupPassword(password)
        && password === passwordConfirm
    );
}

function isValidRealName(realName) {
    const value = (realName || '').trim();
    if (!value) return false;
    if ((state.language || 'ko') === 'en') {
        return /^[A-Za-z]+(?: [A-Za-z]+)*$/.test(value) && value.replace(/\s+/g, '').length >= 3;
    }
    return /^[가-힣]{2,}$/.test(value);
}

function updateSignupSubmitState() {
    updateSignupFieldStatuses();
    const button = document.getElementById('login-submit-btn');
    if (!button || state.authMode !== 'signup') return;
    button.disabled = !state.authConfigured || state.isLoginSubmitting || !isValidSignupForm();
}

function getFieldVisualState(isTouched, isValid) {
    if (!isTouched) return 'idle';
    return isValid ? 'valid' : 'invalid';
}

function setAuthFieldStatus(fieldId, status) {
    const el = document.getElementById(`auth-${fieldId}-status`);
    if (!el) return;
    el.className = `auth-field-status ${status}`;
    el.textContent = status === 'valid' ? '✓' : status === 'invalid' ? '!' : '•';
}

function updateSignupFieldStatuses() {
    if (state.authMode !== 'signup' || !state.signupEmailVerification?.token) return;
    const identity = getIdentityFormValues();
    const password = document.getElementById('auth-password')?.value || '';
    const passwordConfirm = document.getElementById('auth-password-confirm')?.value || '';
    const loginStatus = state.loginIdAvailability?.value === identity.login_id && state.loginIdAvailability?.status === 'available'
        ? 'valid'
        : getFieldVisualState(!!identity.login_id, false);
    const displayNameStatus = state.displayNameAvailability?.value === identity.display_name && state.displayNameAvailability?.status === 'available'
        ? 'valid'
        : getFieldVisualState(!!identity.display_name, false);
    setAuthFieldStatus('login-id', loginStatus);
    setAuthFieldStatus('real-name', getFieldVisualState(!!identity.real_name, isValidRealName(identity.real_name)));
    setAuthFieldStatus('display-name', displayNameStatus);
    setAuthFieldStatus('password', getFieldVisualState(!!password, isValidSignupPassword(password)));
    setAuthFieldStatus('password-confirm', getFieldVisualState(!!passwordConfirm, !!passwordConfirm && password === passwordConfirm && isValidSignupPassword(password)));
}

function handleSignupLoginIdInput() {
    const loginId = document.getElementById('auth-login-id')?.value.trim() || '';
    if (state.loginIdAvailability?.value !== loginId) {
        state.loginIdAvailability = { value: loginId, status: 'idle', message: '' };
    }
    const message = document.getElementById('auth-login-id-availability');
    if (message) {
        message.textContent = loginId ? t('auth_login_id_check_required') : '';
        message.className = 'auth-field-message';
    }
    updateSignupSubmitState();
}

function handleSignupDisplayNameInput() {
    const displayName = document.getElementById('auth-display-name')?.value.trim() || '';
    if (state.displayNameAvailability?.value !== displayName) {
        state.displayNameAvailability = { value: displayName, status: 'idle', message: '' };
    }
    const message = document.getElementById('auth-display-name-availability');
    if (message) {
        const validationError = validateDisplayNameInput(displayName);
        message.textContent = displayName
            ? validationError
                ? getDisplayNameErrorMessage(validationError)
                : t('auth_display_name_check_required')
            : '';
        message.className = `auth-field-message ${displayName && validationError ? 'invalid' : ''}`.trim();
    }
    updateSignupSubmitState();
}

async function handleDisplayNameAvailabilityCheck() {
    const displayName = document.getElementById('auth-display-name')?.value.trim() || '';
    const message = document.getElementById('auth-display-name-availability');
    const validationError = validateDisplayNameInput(displayName);
    if (validationError) {
        state.displayNameAvailability = { value: displayName, status: 'invalid', message: validationError };
        if (message) {
            message.textContent = getDisplayNameErrorMessage(validationError);
            message.className = 'auth-field-message invalid';
        }
        updateSignupSubmitState();
        return;
    }
    try {
        state.displayNameAvailability = { value: displayName, status: 'checking', message: '' };
        if (message) {
            message.textContent = t('auth_display_name_checking');
            message.className = 'auth-field-message';
        }
        updateSignupSubmitState();
        const data = await apiCheckDisplayNameAvailability(displayName);
        state.displayNameAvailability = {
            value: displayName,
            status: data.available ? 'available' : 'taken',
            message: data.available ? 'available' : 'taken',
        };
        if (message) {
            message.textContent = data.available ? t('auth_display_name_available') : t('auth_display_name_taken');
            message.className = `auth-field-message ${data.available ? 'valid' : 'invalid'}`;
        }
    } catch (e) {
        state.displayNameAvailability = { value: displayName, status: 'error', message: e?.message || 'display_name_check_failed' };
        if (message) {
            const detail = e?.message || '';
            message.textContent = detail && detail !== 'display_name_check_failed'
                ? getDisplayNameErrorMessage(detail)
                : t('auth_display_name_check_failed');
            message.className = 'auth-field-message invalid';
        }
    } finally {
        updateSignupSubmitState();
    }
}

async function handleLoginIdAvailabilityCheck() {
    const loginId = document.getElementById('auth-login-id')?.value.trim() || '';
    const message = document.getElementById('auth-login-id-availability');
    if (!isValidLoginId(loginId)) {
        state.loginIdAvailability = { value: loginId, status: 'invalid', message: 'login_id_format' };
        if (message) {
            message.textContent = t('auth_login_id_format_error');
            message.className = 'auth-field-message invalid';
        }
        updateSignupSubmitState();
        return;
    }
    try {
        state.loginIdAvailability = { value: loginId, status: 'checking', message: '' };
        if (message) {
            message.textContent = t('auth_login_id_checking');
            message.className = 'auth-field-message';
        }
        updateSignupSubmitState();
        const data = await apiCheckLoginIdAvailability(loginId);
        state.loginIdAvailability = {
            value: loginId,
            status: data.available ? 'available' : 'taken',
            message: data.available ? 'available' : 'taken',
        };
        if (message) {
            message.textContent = data.available ? t('auth_login_id_available') : t('auth_login_id_taken');
            message.className = `auth-field-message ${data.available ? 'valid' : 'invalid'}`;
        }
    } catch (e) {
        state.loginIdAvailability = { value: loginId, status: 'error', message: e?.message || 'login_id_check_failed' };
        if (message) {
            message.textContent = t('auth_login_id_check_failed');
            message.className = 'auth-field-message invalid';
        }
    } finally {
        updateSignupSubmitState();
    }
}

function updateSignupEmailCodeState() {
    const button = document.getElementById('auth-email-code-confirm-btn');
    const countdown = document.getElementById('auth-email-code-countdown');
    const code = document.getElementById('auth-email-code')?.value.trim() || '';
    const expiresAt = Number(state.signupEmailVerification?.expiresAt || 0);
    const isExpired = expiresAt > 0 && Date.now() >= expiresAt;
    if (countdown) {
        countdown.textContent = t('auth_signup_code_countdown', { time: getSignupCodeCountdownText() });
    }
    if (button) {
        button.disabled = !state.authConfigured || state.isLoginSubmitting || isExpired || !/^\d{6}$/.test(code);
    }
}

function stopSignupEmailCountdown() {
    if (state.signupEmailTimerId) {
        window.clearInterval(state.signupEmailTimerId);
        state.signupEmailTimerId = null;
    }
}

function startSignupEmailCountdown() {
    stopSignupEmailCountdown();
    if (state.authMode !== 'signup' || !state.signupEmailVerification?.codeSent || state.signupEmailVerification?.token) {
        return;
    }
    updateSignupEmailCodeState();
    state.signupEmailTimerId = window.setInterval(() => {
        updateSignupEmailCodeState();
        const expiresAt = Number(state.signupEmailVerification?.expiresAt || 0);
        if (expiresAt && Date.now() >= expiresAt) {
            stopSignupEmailCountdown();
        }
    }, 1000);
}

function getAccountEmailChangeCountdownText() {
    const remaining = Math.max(0, Math.ceil((Number(state.accountEmailChange?.expiresAt || 0) - Date.now()) / 1000));
    const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
    const seconds = String(remaining % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
}

function updateAccountEmailChangeCodeState() {
    const button = document.getElementById('account-email-change-confirm-btn');
    const countdown = document.getElementById('account-email-change-countdown');
    const code = document.getElementById('account-email-change-code')?.value.trim() || '';
    const expiresAt = Number(state.accountEmailChange?.expiresAt || 0);
    const isExpired = expiresAt > 0 && Date.now() >= expiresAt;
    if (countdown) {
        countdown.textContent = t('auth_signup_code_countdown', { time: getAccountEmailChangeCountdownText() });
    }
    if (button) {
        button.disabled = !state.authConfigured || state.isLoginSubmitting || isExpired || !/^\d{6}$/.test(code);
    }
}

function stopAccountEmailChangeCountdown() {
    if (state.accountEmailChangeTimerId) {
        window.clearInterval(state.accountEmailChangeTimerId);
        state.accountEmailChangeTimerId = null;
    }
}

function startAccountEmailChangeCountdown() {
    stopAccountEmailChangeCountdown();
    if (!state.accountEmailChange?.open || !state.accountEmailChange?.codeSent) {
        return;
    }
    updateAccountEmailChangeCodeState();
    state.accountEmailChangeTimerId = window.setInterval(() => {
        updateAccountEmailChangeCodeState();
        const expiresAt = Number(state.accountEmailChange?.expiresAt || 0);
        if (expiresAt && Date.now() >= expiresAt) {
            stopAccountEmailChangeCountdown();
        }
    }, 1000);
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
                        syncBlindSeedForAuthUser(user.uid);
                        const token = await user.getIdToken();
                        state.account = await apiFetchAuthMe(token);
                        state.isAdmin = !!state.account?.is_admin;
                        if (needsEmailVerification(user)) {
                            state.authMode = 'verify_email';
                        }
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
    syncBlindSeedForAuthUser(firebaseAuth.currentUser.uid);
    state.account = await apiFetchAuthMe(token);
    state.isAdmin = !!state.account?.is_admin;
    renderSidebar();
    return state.account;
}

async function refreshSignedInGameState() {
    try {
        await apiFetchGames();
    } catch (e) {
        console.error('Game data load failed', e);
    }
    try {
        await apiFetchUserEvals();
    } catch (e) {
        console.error('User evaluation load failed', e);
    }
}

async function handleEmailAuth(mode) {
    if (!firebaseAuth || state.isLoginSubmitting) return;
    const email = mode === 'signup'
        ? state.signupEmailVerification?.email
        : document.getElementById('auth-login-id')?.value.trim();
    const password = document.getElementById('auth-password')?.value;
    const passwordConfirm = document.getElementById('auth-password-confirm')?.value;
    const identity = getIdentityFormValues();
    if (!email || !password) {
        showAppMessage(t('auth_login_password_required'), { tone: 'error' });
        return;
    }
    if (mode === 'signup' && !isValidSignupForm()) {
        showAppMessage(t('auth_signup_required_fields'), { tone: 'error' });
        updateSignupSubmitState();
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
            state.signupEmailVerification = { email: '', codeSent: false, expiresAt: 0, token: '' };
            state.loginIdAvailability = { value: '', status: 'idle', message: '' };
            state.displayNameAvailability = { value: '', status: 'idle', message: '' };
            showAppMessage(t('auth_signup_complete'), { tone: 'success' });
        } else {
            const data = await apiResolveLoginIdEmail(email);
            await firebaseAuth.signInWithEmailAndPassword(data.email, password);
        }
        await refreshAccountFromFirebaseUser();
        if (needsEmailVerification()) {
            state.authMode = 'verify_email';
            renderLogin();
            showAppMessage(t('auth_email_verification_required'), { tone: 'error' });
            return;
        }
        if (state.account?.profile && !state.account.profile.display_name_set) {
            state.authMode = 'display_name';
            renderLogin();
            return;
        }
        await refreshSignedInGameState();
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

async function handleSignupEmailCodeRequest() {
    if (state.isLoginSubmitting) return;
    const email = document.getElementById('auth-email')?.value.trim() || state.signupEmailVerification?.email || '';
    if (!isValidEmailInput(email)) {
        showAppMessage(getFriendlyAuthError({ code: 'auth/invalid-email' }, 'signup'), { tone: 'error' });
        return;
    }
    try {
        state.isLoginSubmitting = true;
        const data = await apiRequestSignupEmailCode(email);
        state.signupEmailVerification = {
            email,
            codeSent: true,
            expiresAt: Date.now() + (Number(data.expires_in_seconds || 600) * 1000),
            token: '',
        };
        renderLogin();
        showAppMessage(t('auth_signup_code_sent'), { tone: 'success' });
    } catch (e) {
        showAppMessage(getFriendlyAuthError({ code: e?.message || 'mail_send_failed' }, 'signup'), { tone: 'error' });
    } finally {
        state.isLoginSubmitting = false;
    }
}

async function handleSignupEmailCodeConfirm() {
    if (state.isLoginSubmitting) return;
    const code = document.getElementById('auth-email-code')?.value.trim() || '';
    const email = state.signupEmailVerification?.email || '';
    if (!/^\d{6}$/.test(code) || !email) {
        showAppMessage(t('auth_signup_code_invalid'), { tone: 'error' });
        return;
    }
    try {
        state.isLoginSubmitting = true;
        const data = await apiConfirmSignupEmailCode(email, code);
        state.signupEmailVerification = {
            ...state.signupEmailVerification,
            token: data.email_verification_token || '',
        };
        stopSignupEmailCountdown();
        renderLogin();
        showAppMessage(t('auth_signup_email_verified'), { tone: 'success' });
    } catch (e) {
        showAppMessage(t('auth_signup_code_invalid'), { tone: 'error' });
    } finally {
        state.isLoginSubmitting = false;
    }
}

function getSignupCodeCountdownText() {
    const expiresAt = Number(state.signupEmailVerification?.expiresAt || 0);
    const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
    const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
    const seconds = String(remaining % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
}

async function handleResendVerificationEmail() {
    if (!firebaseAuth?.currentUser || state.isLoginSubmitting) return;
    try {
        state.isLoginSubmitting = true;
        await firebaseAuth.currentUser.sendEmailVerification();
        showAppMessage(t('auth_email_verification_resent'), { tone: 'success' });
    } catch (e) {
        showAppMessage(getFriendlyAuthError(e, 'login'), { tone: 'error' });
    } finally {
        state.isLoginSubmitting = false;
        renderLogin();
    }
}

async function handleVerifyEmailRefresh() {
    if (!firebaseAuth?.currentUser || state.isLoginSubmitting) return;
    try {
        state.isLoginSubmitting = true;
        await firebaseAuth.currentUser.reload();
        state.authUser = firebaseAuth.currentUser;
        if (needsEmailVerification()) {
            showAppMessage(t('auth_email_verification_not_complete'), { tone: 'error' });
            return;
        }
        await refreshAccountFromFirebaseUser();
        state.authMode = 'login';
        if (state.account?.profile && !state.account.profile.display_name_set) {
            state.authMode = 'display_name';
            renderLogin();
            return;
        }
        await refreshSignedInGameState();
        navigateTo('category', renderCategorySelection);
    } catch (e) {
        showAppMessage(getFriendlyAuthError(e, 'login'), { tone: 'error' });
    } finally {
        state.isLoginSubmitting = false;
    }
}

async function handleGoogleLogin() {
    return handleSocialLogin('google');
}

async function handleSocialLogin(providerKey) {
    if (!firebaseAuth || state.isLoginSubmitting) return;
    if (BACKEND_OAUTH_PROVIDERS[providerKey]) {
        return handleBackendOAuthLogin(providerKey);
    }
    const providerConfig = SOCIAL_AUTH_PROVIDERS[providerKey];
    if (!providerConfig) return;
    try {
        state.isLoginSubmitting = true;
        const provider = providerConfig.createProvider();
        await firebaseAuth.signInWithPopup(provider);
        await refreshAccountFromFirebaseUser();
        if (state.account?.profile && !state.account.profile.display_name_set) {
            state.authMode = 'display_name';
            navigateTo('login', renderLogin);
            return;
        }
        await refreshSignedInGameState();
        navigateTo('category', renderCategorySelection);
    } catch (e) {
        showAppMessage(getFriendlyAuthError(e, 'login'), { tone: 'error' });
    } finally {
        state.isLoginSubmitting = false;
    }
}

function handleBackendOAuthLogin(providerKey) {
    const providerConfig = BACKEND_OAUTH_PROVIDERS[providerKey];
    if (!providerConfig) return;
    const popup = window.open(providerConfig.startUrl, `${providerKey}_login`, 'width=480,height=720');
    if (!popup) {
        showAppMessage(t('auth_popup_blocked'), { tone: 'error' });
    }
}

async function handleBackendOAuthMessage(event) {
    if (event.origin !== window.location.origin) return;
    const data = event.data || {};
    if (!data || typeof data !== 'object') return;

    if (data.type === 'oauth_error') {
        const isLinking = state.isLoginSubmitting && !!firebaseAuth?.currentUser;
        showAppMessage(t(isLinking ? 'auth_social_link_error' : 'auth_social_login_error'), { tone: 'error' });
        state.isLoginSubmitting = false;
        if (isLinking) renderMyPage();
        return;
    }

    if (data.type === 'oauth_link_success') {
        try {
            await refreshAccountFromFirebaseUser();
            showAppMessage(t('auth_social_link_success'), { tone: 'success' });
        } catch (e) {
            showAppMessage(t('auth_social_link_error'), { tone: 'error' });
        } finally {
            state.isLoginSubmitting = false;
            renderMyPage();
        }
        return;
    }

    if (data.type !== 'oauth_custom_token' || !data.customToken) return;
    if (!firebaseAuth || state.isLoginSubmitting) return;

    try {
        state.isLoginSubmitting = true;
        await firebaseAuth.signInWithCustomToken(data.customToken);
        await refreshAccountFromFirebaseUser();
        if (state.account?.profile && !state.account.profile.display_name_set) {
            state.authMode = 'display_name';
            navigateTo('login', renderLogin);
            return;
        }
        await refreshSignedInGameState();
        navigateTo('category', renderCategorySelection);
    } catch (e) {
        showAppMessage(getFriendlyAuthError(e, 'login'), { tone: 'error' });
    } finally {
        state.isLoginSubmitting = false;
    }
}

window.addEventListener('message', handleBackendOAuthMessage);

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
        await apiRecoverPassword(payload);
        showAppMessage(getFriendlyAuthError({ code: 'auth/reset-sent' }, 'login'), { tone: 'success' });
    } catch (e) {
        showAppMessage(getFriendlyAuthError({ code: e?.message || 'invalid_recovery_input' }, 'login'), { tone: 'error' });
    }
}

async function handleCurrentUserPasswordReset() {
    if (state.isLoginSubmitting) return;
    try {
        state.isLoginSubmitting = true;
        const profile = state.account?.profile || {};
        if (profile.real_name && profile.login_id && profile.email) {
            await apiRecoverPassword({
                real_name: profile.real_name,
                login_id: profile.login_id,
                email: profile.email,
            });
        } else if (firebaseAuth?.currentUser) {
            const token = await firebaseAuth.currentUser.getIdToken(true);
            await apiSendCurrentUserPasswordReset(token);
        } else {
            throw new Error('invalid_recovery_input');
        }
        showAppMessage(getFriendlyAuthError({ code: 'auth/reset-sent' }, 'login'), { tone: 'success' });
    } catch (e) {
        showAppMessage(getFriendlyAuthError({ code: e?.message || 'mail_send_failed' }, 'login'), { tone: 'error' });
    } finally {
        state.isLoginSubmitting = false;
        renderMyPage();
    }
}

function openAccountEmailChangeDialog() {
    const currentEmail = state.account?.profile?.email || firebaseAuth?.currentUser?.email || '';
    state.accountEmailChange = {
        open: true,
        email: currentEmail,
        codeSent: false,
        expiresAt: 0,
    };
    stopAccountEmailChangeCountdown();
    renderMyPage();
}

function closeAccountEmailChangeDialog() {
    state.accountEmailChange = {
        open: false,
        email: '',
        codeSent: false,
        expiresAt: 0,
    };
    stopAccountEmailChangeCountdown();
    renderMyPage();
}

async function handleAccountEmailChangeCodeRequest() {
    if (!firebaseAuth?.currentUser || state.isLoginSubmitting) return;
    const email = document.getElementById('account-email-change-email')?.value.trim() || '';
    const currentEmail = state.account?.profile?.email || firebaseAuth.currentUser.email || '';
    if (!isValidEmailInput(email)) {
        showAppMessage(t('account_email_change_invalid'), { tone: 'error' });
        return;
    }
    if (email.toLowerCase() === String(currentEmail || '').toLowerCase()) {
        showAppMessage(t('account_email_change_same'), { tone: 'error' });
        return;
    }
    try {
        state.isLoginSubmitting = true;
        const token = await firebaseAuth.currentUser.getIdToken(true);
        const data = await apiRequestCurrentUserEmailChangeCode(token, email);
        state.accountEmailChange = {
            open: true,
            email,
            codeSent: true,
            expiresAt: data.expires_at ? Date.parse(data.expires_at) : Date.now() + 10 * 60 * 1000,
        };
        showAppMessage(t('auth_signup_code_sent'), { tone: 'success' });
        renderMyPage();
        startAccountEmailChangeCountdown();
    } catch (e) {
        const key = e?.message === 'email_taken'
            ? 'account_email_change_taken'
            : e?.message === 'email_unchanged'
                ? 'account_email_change_same'
                : 'auth_mail_send_failed';
        showAppMessage(t(key), { tone: 'error' });
    } finally {
        state.isLoginSubmitting = false;
        updateAccountEmailChangeCodeState();
    }
}

async function handleAccountEmailChangeConfirm() {
    if (!firebaseAuth?.currentUser || state.isLoginSubmitting) return;
    const email = state.accountEmailChange?.email || '';
    const code = document.getElementById('account-email-change-code')?.value.trim() || '';
    if (!email || !/^\d{6}$/.test(code)) {
        showAppMessage(t('auth_signup_code_invalid'), { tone: 'error' });
        return;
    }
    try {
        state.isLoginSubmitting = true;
        const token = await firebaseAuth.currentUser.getIdToken(true);
        state.account = await apiConfirmCurrentUserEmailChange(token, email, code);
        state.isAdmin = !!state.account?.is_admin;
        await firebaseAuth.currentUser.reload();
        await refreshAccountFromFirebaseUser();
        state.accountEmailChange = {
            open: false,
            email: '',
            codeSent: false,
            expiresAt: 0,
        };
        stopAccountEmailChangeCountdown();
        showAppMessage(t('account_email_change_success'), { tone: 'success' });
    } catch (e) {
        const key = e?.message === 'email_taken'
            ? 'account_email_change_taken'
            : e?.message === 'firebase_email_update_failed' || e?.message === 'profile_email_update_failed'
                ? 'account_email_change_failed'
                : 'auth_signup_code_invalid';
        showAppMessage(t(key), { tone: 'error' });
    } finally {
        state.isLoginSubmitting = false;
        renderSidebar();
        renderMyPage();
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
    state.account = await apiUpdateSocialProviders(token, getLinkedProviderIds().map(normalizeProviderKey));
    state.isAdmin = !!state.account?.is_admin;
    renderSidebar();
    return state.account;
}

async function handleLinkGoogleProvider() {
    return handleLinkSocialProvider('google');
}

async function handleLinkSocialProvider(providerKey) {
    if (!firebaseAuth?.currentUser || state.isLoginSubmitting) return;
    if (BACKEND_OAUTH_PROVIDERS[providerKey]) {
        return handleBackendOAuthLink(providerKey);
    }
    const providerConfig = SOCIAL_AUTH_PROVIDERS[providerKey];
    if (!providerConfig) return;
    let firebaseLinked = false;
    try {
        state.isLoginSubmitting = true;
        const provider = providerConfig.createProvider();
        await firebaseAuth.currentUser.linkWithPopup(provider);
        firebaseLinked = true;
        const token = await firebaseAuth.currentUser.getIdToken(true);
        state.account = await apiRecordFirebaseProviderLink(token, providerKey);
        state.isAdmin = !!state.account?.is_admin;
        renderSidebar();
        showAppMessage(t('auth_social_link_success'), { tone: 'success' });
    } catch (e) {
        if (firebaseLinked && providerKey === 'google') {
            try {
                await firebaseAuth.currentUser.unlink('google.com');
            } catch (unlinkError) {
                console.error('Firebase provider rollback failed', unlinkError);
            }
        }
        const code = e?.code || '';
        const message = code === 'auth/provider-already-linked'
            ? t('auth_social_already_linked')
            : t('auth_social_link_error');
        showAppMessage(message, { tone: 'error' });
    } finally {
        state.isLoginSubmitting = false;
        renderMyPage();
    }
}

async function handleBackendOAuthLink(providerKey) {
    if (!firebaseAuth?.currentUser || state.isLoginSubmitting) return;
    try {
        state.isLoginSubmitting = true;
        const token = await firebaseAuth.currentUser.getIdToken(true);
        const data = await apiStartBackendOAuthLink(token, providerKey);
        const popup = window.open(data.url, `${providerKey}_link`, 'width=480,height=720');
        if (!popup) {
            showAppMessage(t('auth_popup_blocked'), { tone: 'error' });
            state.isLoginSubmitting = false;
        }
    } catch (e) {
        showAppMessage(t('auth_social_link_error'), { tone: 'error' });
        state.isLoginSubmitting = false;
        renderMyPage();
    }
}

async function handleDeleteAccount() {
    if (!firebaseAuth?.currentUser || state.isLoginSubmitting) return;
    if (!window.confirm(t('mypage_delete_account_confirm'))) return;
    try {
        state.isLoginSubmitting = true;
        const token = await firebaseAuth.currentUser.getIdToken(true);
        await apiDeleteAccount(token);
        await firebaseAuth.signOut();
        setSignedOutState();
        showAppMessage(t('mypage_delete_account_success'), { tone: 'success' });
        navigateTo('login', renderLogin);
    } catch (e) {
        showAppMessage(t('mypage_delete_account_error', { detail: t(e?.message || 'account_delete_failed') }), { tone: 'error' });
    } finally {
        state.isLoginSubmitting = false;
        renderSidebar();
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
        await refreshSignedInGameState();
        renderSidebar();
        navigateTo('category', renderCategorySelection);
    } catch (e) {
        const detail = e?.message || '';
        const message = detail === 'display_name_taken'
            ? t('auth_display_name_taken')
            : getDisplayNameErrorMessage(detail || 'display_name_generic_error');
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
