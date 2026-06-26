let firebaseAuth = null;
let firebaseAnalytics = null;
let backendOAuthPopupTimerId = null;
let backendOAuthPopupWindow = null;

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
    return Array.from(new Set([...backendProviders.map(normalizeProviderKey), ...firebaseProviders]))
        .filter((provider) => provider && provider !== 'password');
}

function hasLinkedProvider(providerKey) {
    return getLinkedProviderKeys().includes(normalizeProviderKey(providerKey));
}

function hasPasswordLoginMethod() {
    return !!state.account?.profile?.login_id || getLinkedProviderIds().includes('password');
}

function getLoginMethodCount() {
    return (hasPasswordLoginMethod() ? 1 : 0) + getLinkedProviderKeys().length;
}

function canUnlinkProvider(providerKey) {
    return hasLinkedProvider(providerKey) && getLoginMethodCount() >= 2;
}

function requiresDisplayNameSetup() {
    return !!state.account?.profile && state.account.profile.display_name_set === false;
}

function redirectToDisplayNameSetup() {
    state.authMode = 'display_name';
    navigateTo('login', renderLogin);
}

function ensureDisplayNameSetupComplete() {
    if (!requiresDisplayNameSetup()) return true;
    redirectToDisplayNameSetup();
    return false;
}

const SOCIAL_AUTH_PROVIDERS = {
    google: {
        providerId: 'google.com',
        createProvider: () => new firebase.auth.GoogleAuthProvider(),
    },
};

const BACKEND_OAUTH_PROVIDERS = {
    kakao: {
        startUrl: `${API_BASE}/auth/oauth/kakao/start`,
    },
    naver: {
        startUrl: `${API_BASE}/auth/oauth/naver/start`,
    },
    github: {
        startUrl: `${API_BASE}/auth/oauth/github/start`,
    },
    discord: {
        startUrl: `${API_BASE}/auth/oauth/discord/start`,
    },
    steam: {
        startUrl: `${API_BASE}/auth/oauth/steam/start`,
    },
};

function setSignedOutState() {
    state.authUser = null;
    state.account = null;
    state.isAdmin = false;
    state.authDialogOpen = false;
    clearBlindSeed();
    if (typeof renderHeaderActions === 'function') {
        renderHeaderActions();
    }
}

function canParticipateWithAccount() {
    return !!state.authUser
        && !!state.account?.profile
        && state.account.profile.display_name_set !== false
        && state.account.profile.account_status !== 'admin_disabled';
}

function syncAuthDialogVisibility() {
    const onboardingLayer = document.getElementById('onboarding-layer');
    const contentLayer = document.getElementById('content-layer');
    const onboardingSlider = document.getElementById('onboarding-slider');
    if (!onboardingLayer || !contentLayer || !onboardingSlider) return;

    if (state.authDialogOpen) {
        onboardingLayer.classList.remove('hidden');
        onboardingLayer.classList.add('auth-dialog-layer');
        contentLayer.classList.remove('hidden');
        document.body.classList.add('auth-dialog-open');
        document.documentElement.classList.add('auth-dialog-open');
        onboardingSlider.style.transform = 'translate3d(0, 0, 0)';
        return;
    }

    onboardingLayer.classList.remove('auth-dialog-layer');
    document.body.classList.remove('auth-dialog-open');
    document.documentElement.classList.remove('auth-dialog-open');
    if (state.currentView?.id !== 'login') {
        onboardingLayer.classList.add('hidden');
    }
}

function openAuthDialog(mode = 'login') {
    if (state.isLoginSubmitting || canParticipateWithAccount()) return;
    state.authDialogOpen = true;
    state.authMode = mode === 'signup' ? 'signup' : 'login';
    renderLogin();
    syncAuthDialogVisibility();
}

function canCloseAuthDialog() {
    return state.authDialogOpen && !state.isLoginSubmitting && !requiresDisplayNameSetup() && !needsEmailVerification();
}

function closeAuthDialog() {
    if (!canCloseAuthDialog()) return;
    state.authDialogOpen = false;
    state.authMode = 'login';
    renderLogin();
    syncAuthDialogVisibility();
}

function completeAuthDialogSuccess() {
    if (!state.authDialogOpen) return false;
    state.authDialogOpen = false;
    state.authMode = 'login';
    syncAuthDialogVisibility();
    let navigationRendered = false;
    if (state.currentView?.id === 'play') {
        if (typeof rerenderPlayInteractionPanels === 'function') {
            rerenderPlayInteractionPanels();
        }
        void refreshCurrentCommentsView().catch((e) => console.error('Play comments refresh failed after auth dialog success', e));
    } else if (state.currentView?.id === 'results') {
        rerenderCurrentCommentsView();
        void refreshCurrentCommentsView().catch((e) => console.error('Results comments refresh failed after auth dialog success', e));
    } else {
        rerenderPostAuthDataViews();
        navigationRendered = true;
    }
    if (!navigationRendered) renderGlobalNavigation();
    return true;
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
    const code = error?.code || error?.message || '';
    const messages = {
        ko: {
            invalidEmail: mode === 'signup' ? '회원가입 입력 정보가 올바르지 않습니다.' : '로그인 정보가 올바르지 않습니다.',
            wrongCredentials: '계정을 다시 확인해주세요.',
            weakPassword: '비밀번호는 6자 이상으로 입력하세요.',
            emailInUse: '이미 가입된 이메일입니다. 로그인하거나 비밀번호 찾기를 이용하세요.',
            emailTaken: '사용중인 이메일입니다. 다른 이메일을 입력해주세요.',
            popupClosed: '로그인이 취소되었습니다.',
            unauthorizedDomain: '현재 접속 주소가 Firebase 로그인 허용 도메인에 등록되어 있지 않습니다.',
            resetSent: '비밀번호 재설정 메일을 보냈습니다.',
            resetEmailRequired: '비밀번호를 찾을 이메일을 입력하세요.',
            resetEmailInvalid: '이메일 주소를 올바르게 입력하세요.',
            invalidRecoveryInput: mode === 'login' ? '계정을 다시 확인해주세요.' : '입력이 잘못되었습니다.',
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
            wrongCredentials: 'Check your account information and try again.',
            weakPassword: 'Enter a password with at least 6 characters.',
            emailInUse: 'This email is already registered. Log in or reset your password.',
            emailTaken: 'This email is already in use. Enter a different email address.',
            popupClosed: 'Sign-in was cancelled.',
            unauthorizedDomain: 'This address is not registered as an authorized Firebase login domain.',
            resetSent: 'Password reset email sent.',
            resetEmailRequired: 'Enter your email to reset your password.',
            resetEmailInvalid: 'Enter a valid email address.',
            invalidRecoveryInput: mode === 'login' ? 'Check your account information and try again.' : 'The information is not valid.',
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
    if (code === 'email_taken') return bucket.emailTaken;
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
    if (code === 'login_id_reserved') return t('login_id_reserved');
    if (code === 'account_suspended') return t('account_suspended');
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
    if (((state.language || 'ko').split('-')[0] || 'ko') === 'en') {
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
            message.textContent = e?.message === 'login_id_reserved' ? t('login_id_reserved') : t('auth_login_id_check_failed');
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

function getAccountLoginIdSetupCountdownText() {
    const remaining = Math.max(0, Math.ceil((Number(state.accountLoginIdSetup?.expiresAt || 0) - Date.now()) / 1000));
    const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
    const seconds = String(remaining % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
}

function updateAccountLoginIdSetupCodeState() {
    const button = document.getElementById('account-login-id-code-confirm-btn');
    const countdown = document.getElementById('account-login-id-code-countdown');
    const code = document.getElementById('account-login-id-code')?.value.trim() || '';
    const expiresAt = Number(state.accountLoginIdSetup?.expiresAt || 0);
    const isExpired = expiresAt > 0 && Date.now() >= expiresAt;
    if (countdown) {
        countdown.textContent = t('auth_signup_code_countdown', { time: getAccountLoginIdSetupCountdownText() });
    }
    if (button) {
        button.disabled = !state.authConfigured || state.isLoginSubmitting || isExpired || !/^\d{6}$/.test(code);
    }
}

function updateAccountLoginIdSetupSubmitState() {
    const button = document.getElementById('account-login-id-submit-btn');
    if (!button) return;
    button.disabled = !state.authConfigured
        || state.isLoginSubmitting
        || !state.accountLoginIdSetup?.token;
}

function stopAccountLoginIdSetupCountdown() {
    if (state.accountLoginIdSetupTimerId) {
        window.clearInterval(state.accountLoginIdSetupTimerId);
        state.accountLoginIdSetupTimerId = null;
    }
}

function startAccountLoginIdSetupCountdown() {
    stopAccountLoginIdSetupCountdown();
    if (!state.accountLoginIdSetup?.open || !state.accountLoginIdSetup?.codeSent || state.accountLoginIdSetup?.token) {
        return;
    }
    updateAccountLoginIdSetupCodeState();
    state.accountLoginIdSetupTimerId = window.setInterval(() => {
        updateAccountLoginIdSetupCodeState();
        const expiresAt = Number(state.accountLoginIdSetup?.expiresAt || 0);
        if (expiresAt && Date.now() >= expiresAt) {
            stopAccountLoginIdSetupCountdown();
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
        if (!RUNTIME_CONFIG.gaMeasurementId && config.measurementId && firebase.analytics) {
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
                    renderGlobalNavigation();
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

function rerenderPostAuthDataViews() {
    if (state.currentView?.id === 'home') {
        renderLanding();
    } else if (state.currentView?.id === 'list') {
        renderGameList();
    } else if (state.currentView?.id === 'play') {
        if (typeof rerenderPlayInteractionPanels === 'function') {
            rerenderPlayInteractionPanels();
        }
        rerenderCurrentCommentsView();
    } else if (state.currentView?.id === 'results') {
        rerenderCurrentCommentsView();
    } else if (state.currentView?.id === 'mypage') {
        renderMyPage();
    } else if (state.currentView?.id === 'admin') {
        renderAdminPage();
    }
    renderGlobalNavigation();
}

function setAuthBusyState(isBusy, context = '') {
    state.isLoginSubmitting = isBusy;
    state.authBusyContext = isBusy ? context : '';
}

function setAuthBusyContext(context) {
    if (!state.isLoginSubmitting) return;
    state.authBusyContext = context || '';
    rerenderAuthBusySurface();
}

function startAuthPerformanceTrace(operation) {
    return {
        operation,
        startedAt: window.performance?.now?.() || Date.now(),
        lastStepAt: window.performance?.now?.() || Date.now(),
        steps: [],
    };
}

function markAuthPerformanceStep(trace, step) {
    if (!trace) return;
    const now = window.performance?.now?.() || Date.now();
    trace.steps.push({
        step,
        durationMs: Number((now - trace.lastStepAt).toFixed(1)),
        elapsedMs: Number((now - trace.startedAt).toFixed(1)),
    });
    trace.lastStepAt = now;
}

function finishAuthPerformanceTrace(trace, outcome = 'success') {
    if (!trace) return null;
    const now = window.performance?.now?.() || Date.now();
    const result = {
        operation: trace.operation,
        outcome,
        totalMs: Number((now - trace.startedAt).toFixed(1)),
        steps: trace.steps,
        recordedAt: new Date().toISOString(),
    };
    state.authPerformance = [...(state.authPerformance || []), result].slice(-20);
    console.info('[auth-perf]', result);
    return result;
}

function getAuthPerformanceReport() {
    return [...(state.authPerformance || [])];
}

function getAuthBusyMessage() {
    const contextKeys = {
        login_submit: 'auth_busy_login_prepare',
        login_resolve_id: 'auth_busy_login_resolve',
        login_authenticate: 'auth_busy_login_authenticate',
        signup_code_send: 'auth_busy_code_send',
        signup_code_resend: 'auth_busy_code_send',
        signup_code_confirm: 'auth_busy_code_confirm',
        signup_submit: 'auth_busy_signup_prepare',
        signup_account_create: 'auth_busy_signup_create',
        signup_profile_save: 'auth_busy_profile_save',
        auth_profile_load: 'auth_busy_profile_load',
        display_name_submit: 'auth_busy_display_name_save',
    };
    return t(contextKeys[state.authBusyContext] || 'auth_login_processing');
}

function rerenderAuthBusySurface() {
    if (state.currentView?.id === 'mypage') {
        renderMyPage();
        return;
    }
    if (state.authDialogOpen || state.currentView?.id === 'login' || ['login', 'signup', 'display_name', 'verify_email', 'help', 'find_id', 'reset_password'].includes(state.authMode)) {
        renderLogin();
    }
}

function syncCurrentAuthUserSnapshot() {
    if (!firebaseAuth?.currentUser) {
        state.authUser = null;
        return;
    }
    state.authUser = firebaseAuth.currentUser;
}

async function refreshGameCatalog(options = {}) {
    const { rerender = true } = options;
    if (state.gamesRefreshPromise) {
        await state.gamesRefreshPromise;
        if (rerender) rerenderPostAuthDataViews();
        return;
    }
    const startedAt = window.performance?.now?.() || Date.now();
    state.gamesLoading = true;
    if (rerender) rerenderPostAuthDataViews();
    state.gamesRefreshPromise = (async () => {
        await apiFetchGames();
        const elapsedMs = (window.performance?.now?.() || Date.now()) - startedAt;
        console.info(`[perf] apiFetchGames ${elapsedMs.toFixed(1)}ms`);
    })();
    try {
        await state.gamesRefreshPromise;
    } finally {
        state.gamesRefreshPromise = null;
        state.gamesLoading = false;
        if (rerender) rerenderPostAuthDataViews();
    }
}

async function refreshUserEvaluations(options = {}) {
    const { rerender = true, force = false, minFreshMs = 0 } = options;
    if (!firebaseAuth?.currentUser) {
        state.userEvals = [];
        state.userEvalsLoading = false;
        state.userEvalsFetchedAt = 0;
        if (rerender) rerenderPostAuthDataViews();
        return;
    }
    const nowMs = Date.now();
    if (!force && !state.userEvalsLoading && state.userEvalsFetchedAt && (nowMs - state.userEvalsFetchedAt) < minFreshMs) {
        if (rerender) rerenderPostAuthDataViews();
        return;
    }
    if (state.userEvalsRefreshPromise) {
        await state.userEvalsRefreshPromise;
        if (rerender) rerenderPostAuthDataViews();
        return;
    }
    const startedAt = window.performance?.now?.() || Date.now();
    state.userEvalsLoading = true;
    state.userEvalsRefreshPromise = (async () => {
        await apiFetchUserEvals();
        state.userEvalsFetchedAt = Date.now();
        const elapsedMs = (window.performance?.now?.() || Date.now()) - startedAt;
        console.info(`[perf] apiFetchUserEvals ${elapsedMs.toFixed(1)}ms`);
    })();
    try {
        await state.userEvalsRefreshPromise;
    } finally {
        state.userEvalsRefreshPromise = null;
        state.userEvalsLoading = false;
        if (rerender) rerenderPostAuthDataViews();
    }
}

async function refreshAccountFromFirebaseUser(options = {}) {
    const { forceTokenRefresh = false, renderNavigation = true } = options;
    if (!firebaseAuth?.currentUser) return null;
    const startedAt = window.performance?.now?.() || Date.now();
    const token = await firebaseAuth.currentUser.getIdToken(forceTokenRefresh);
    syncCurrentAuthUserSnapshot();
    syncBlindSeedForAuthUser(firebaseAuth.currentUser.uid);
    state.account = await apiFetchAuthMe(token);
    state.isAdmin = !!state.account?.is_admin;
    const elapsedMs = (window.performance?.now?.() || Date.now()) - startedAt;
    console.info(`[perf] apiFetchAuthMe ${elapsedMs.toFixed(1)}ms forceTokenRefresh=${forceTokenRefresh}`);
    if (renderNavigation) renderGlobalNavigation();
    return state.account;
}

function refreshSignedInGameState(options = {}) {
    const {
        waitForGames = true,
        waitForUserEvals = false,
        rerender = true,
    } = options;

    const gamePromise = refreshGameCatalog({ rerender }).catch((e) => {
        console.error('Game data load failed', e);
    });
    const userEvalPromise = refreshUserEvaluations({ rerender }).catch((e) => {
        console.error('User evaluation load failed', e);
    });

    return {
        gamePromise: waitForGames ? gamePromise : Promise.resolve(),
        userEvalPromise: waitForUserEvals ? userEvalPromise : Promise.resolve(),
        allPromise: Promise.allSettled([gamePromise, userEvalPromise]),
    };
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

    const trace = startAuthPerformanceTrace(mode === 'signup' ? 'email_signup' : 'email_login');
    let outcome = 'error';
    try {
        setAuthBusyState(true, mode === 'signup' ? 'signup_submit' : 'login_submit');
        rerenderAuthBusySurface();
        if (mode === 'signup') {
            setAuthBusyContext('signup_account_create');
            await firebaseAuth.createUserWithEmailAndPassword(email, password);
            markAuthPerformanceStep(trace, 'firebase_account_created');
            setAuthBusyContext('signup_profile_save');
            await firebaseAuth.currentUser.updateProfile({ displayName: identity.display_name });
            await saveProfileIdentity(identity);
            markAuthPerformanceStep(trace, 'profile_identity_saved');
            state.signupEmailVerification = { email: '', codeSent: false, expiresAt: 0, token: '' };
            state.loginIdAvailability = { value: '', status: 'idle', message: '' };
            state.displayNameAvailability = { value: '', status: 'idle', message: '' };
            showAppMessage(t('auth_signup_complete'), { tone: 'success' });
        } else {
            setAuthBusyContext('login_resolve_id');
            const data = await apiResolveLoginIdEmail(email);
            markAuthPerformanceStep(trace, 'login_id_resolved');
            setAuthBusyContext('login_authenticate');
            await firebaseAuth.signInWithEmailAndPassword(data.email, password);
            markAuthPerformanceStep(trace, 'firebase_authenticated');
        }
        setAuthBusyContext('auth_profile_load');
        await refreshAccountFromFirebaseUser({ renderNavigation: false });
        markAuthPerformanceStep(trace, 'account_profile_loaded');
        if (needsEmailVerification()) {
            outcome = 'verification_required';
            state.authMode = 'verify_email';
            renderLogin();
            showAppMessage(t('auth_email_verification_required'), { tone: 'error' });
            return;
        }
        if (state.account?.profile && !state.account.profile.display_name_set) {
            outcome = 'display_name_required';
            state.authMode = 'display_name';
            renderLogin();
            return;
        }
        const { allPromise } = refreshSignedInGameState({
            waitForGames: false,
            waitForUserEvals: false,
            rerender: false,
        });
        if (!completeAuthDialogSuccess()) {
            navigateTo('home', renderLanding);
        }
        markAuthPerformanceStep(trace, 'interactive_ui_ready');
        outcome = 'success';
        void allPromise.then(() => {
            markAuthPerformanceStep(trace, 'background_data_synced');
            finishAuthPerformanceTrace(trace, outcome);
        });
    } catch (e) {
        showAppMessage(getFriendlyAuthError(e, mode), { tone: 'error' });
        if (mode === 'signup' && firebaseAuth.currentUser) {
            state.authMode = 'display_name';
            renderLogin();
        }
    } finally {
        if (outcome !== 'success') finishAuthPerformanceTrace(trace, outcome);
        setAuthBusyState(false);
        rerenderAuthBusySurface();
    }
}

async function handleSignupEmailCodeRequest() {
    if (state.isLoginSubmitting) return;
    const email = document.getElementById('auth-email')?.value.trim() || state.signupEmailVerification?.email || '';
    const wasCodeSent = !!state.signupEmailVerification?.codeSent;
    if (!isValidEmailInput(email)) {
        showAppMessage(getFriendlyAuthError({ code: 'auth/invalid-email' }, 'signup'), { tone: 'error' });
        return;
    }
    const trace = startAuthPerformanceTrace(wasCodeSent ? 'signup_code_resend' : 'signup_code_send');
    let outcome = 'error';
    try {
        setAuthBusyState(true, wasCodeSent ? 'signup_code_resend' : 'signup_code_send');
        renderLogin();
        const data = await apiRequestSignupEmailCode(email);
        markAuthPerformanceStep(trace, 'verification_code_requested');
        state.signupEmailVerification = {
            email,
            codeSent: true,
            expiresAt: Date.now() + (Number(data.expires_in_seconds || 300) * 1000),
            token: '',
        };
        showAppMessage(
            wasCodeSent
                ? t('auth_signup_code_resent')
                : t('auth_signup_code_sent'),
            { tone: 'success' }
        );
        outcome = 'success';
    } catch (e) {
        showAppMessage(getFriendlyAuthError({ code: e?.message || 'mail_send_failed' }, 'signup'), { tone: 'error' });
    } finally {
        finishAuthPerformanceTrace(trace, outcome);
        setAuthBusyState(false);
        renderLogin();
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
    const trace = startAuthPerformanceTrace('signup_code_confirm');
    let outcome = 'error';
    try {
        setAuthBusyState(true, 'signup_code_confirm');
        renderLogin();
        const data = await apiConfirmSignupEmailCode(email, code);
        markAuthPerformanceStep(trace, 'verification_code_confirmed');
        state.signupEmailVerification = {
            ...state.signupEmailVerification,
            token: data.email_verification_token || '',
        };
        stopSignupEmailCountdown();
        renderLogin();
        showAppMessage(t('auth_signup_email_verified'), { tone: 'success' });
        outcome = 'success';
    } catch (e) {
        showAppMessage(t('auth_signup_code_invalid'), { tone: 'error' });
    } finally {
        finishAuthPerformanceTrace(trace, outcome);
        setAuthBusyState(false);
        renderLogin();
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
        setAuthBusyState(true, 'verify_email_resend');
        renderLogin();
        await firebaseAuth.currentUser.sendEmailVerification();
        showAppMessage(t('auth_email_verification_resent'), { tone: 'success' });
    } catch (e) {
        showAppMessage(getFriendlyAuthError(e, 'login'), { tone: 'error' });
    } finally {
        setAuthBusyState(false);
        renderLogin();
    }
}

async function handleVerifyEmailRefresh() {
    if (!firebaseAuth?.currentUser || state.isLoginSubmitting) return;
    try {
        setAuthBusyState(true, 'verify_email_check');
        renderLogin();
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
        const { allPromise } = refreshSignedInGameState({
            waitForGames: false,
            waitForUserEvals: false,
            rerender: false,
        });
        if (!completeAuthDialogSuccess()) {
            navigateTo('home', renderLanding);
        }
        void allPromise;
    } catch (e) {
        showAppMessage(getFriendlyAuthError(e, 'login'), { tone: 'error' });
    } finally {
        setAuthBusyState(false);
        rerenderAuthBusySurface();
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
        setAuthBusyState(true, `social_login_${providerKey}`);
        renderLogin();
        const provider = providerConfig.createProvider();
        await firebaseAuth.signInWithPopup(provider);
        await refreshAccountFromFirebaseUser({ renderNavigation: false });
        if (state.account?.profile && !state.account.profile.display_name_set) {
            state.authMode = 'display_name';
            if (state.authDialogOpen) {
                renderLogin();
                syncAuthDialogVisibility();
            } else {
                navigateTo('login', renderLogin);
            }
            return;
        }
        const { allPromise } = refreshSignedInGameState({
            waitForGames: false,
            waitForUserEvals: false,
            rerender: false,
        });
        if (!completeAuthDialogSuccess()) {
            navigateTo('home', renderLanding);
        }
        void allPromise;
    } catch (e) {
        showAppMessage(getFriendlyAuthError(e, 'login'), { tone: 'error' });
    } finally {
        setAuthBusyState(false);
        rerenderAuthBusySurface();
    }
}

function handleBackendOAuthLogin(providerKey) {
    const providerConfig = BACKEND_OAUTH_PROVIDERS[providerKey];
    if (!providerConfig) return;
    const popup = window.open(providerConfig.startUrl, `${providerKey}_login`, 'width=480,height=720');
    if (!popup) {
        showAppMessage(t('auth_popup_blocked'), { tone: 'error' });
        return;
    }
    watchBackendOAuthPopup(popup, false);
}

function watchBackendOAuthPopup(popup, isLinking) {
    if (backendOAuthPopupTimerId) {
        clearInterval(backendOAuthPopupTimerId);
        backendOAuthPopupTimerId = null;
    }
    backendOAuthPopupWindow = popup;
    backendOAuthPopupTimerId = setInterval(() => {
        if (!popup || !popup.closed) return;
        clearInterval(backendOAuthPopupTimerId);
        backendOAuthPopupTimerId = null;
        if (backendOAuthPopupWindow === popup) {
            backendOAuthPopupWindow = null;
        }
        if (isLinking && state.isLoginSubmitting) {
            setAuthBusyState(false);
            renderMyPage();
        }
    }, 500);
}

async function handleBackendOAuthMessage(event) {
    if (event.origin !== API_ORIGIN) return;
    if (!backendOAuthPopupWindow || event.source !== backendOAuthPopupWindow) return;
    const data = event.data || {};
    if (!data || typeof data !== 'object') return;

    if (data.type === 'oauth_cancelled') {
        const isLinking = state.isLoginSubmitting && !!firebaseAuth?.currentUser;
        if (backendOAuthPopupTimerId) {
            clearInterval(backendOAuthPopupTimerId);
            backendOAuthPopupTimerId = null;
        }
        backendOAuthPopupWindow = null;
        setAuthBusyState(false);
        if (isLinking) renderMyPage();
        return;
    }

    if (data.type === 'oauth_error') {
        const isLinking = state.isLoginSubmitting && !!firebaseAuth?.currentUser;
        if (backendOAuthPopupTimerId) {
            clearInterval(backendOAuthPopupTimerId);
            backendOAuthPopupTimerId = null;
        }
        backendOAuthPopupWindow = null;
        console.error('OAuth popup error', data.provider, data.detail);
        const knownDetailKeys = ['oauth_provider_already_in_use'];
        let errorMessage;
        if (knownDetailKeys.includes(data.detail)) {
            errorMessage = t(data.detail);
        } else {
            const baseMessage = t(isLinking ? 'auth_social_link_error' : 'auth_social_login_error');
            const detail = data.detail ? ` (${data.detail})` : '';
            errorMessage = `${baseMessage}${detail}`;
        }
        showAppMessage(errorMessage, { tone: 'error' });
        setAuthBusyState(false);
        if (isLinking) renderMyPage();
        return;
    }

    if (data.type === 'oauth_link_success') {
        if (backendOAuthPopupTimerId) {
            clearInterval(backendOAuthPopupTimerId);
            backendOAuthPopupTimerId = null;
        }
        backendOAuthPopupWindow = null;
        try {
            await refreshAccountFromFirebaseUser();
            showAppMessage(t('auth_social_link_success'), { tone: 'success' });
        } catch (e) {
            showAppMessage(t('auth_social_link_error'), { tone: 'error' });
        } finally {
            setAuthBusyState(false);
            renderMyPage();
        }
        return;
    }

    if (data.type !== 'oauth_custom_token' || !data.customToken) return;
    if (!firebaseAuth || state.isLoginSubmitting) return;

    try {
        setAuthBusyState(true, 'social_login_custom_token');
        renderLogin();
        await firebaseAuth.signInWithCustomToken(data.customToken);
        if (backendOAuthPopupTimerId) {
            clearInterval(backendOAuthPopupTimerId);
            backendOAuthPopupTimerId = null;
        }
        backendOAuthPopupWindow = null;
        await refreshAccountFromFirebaseUser({ renderNavigation: false });
        if (state.account?.profile && !state.account.profile.display_name_set) {
            state.authMode = 'display_name';
            if (state.authDialogOpen) {
                renderLogin();
                syncAuthDialogVisibility();
            } else {
                navigateTo('login', renderLogin);
            }
            return;
        }
        const { allPromise } = refreshSignedInGameState({
            waitForGames: false,
            waitForUserEvals: false,
            rerender: false,
        });
        if (!completeAuthDialogSuccess()) {
            navigateTo('home', renderLanding);
        }
        void allPromise;
    } catch (e) {
        showAppMessage(getFriendlyAuthError(e, 'login'), { tone: 'error' });
    } finally {
        setAuthBusyState(false);
        rerenderAuthBusySurface();
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
    const profile = state.account?.profile || {};
    if (!profile.login_id) {
        showAppMessage(t('mypage_password_reset_requires_login_id'), { tone: 'error' });
        return;
    }
    try {
        setAuthBusyState(true, 'password_reset');
        renderMyPage();
        if (profile.real_name && profile.login_id && profile.email) {
            await apiRecoverPassword({
                real_name: profile.real_name,
                login_id: profile.login_id,
                email: profile.email,
            });
        } else if (firebaseAuth?.currentUser) {
            const token = await firebaseAuth.currentUser.getIdToken();
            await apiSendCurrentUserPasswordReset(token);
        } else {
            throw new Error('invalid_recovery_input');
        }
        showAppMessage(getFriendlyAuthError({ code: 'auth/reset-sent' }, 'login'), { tone: 'success' });
    } catch (e) {
        showAppMessage(getFriendlyAuthError({ code: e?.message || 'mail_send_failed' }, 'login'), { tone: 'error' });
    } finally {
        setAuthBusyState(false);
        renderMyPage();
    }
}

function openAccountEmailChangeDialog() {
    if (!state.account?.profile?.login_id) {
        showAppMessage(t('account_email_change_requires_login_id'), { tone: 'error' });
        return;
    }
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
    const wasCodeSent = !!state.accountEmailChange?.codeSent;
    if (!isValidEmailInput(email)) {
        showAppMessage(t('account_email_change_invalid'), { tone: 'error' });
        return;
    }
    if (email.toLowerCase() === String(currentEmail || '').toLowerCase()) {
        showAppMessage(t('account_email_change_same'), { tone: 'error' });
        return;
    }
    try {
        setAuthBusyState(true, wasCodeSent ? 'account_email_code_resend' : 'account_email_code_send');
        renderMyPage();
        const token = await firebaseAuth.currentUser.getIdToken();
        const data = await apiRequestCurrentUserEmailChangeCode(token, email);
        state.accountEmailChange = {
            open: true,
            email,
            codeSent: true,
            expiresAt: Date.now() + (Number(data.expires_in_seconds || 300) * 1000),
        };
        showAppMessage(
            wasCodeSent
                ? t('auth_signup_code_resent')
                : t('auth_signup_code_sent'),
            { tone: 'success' }
        );
    } catch (e) {
        const key = e?.message === 'email_taken'
            ? 'account_email_change_taken'
            : e?.message === 'email_unchanged'
                ? 'account_email_change_same'
                : 'auth_mail_send_failed';
        showAppMessage(t(key), { tone: 'error' });
    } finally {
        setAuthBusyState(false);
        renderMyPage();
        updateAccountEmailChangeCodeState();
        startAccountEmailChangeCountdown();
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
        setAuthBusyState(true, 'account_email_code_confirm');
        renderMyPage();
        const token = await firebaseAuth.currentUser.getIdToken();
        state.account = await apiConfirmCurrentUserEmailChange(token, email, code);
        state.isAdmin = !!state.account?.is_admin;
        await firebaseAuth.currentUser.reload();
        syncCurrentAuthUserSnapshot();
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
        setAuthBusyState(false);
        renderGlobalNavigation();
        renderMyPage();
    }
}

function openAccountLoginIdSetupDialog() {
    const currentEmail = state.account?.profile?.email || firebaseAuth?.currentUser?.email || '';
    state.accountLoginIdSetup = {
        open: true,
        email: currentEmail,
        codeSent: false,
        expiresAt: 0,
        token: '',
    };
    state.loginIdAvailability = { value: '', status: 'idle', message: '' };
    stopAccountLoginIdSetupCountdown();
    renderMyPage();
}

function closeAccountLoginIdSetupDialog() {
    state.accountLoginIdSetup = {
        open: false,
        email: '',
        codeSent: false,
        expiresAt: 0,
        token: '',
    };
    state.loginIdAvailability = { value: '', status: 'idle', message: '' };
    stopAccountLoginIdSetupCountdown();
    renderMyPage();
}

function handleAccountLoginIdInput() {
    const loginId = document.getElementById('account-login-id')?.value.trim() || '';
    if (state.loginIdAvailability?.value !== loginId) {
        state.loginIdAvailability = { value: loginId, status: 'idle', message: '' };
    }
    const message = document.getElementById('account-login-id-availability');
    if (message) {
        message.textContent = loginId ? t('auth_login_id_check_required') : '';
        message.className = 'auth-field-message';
    }
    updateAccountLoginIdSetupSubmitState();
}

async function handleAccountLoginIdAvailabilityCheck() {
    const loginId = document.getElementById('account-login-id')?.value.trim() || '';
    const message = document.getElementById('account-login-id-availability');
    if (!isValidLoginId(loginId)) {
        state.loginIdAvailability = { value: loginId, status: 'invalid', message: 'login_id_format' };
        if (message) {
            message.textContent = t('auth_login_id_format_error');
            message.className = 'auth-field-message invalid';
        }
        updateAccountLoginIdSetupSubmitState();
        return;
    }
    try {
        state.loginIdAvailability = { value: loginId, status: 'checking', message: '' };
        if (message) {
            message.textContent = t('auth_login_id_checking');
            message.className = 'auth-field-message';
        }
        updateAccountLoginIdSetupSubmitState();
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
            message.textContent = e?.message === 'login_id_reserved' ? t('login_id_reserved') : t('auth_login_id_check_failed');
            message.className = 'auth-field-message invalid';
        }
    } finally {
        updateAccountLoginIdSetupSubmitState();
    }
}

async function handleAccountLoginIdSetupCodeRequest() {
    if (!firebaseAuth?.currentUser || state.isLoginSubmitting) return;
    const email = document.getElementById('account-login-id-email')?.value.trim() || state.accountLoginIdSetup?.email || '';
    const wasCodeSent = !!state.accountLoginIdSetup?.codeSent;
    if (!isValidEmailInput(email)) {
        showAppMessage(t('account_login_id_create_invalid_email'), { tone: 'error' });
        return;
    }
    try {
        setAuthBusyState(true, wasCodeSent ? 'account_login_id_code_resend' : 'account_login_id_code_send');
        renderMyPage();
        const token = await firebaseAuth.currentUser.getIdToken();
        const data = await apiRequestCurrentUserLoginIdCode(token, email);
        state.accountLoginIdSetup = {
            open: true,
            email,
            codeSent: true,
            expiresAt: Date.now() + (Number(data.expires_in_seconds || 300) * 1000),
            token: '',
        };
        showAppMessage(
            wasCodeSent
                ? t('auth_signup_code_resent')
                : t('auth_signup_code_sent'),
            { tone: 'success' }
        );
    } catch (e) {
        const key = e?.message === 'email_taken'
            ? 'account_login_id_create_email_taken'
            : e?.message === 'login_id_already_set'
                ? 'account_login_id_already_set'
                : 'auth_mail_send_failed';
        showAppMessage(t(key), { tone: 'error' });
    } finally {
        setAuthBusyState(false);
        renderMyPage();
        updateAccountLoginIdSetupCodeState();
        startAccountLoginIdSetupCountdown();
    }
}

async function handleAccountLoginIdSetupCodeConfirm() {
    if (state.isLoginSubmitting) return;
    const email = state.accountLoginIdSetup?.email || '';
    const code = document.getElementById('account-login-id-code')?.value.trim() || '';
    if (!email || !/^\d{6}$/.test(code)) {
        showAppMessage(t('auth_signup_code_invalid'), { tone: 'error' });
        return;
    }
    try {
        setAuthBusyState(true, 'account_login_id_code_confirm');
        renderMyPage();
        const data = await apiConfirmSignupEmailCode(email, code);
        state.accountLoginIdSetup = {
            ...(state.accountLoginIdSetup || {}),
            open: true,
            token: data.email_verification_token || '',
        };
        stopAccountLoginIdSetupCountdown();
        showAppMessage(t('auth_signup_email_verified'), { tone: 'success' });
    } catch (e) {
        showAppMessage(t('auth_signup_code_invalid'), { tone: 'error' });
    } finally {
        setAuthBusyState(false);
        renderMyPage();
        updateAccountLoginIdSetupSubmitState();
    }
}

async function handleAccountLoginIdSetupSubmit() {
    if (!firebaseAuth?.currentUser || state.isLoginSubmitting) return;
    const email = state.accountLoginIdSetup?.email || '';
    const verificationToken = state.accountLoginIdSetup?.token || '';
    const loginId = document.getElementById('account-login-id')?.value.trim() || '';
    const realName = document.getElementById('account-real-name')?.value.trim() || '';
    const password = document.getElementById('account-password')?.value || '';
    const passwordConfirm = document.getElementById('account-password-confirm')?.value || '';
    const loginIdReady = state.loginIdAvailability?.value === loginId && state.loginIdAvailability?.status === 'available';

    if (!verificationToken || !isValidEmailInput(email)) {
        showAppMessage(t('auth_email_verification_required'), { tone: 'error' });
        return;
    }
    if (!loginIdReady) {
        showAppMessage(t('auth_login_id_check_required'), { tone: 'error' });
        return;
    }
    if (!isValidRealName(realName)) {
        showAppMessage(t('auth_real_name_format_error'), { tone: 'error' });
        return;
    }
    if (!isValidSignupPassword(password) || password !== passwordConfirm) {
        showAppMessage(t('auth_password_confirm_mismatch'), { tone: 'error' });
        return;
    }

    try {
        setAuthBusyState(true, 'account_login_id_submit');
        renderMyPage();
        if (!getLinkedProviderIds().includes('password')) {
            const credential = firebase.auth.EmailAuthProvider.credential(email, password);
            await firebase.auth().currentUser.linkWithCredential(credential);
        }
        const token = await firebaseAuth.currentUser.getIdToken(true);
        state.account = await apiCreateCurrentUserLoginId(token, {
            login_id: loginId,
            real_name: realName,
            email_verification_token: verificationToken,
            language: state.language || 'ko',
        });
        state.isAdmin = !!state.account?.is_admin;
        await firebaseAuth.currentUser.reload();
        syncCurrentAuthUserSnapshot();
        closeAccountLoginIdSetupDialog();
        showAppMessage(t('account_login_id_create_success'), { tone: 'success' });
    } catch (e) {
        console.error('Account login ID setup failed', e);
        const detail = e?.code || e?.message || 'login_id_create_failed';
        const key = detail === 'auth/email-already-in-use' || detail === 'email_taken'
            ? 'account_login_id_create_email_taken'
            : detail === 'auth/provider-already-linked'
                ? 'account_login_id_already_set'
                : detail === 'auth/operation-not-allowed'
                    ? 'account_login_id_create_error'
            : detail === 'login_id_taken'
                ? 'auth_login_id_taken'
                : detail === 'login_id_already_set'
                    ? 'account_login_id_already_set'
                    : 'account_login_id_create_error';
        showAppMessage(t(key), { tone: 'error' });
    } finally {
        setAuthBusyState(false);
        renderGlobalNavigation();
        renderMyPage();
    }
}

async function saveDisplayName(displayName) {
    if (!firebaseAuth?.currentUser) return null;
    const token = await firebaseAuth.currentUser.getIdToken();
    state.account = await apiUpdateProfileDisplayName(token, displayName);
    state.isAdmin = !!state.account?.is_admin;
    return state.account;
}

async function saveProfileIdentity(identity) {
    if (!firebaseAuth?.currentUser) return null;
    const token = await firebaseAuth.currentUser.getIdToken();
    state.account = await apiUpdateProfileIdentity(token, identity);
    state.isAdmin = !!state.account?.is_admin;
    return state.account;
}

async function syncSocialProviders() {
    if (!firebaseAuth?.currentUser) return null;
    const token = await firebaseAuth.currentUser.getIdToken();
    state.account = await apiUpdateSocialProviders(token, getLinkedProviderIds().map(normalizeProviderKey));
    state.isAdmin = !!state.account?.is_admin;
    renderGlobalNavigation();
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
        setAuthBusyState(true, `provider_link_${providerKey}`);
        renderMyPage();
        const provider = providerConfig.createProvider();
        await firebaseAuth.currentUser.linkWithPopup(provider);
        firebaseLinked = true;
        const token = await firebaseAuth.currentUser.getIdToken();
        state.account = await apiRecordFirebaseProviderLink(token, providerKey);
        state.isAdmin = !!state.account?.is_admin;
        renderGlobalNavigation();
        showAppMessage(t('auth_social_link_success'), { tone: 'success' });
    } catch (e) {
        console.error('Social provider link failed', providerKey, e);
        if (firebaseLinked && providerKey === 'google') {
            try {
                await firebaseAuth.currentUser.unlink('google.com');
            } catch (unlinkError) {
                console.error('Firebase provider rollback failed', unlinkError);
            }
        }
        const code = e?.code || '';
        const message = (
            code === 'auth/provider-already-linked'
            || code === 'auth/credential-already-in-use'
            || code === 'auth/account-exists-with-different-credential'
            || code === 'auth/email-already-in-use'
        )
            ? t('oauth_provider_already_in_use')
            : t('auth_social_link_error');
        showAppMessage(message, { tone: 'error' });
    } finally {
        setAuthBusyState(false);
        renderMyPage();
    }
}

async function handleBackendOAuthLink(providerKey) {
    if (!firebaseAuth?.currentUser || state.isLoginSubmitting) return;
    try {
        setAuthBusyState(true, `provider_link_${providerKey}`);
        renderMyPage();
        const data = await apiStartBackendOAuthLink(providerKey);
        const popup = window.open(data.url, `${providerKey}_link`, 'width=480,height=720');
        if (!popup) {
            showAppMessage(t('auth_popup_blocked'), { tone: 'error' });
            setAuthBusyState(false);
            renderMyPage();
            return;
        }
        watchBackendOAuthPopup(popup, true);
    } catch (e) {
        console.error('Backend OAuth link start failed', providerKey, e);
        const detail = e?.message ? ` (${e.message})` : '';
        showAppMessage(`${t('auth_social_link_error')}${detail}`, { tone: 'error' });
        setAuthBusyState(false);
        renderMyPage();
    }
}

async function handleUnlinkSocialProvider(providerKey) {
    if (!firebaseAuth?.currentUser || state.isLoginSubmitting) return;
    if (!window.confirm(t('mypage_provider_unlink_confirm'))) return;
    let backendResult = null;
    let firebaseGoogleUnlinked = false;
    try {
        setAuthBusyState(true, `provider_unlink_${providerKey}`);
        renderMyPage();
        backendResult = await apiUnlinkAuthProvider(providerKey);
        const hasFirebaseGoogleProvider = getLinkedProviderIds().includes('google.com');
        if (providerKey === 'google' && hasFirebaseGoogleProvider) {
            await firebaseAuth.currentUser.unlink('google.com');
            firebaseGoogleUnlinked = true;
        }

        state.account = {
            ...(state.account || {}),
            ...backendResult,
            profile: backendResult.profile,
            linked_providers: backendResult.linked_providers || [],
        };
        state.isAdmin = !!backendResult?.is_admin;
        syncCurrentAuthUserSnapshot();
        showAppMessage(t('mypage_provider_unlink_success'), { tone: 'success' });
    } catch (e) {
        console.error('Social provider unlink failed', providerKey, e);
        if (providerKey === 'google' && backendResult && !firebaseGoogleUnlinked && firebaseAuth?.currentUser) {
            try {
                const token = await firebaseAuth.currentUser.getIdToken();
                state.account = await apiRecordFirebaseProviderLink(token, 'google');
            } catch (rollbackError) {
                console.error('Google provider unlink rollback failed', rollbackError);
            }
        }
        const detailKey = e?.message || 'auth_provider_unlink_failed';
        showAppMessage(t('mypage_provider_unlink_error', { detail: t(detailKey) }), { tone: 'error' });
    } finally {
        setAuthBusyState(false);
        renderGlobalNavigation();
        renderMyPage();
    }
}

async function handleDeleteAccount() {
    if (!firebaseAuth?.currentUser || state.isLoginSubmitting) return;
    if (!window.confirm(t('mypage_delete_account_confirm'))) return;
    try {
        setAuthBusyState(true, 'account_delete');
        renderMyPage();
        const token = await firebaseAuth.currentUser.getIdToken(true);
        await apiDeleteAccount(token);
        await firebaseAuth.signOut();
        setSignedOutState();
        showAppMessage(t('mypage_delete_account_success'), { tone: 'success' });
        navigateTo('login', renderLogin);
    } catch (e) {
        showAppMessage(t('mypage_delete_account_error', { detail: t(e?.message || 'account_delete_failed') }), { tone: 'error' });
    } finally {
        setAuthBusyState(false);
        renderGlobalNavigation();
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

    const trace = startAuthPerformanceTrace('display_name_submit');
    let outcome = 'error';
    try {
        setAuthBusyState(true, 'display_name_submit');
        rerenderAuthBusySurface();
        await firebaseAuth.currentUser.updateProfile({ displayName });
        markAuthPerformanceStep(trace, 'firebase_display_name_updated');
        await saveDisplayName(displayName);
        markAuthPerformanceStep(trace, 'service_display_name_saved');
        state.authMode = 'login';
        const { allPromise } = refreshSignedInGameState({
            waitForGames: false,
            waitForUserEvals: false,
            rerender: false,
        });
        renderGlobalNavigation();
        if (!completeAuthDialogSuccess()) {
            navigateTo('home', renderLanding);
        }
        markAuthPerformanceStep(trace, 'interactive_ui_ready');
        outcome = 'success';
        void allPromise.then(() => {
            markAuthPerformanceStep(trace, 'background_data_synced');
            finishAuthPerformanceTrace(trace, outcome);
        });
    } catch (e) {
        const detail = e?.message || '';
        const message = detail === 'display_name_taken'
            ? t('auth_display_name_taken')
            : getDisplayNameErrorMessage(detail || 'display_name_generic_error');
        showAppMessage(message, { tone: 'error' });
    } finally {
        if (outcome !== 'success') finishAuthPerformanceTrace(trace, outcome);
        setAuthBusyState(false);
        rerenderAuthBusySurface();
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
            `${t('auth_find_id_result', { login_id: escapeHtml(data.masked_login_id) })}${mailButton}`,
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
    syncAuthDialogVisibility();
    rerenderPostAuthDataViews();
}

// ─── 닉네임(display_name) 변경 ────────────────────────────────────────

function handleDisplayNameChangeBtnClick() {
    if (isDisplayNameChangeCooldown()) {
        const availableDate = getDisplayNameChangeAvailableDate();
        const msg = t('display_name_change_cooldown_desc', { date: availableDate });
        showAppMessage(msg, { tone: 'info' });
        return;
    }
    openDisplayNameChangeDialog();
}

function openDisplayNameChangeDialog() {
    state.accountDisplayNameChange = {
        open: true,
        displayName: '',
        available: null,
        checking: false,
        submitting: false,
        errorKey: null,
        takenKey: null,
    };
    renderMyPage();
    setTimeout(() => {
        document.getElementById('display-name-change-input')?.focus();
    }, 50);
}

function closeDisplayNameChangeDialog() {
    state.accountDisplayNameChange = {
        open: false,
        displayName: '',
        available: null,
        checking: false,
        submitting: false,
        errorKey: null,
        takenKey: null,
    };
    renderMyPage();
}

function handleDisplayNameChangeInput() {
    const val = document.getElementById('display-name-change-input')?.value || '';
    state.accountDisplayNameChange.displayName = val;
    state.accountDisplayNameChange.available = null;
    state.accountDisplayNameChange.errorKey = null;
    state.accountDisplayNameChange.takenKey = null;
    renderMyPageModalRoot();
}

async function handleDisplayNameChangeCheck() {
    const displayName = (state.accountDisplayNameChange?.displayName || '').trim();
    if (!displayName) return;
    state.accountDisplayNameChange.checking = true;
    state.accountDisplayNameChange.available = null;
    state.accountDisplayNameChange.errorKey = null;
    state.accountDisplayNameChange.takenKey = null;
    renderMyPageModalRoot();
    try {
        const result = await apiCheckMyDisplayNameAvailability(displayName);
        state.accountDisplayNameChange.available = result.available;
        if (!result.available) {
            state.accountDisplayNameChange.takenKey = 'auth_display_name_taken';
        }
    } catch (e) {
        const errKey = e?.message || 'display_name_check_failed';
        state.accountDisplayNameChange.available = false;
        state.accountDisplayNameChange.errorKey = errKey;
    } finally {
        state.accountDisplayNameChange.checking = false;
        renderMyPageModalRoot();
    }
}

async function handleDisplayNameChangeSubmit() {
    const s = state.accountDisplayNameChange;
    if (!s || s.available !== true || s.submitting) return;
    const displayName = (s.displayName || '').trim();
    if (!displayName) return;

    s.submitting = true;
    renderMyPageModalRoot();

    try {
        const result = await apiChangeMyDisplayName(displayName);
        // 로컬 state 업데이트
        if (state.account?.profile) {
            state.account.profile.display_name = result.display_name;
            state.account.profile.display_name_changed_at = result.display_name_changed_at;
        }
        if (state.account) {
            state.account.display_name_changed_at = result.display_name_changed_at;
        }
        closeDisplayNameChangeDialog();
        showAppMessage(t('display_name_change_success'), { tone: 'success' });
        // 마이페이지 데이터 새로고침
        await apiFetchMyPage();
        renderMyPage();
    } catch (e) {
        s.submitting = false;
        const errKey = e?.message || 'display_name_change_failed';
        if (errKey === 'display_name_change_cooldown') {
            s.errorKey = 'display_name_change_cooldown_error';
            s.available = null;
        } else if (errKey === 'display_name_taken') {
            s.available = false;
            s.takenKey = 'auth_display_name_taken';
        } else {
            s.errorKey = errKey;
        }
        renderMyPageModalRoot();
    }
}
