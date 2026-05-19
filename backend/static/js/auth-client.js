let firebaseAuth = null;
let firebaseAnalytics = null;

function getAccountDisplayName() {
    const profile = state.account?.profile || {};
    return profile.display_name || state.authUser?.displayName || state.authUser?.email || '';
}

function setSignedOutState() {
    state.authUser = null;
    state.account = null;
    state.isAdmin = false;
    state.adminToken = '';
}

function setAuthMode(mode) {
    state.authMode = mode === 'signup' ? 'signup' : 'login';
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
    return bucket.generic;
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
    if (!email || !password) {
        showAppMessage(t('auth_email_password_required'), { tone: 'error' });
        return;
    }
    if (mode === 'signup' && password !== passwordConfirm) {
        showAppMessage(t('auth_password_confirm_mismatch'), { tone: 'error' });
        return;
    }

    try {
        state.isLoginSubmitting = true;
        if (mode === 'signup') {
            await firebaseAuth.createUserWithEmailAndPassword(email, password);
        } else {
            await firebaseAuth.signInWithEmailAndPassword(email, password);
        }
        await refreshAccountFromFirebaseUser();
        navigateTo('category', renderCategorySelection);
    } catch (e) {
        showAppMessage(getFriendlyAuthError(e, mode), { tone: 'error' });
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
        navigateTo('category', renderCategorySelection);
    } catch (e) {
        showAppMessage(getFriendlyAuthError(e, 'login'), { tone: 'error' });
    } finally {
        state.isLoginSubmitting = false;
    }
}

async function handlePasswordReset() {
    if (!firebaseAuth || state.isLoginSubmitting) return;
    const email = document.getElementById('auth-email')?.value.trim();
    if (!email) {
        showAppMessage(getFriendlyAuthError({ code: 'auth/reset-email-required' }, 'login'), { tone: 'error' });
        return;
    }

    try {
        await firebaseAuth.sendPasswordResetEmail(email);
        const message = state.language === 'en' ? 'Password reset email sent.' : '비밀번호 재설정 메일을 보냈습니다.';
        showAppMessage(message, { tone: 'success' });
    } catch (e) {
        showAppMessage(getFriendlyAuthError(e, 'login'), { tone: 'error' });
    }
}

async function signOutAccount() {
    if (firebaseAuth) {
        await firebaseAuth.signOut();
    }
    setSignedOutState();
    renderSidebar();
}
