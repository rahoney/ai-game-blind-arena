function renderAuthFieldLabel(inputId, labelKey, statusId = inputId) {
    return `<label class="auth-field-label" for="${inputId}">
        <span>${t(labelKey)}</span>
        <span id="${statusId}-status" class="auth-field-status idle">•</span>
    </label>`;
}

function getAuthLanguageKey() {
    return (state.language || 'ko').split('-')[0] === 'en' ? 'en' : 'ko';
}

function renderPolicyAcceptanceControl(disabled) {
    return `
        <label class="auth-policy-consent">
            <input
                type="checkbox"
                id="auth-policy-acceptance"
                onchange="updateSignupSubmitState()"
                ${disabled ? 'disabled' : ''}
            >
            <span>
                ${t('auth_policy_acceptance_text')}
                <a href="/terms" onclick="openAuthPolicyModal(event, 'terms')">${t('terms_policy_title')}</a>
                <span aria-hidden="true">/</span>
                <a href="/privacy" onclick="openAuthPolicyModal(event, 'privacy')">${t('privacy_policy_title')}</a>
            </span>
        </label>
        <p class="auth-policy-summary">${t('auth_policy_acceptance_summary')}</p>
    `;
}

function renderGoogleAuthButton(disabled) {
    return `
        <button type="button" class="gsi-material-button auth-provider-button" onclick="handleSocialLogin('google')" ${disabled ? 'disabled' : ''}>
            <div class="gsi-material-button-state"></div>
            <div class="gsi-material-button-content-wrapper">
                <div class="gsi-material-button-icon">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="display:block;">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                </div>
                <span class="gsi-material-button-contents">${t('auth_google_login')}</span>
                <span style="display:none;">${t('auth_google_login')}</span>
            </div>
        </button>
    `;
}

function renderImageAuthButton(providerKey, labelKey, imagePath, disabled) {
    return `
        <button type="button" class="auth-provider-button auth-provider-image-button" onclick="handleSocialLogin('${providerKey}')" aria-label="${t(labelKey)}" ${disabled ? 'disabled' : ''}>
            <img src="${imagePath}" alt="${t(labelKey)}">
        </button>
    `;
}

function renderKakaoAuthButton(disabled) {
    const lang = getAuthLanguageKey();
    return renderImageAuthButton('kakao', 'auth_kakao_login', `/static/social/kakao_login_${lang}_large_narrow.png`, disabled);
}

function renderNaverAuthButton(disabled) {
    const lang = getAuthLanguageKey();
    return renderImageAuthButton('naver', 'auth_naver_login', `/static/social/naver_login_${lang}_light_green_narrow_h48.png`, disabled);
}

function renderBrandAuthButton(providerKey, labelKey, imagePath, disabled) {
    return `
        <button type="button" class="auth-provider-button auth-provider-brand-button ${providerKey}" onclick="handleSocialLogin('${providerKey}')" ${disabled ? 'disabled' : ''}>
            <img class="auth-provider-brand-icon" src="${imagePath}" alt="" aria-hidden="true">
            <span>${t(labelKey)}</span>
        </button>
    `;
}

function renderSteamAuthButton(disabled) {
    const isEnglish = getAuthLanguageKey() === 'en';
    return `
        <button type="button" class="auth-provider-button auth-provider-brand-button steam" onclick="handleSocialLogin('steam')" aria-label="${t('auth_steam_login')}" ${disabled ? 'disabled' : ''}>
            ${isEnglish ? `<span>${t('auth_steam_visible_text')}</span>` : ''}
            <img class="auth-provider-brand-icon" src="/static/social/steam_logo_single.svg" alt="" aria-hidden="true">
            ${isEnglish ? '' : `<span>${t('auth_steam_visible_text')}</span>`}
        </button>
    `;
}

function renderDiscordAuthButton(disabled) {
    return renderBrandAuthButton('discord', 'auth_discord_login', '/static/social/discord_symbol_white.svg', disabled);
}

function renderGithubAuthButton(disabled) {
    return renderBrandAuthButton('github', 'auth_github_login', '/static/social/github_invertocat_white.svg', disabled);
}

function renderLogin() {
    const el = document.getElementById('view-login');
    const disabled = !state.authConfigured;
    const actionDisabled = disabled || state.isLoginSubmitting;
    const mode = ['signup', 'display_name', 'verify_email', 'help', 'find_id', 'reset_password'].includes(state.authMode) ? state.authMode : 'login';
    const isDialog = state.authDialogOpen && state.currentView?.id !== 'login';
    const isSignup = mode === 'signup';
    const isDisplayName = mode === 'display_name';
    const isVerifyEmail = mode === 'verify_email';
    const isHelp = mode === 'help';
    const isFindId = mode === 'find_id';
    const isResetPassword = mode === 'reset_password';
    const showDialogClose = isDialog && canCloseAuthDialog();
    const isForcedDisplayNameReset = isDisplayName
        && !!state.account?.profile
        && state.account.profile.display_name_set === false;
    const showDisplayNamePolicyAcceptance = isDisplayName
        && (!state.account?.profile || requiresPolicyAcceptanceForDisplayName());
    const authDescriptionKey = isDisplayName
        ? (isForcedDisplayNameReset ? 'auth_display_name_reset_desc' : 'auth_display_name_setup_desc')
        : isVerifyEmail
            ? 'auth_verify_email_desc'
            : isHelp
                ? 'auth_help_desc'
                : isFindId
                    ? 'auth_find_id_desc'
                    : 'auth_reset_password_desc';
    const authBusyNotice = state.isLoginSubmitting
        ? `<p class="auth-inline-status auth-progress-status" role="status" aria-live="polite">${getAuthBusyMessage()}</p>`
        : '';
    el.innerHTML = `
        <div class="${isDialog ? 'auth-dialog-shell' : ''}">
            ${showDialogClose ? `
                <button type="button" class="auth-dialog-close" onclick="closeAuthDialog()" aria-label="${t('dialog_close')}">×</button>
            ` : ''}
            <div class="card auth-card ${isDialog ? 'auth-card-dialog' : ''}">
            ${isDisplayName || isVerifyEmail || isHelp || isFindId || isResetPassword ? `<p class="auth-description">${t(authDescriptionKey)}</p>` : ''}
            ${disabled ? `<p class="auth-status">${t('auth_not_configured')}</p>` : ''}
            <div class="auth-form">
                ${isDisplayName ? `
                    <label for="auth-display-name">${t('auth_display_name_label')}</label>
                    <input type="text" id="auth-display-name" autocomplete="off" placeholder="${t('auth_display_name_placeholder')}" onkeypress="if(event.keyCode==13) handleDisplayNameSubmit()" ${disabled ? 'disabled' : ''}>
                ` : ''}
                ${isHelp ? `
                    <button type="button" onclick="setAuthMode('find_id')" ${disabled ? 'disabled' : ''}>${t('auth_find_id')}</button>
                    <button type="button" onclick="setAuthMode('reset_password')" ${disabled ? 'disabled' : ''}>${t('auth_find_password')}</button>
                    <button type="button" class="secondary" onclick="setAuthMode('login')">${t('auth_back_to_login')}</button>
                ` : isFindId ? `
                    <label for="auth-real-name">${t('auth_real_name_label')}</label>
                    <input type="text" id="auth-real-name" autocomplete="name" placeholder="${t('auth_real_name_placeholder')}" ${disabled ? 'disabled' : ''}>
                    <label for="auth-display-name">${t('auth_display_name_label')}</label>
                    <input type="text" id="auth-display-name" autocomplete="off" placeholder="${t('auth_display_name_placeholder')}" ${disabled ? 'disabled' : ''}>
                    <label for="auth-email">${t('auth_email_candidate_label')}</label>
                    <input type="email" id="auth-email" autocomplete="email" placeholder="${t('auth_email_placeholder')}" ${disabled ? 'disabled' : ''}>
                    <button type="button" onclick="handleFindId()" ${disabled ? 'disabled' : ''}>${t('auth_find_id_check')}</button>
                    <button type="button" class="secondary" onclick="setAuthMode('login')">${t('auth_back_to_login')}</button>
                ` : isResetPassword ? `
                    <label for="auth-real-name">${t('auth_real_name_label')}</label>
                    <input type="text" id="auth-real-name" autocomplete="name" placeholder="${t('auth_real_name_placeholder')}" ${disabled ? 'disabled' : ''}>
                    <label for="auth-login-id">${t('auth_login_id_label')}</label>
                    <input type="text" id="auth-login-id" autocomplete="username" placeholder="${t('auth_login_id_placeholder')}" ${disabled ? 'disabled' : ''}>
                    <label for="auth-email">${t('auth_email_label')}</label>
                    <input type="email" id="auth-email" autocomplete="email" placeholder="${t('auth_email_placeholder')}" onkeypress="if(event.keyCode==13) handlePasswordReset()" ${disabled ? 'disabled' : ''}>
                    <button type="button" onclick="handlePasswordReset()" ${disabled ? 'disabled' : ''}>${t('auth_reset_password_send')}</button>
                    <button type="button" class="secondary" onclick="setAuthMode('login')">${t('auth_back_to_login')}</button>
                ` : isDisplayName ? `
                    ${showDisplayNamePolicyAcceptance ? renderPolicyAcceptanceControl(actionDisabled) : ''}
                    <button type="button" onclick="handleDisplayNameSubmit()" ${actionDisabled ? 'disabled' : ''}>${t('auth_display_name_save')}</button>
                ` : isVerifyEmail ? `
                    <p class="auth-inline-status">${t('auth_verify_email_sent_to', { email: escapeHtml(state.authUser?.email || '') })}</p>
                    ${authBusyNotice}
                    <button type="button" onclick="handleVerifyEmailRefresh()" ${actionDisabled ? 'disabled' : ''}>${t('auth_verify_email_check')}</button>
                    <button type="button" class="secondary" onclick="handleResendVerificationEmail()" ${actionDisabled ? 'disabled' : ''}>${t('auth_verify_email_resend')}</button>
                    <button type="button" class="secondary" onclick="signOutAccount(); setAuthMode('login');">${t('auth_back_to_login')}</button>
                ` : isSignup ? `
                    ${state.signupEmailVerification?.token ? `
                        <p class="auth-inline-status">${t('auth_signup_email_verified_for', { email: escapeHtml(state.signupEmailVerification.email || '') })}</p>
                        ${authBusyNotice}
                        ${renderAuthFieldLabel('auth-login-id', 'auth_login_id_label')}
                        <div class="auth-inline-control">
                            <input type="text" id="auth-login-id" autocomplete="username" placeholder="${t('auth_login_id_placeholder')}" oninput="handleSignupLoginIdInput()" ${actionDisabled ? 'disabled' : ''}>
                            <button type="button" class="secondary" onclick="handleLoginIdAvailabilityCheck()" ${actionDisabled ? 'disabled' : ''}>${t('auth_login_id_check')}</button>
                        </div>
                        <p id="auth-login-id-availability" class="auth-field-message"></p>
                        ${renderAuthFieldLabel('auth-real-name', 'auth_real_name_label')}
                        <input type="text" id="auth-real-name" autocomplete="name" placeholder="${t('auth_real_name_placeholder')}" oninput="updateSignupSubmitState()" ${actionDisabled ? 'disabled' : ''}>
                        ${renderAuthFieldLabel('auth-display-name', 'auth_display_name_label')}
                        <div class="auth-inline-control">
                            <input type="text" id="auth-display-name" autocomplete="off" placeholder="${t('auth_display_name_placeholder')}" oninput="handleSignupDisplayNameInput()" ${actionDisabled ? 'disabled' : ''}>
                            <button type="button" class="secondary" onclick="handleDisplayNameAvailabilityCheck()" ${actionDisabled ? 'disabled' : ''}>${t('auth_display_name_check')}</button>
                        </div>
                        <p id="auth-display-name-availability" class="auth-field-message"></p>
                        ${renderAuthFieldLabel('auth-password', 'auth_password_label')}
                        <input type="password" id="auth-password" autocomplete="new-password" placeholder="${t('auth_password_placeholder')}" oninput="updateSignupSubmitState()" onkeypress="if(event.keyCode==13) handleEmailAuth('signup')" ${actionDisabled ? 'disabled' : ''}>
                        ${renderAuthFieldLabel('auth-password-confirm', 'auth_password_confirm_label')}
                        <input type="password" id="auth-password-confirm" autocomplete="new-password" placeholder="${t('auth_password_confirm_placeholder')}" oninput="updateSignupSubmitState()" onkeypress="if(event.keyCode==13) handleEmailAuth('signup')" ${actionDisabled ? 'disabled' : ''}>
                        ${renderPolicyAcceptanceControl(actionDisabled)}
                        <div class="auth-actions">
                            <button id="login-submit-btn" onclick="handleEmailAuth('signup')" disabled>${t('auth_signup')}</button>
                        </div>
                        <div class="auth-help-actions">
                            <button type="button" onclick="setAuthMode('login')">${t('auth_back_to_login')}</button>
                        </div>
                    ` : `
                        <label for="auth-email">${t('auth_email_label')}</label>
                        <input type="email" id="auth-email" autocomplete="email" value="${escapeHtml(state.signupEmailVerification?.email || '')}" placeholder="${t('auth_email_placeholder')}" ${actionDisabled || state.signupEmailVerification?.codeSent ? 'disabled' : ''}>
                        ${state.signupEmailVerification?.codeSent ? `
                            <label for="auth-email-code">${t('auth_signup_code_label')}</label>
                            <input type="text" id="auth-email-code" inputmode="numeric" maxlength="6" placeholder="${t('auth_signup_code_placeholder')}" oninput="updateSignupEmailCodeState()" ${actionDisabled ? 'disabled' : ''}>
                            <p id="auth-email-code-countdown" class="auth-inline-status">${t('auth_signup_code_countdown', { time: getSignupCodeCountdownText() })}</p>
                            ${authBusyNotice}
                            <button id="auth-email-code-confirm-btn" type="button" onclick="handleSignupEmailCodeConfirm()" disabled>${t('auth_signup_code_confirm')}</button>
                            <button type="button" class="secondary" onclick="handleSignupEmailCodeRequest()" ${actionDisabled ? 'disabled' : ''}>${t('auth_signup_code_resend')}</button>
                        ` : `
                            ${authBusyNotice}
                            <button type="button" onclick="handleSignupEmailCodeRequest()" ${actionDisabled ? 'disabled' : ''}>${t('auth_signup_code_send')}</button>
                        `}
                    `}
                ` : `
                <label for="auth-login-id">${t('auth_login_id_label')}</label>
                <input type="text" id="auth-login-id" autocomplete="username" placeholder="${t('auth_login_id_placeholder')}" ${actionDisabled ? 'disabled' : ''}>
                <label for="auth-password">${t('auth_password_label')}</label>
                <input type="password" id="auth-password" autocomplete="${isSignup ? 'new-password' : 'current-password'}" placeholder="${t('auth_password_placeholder')}" ${isSignup ? 'oninput="updateSignupSubmitState()"' : ''} onkeypress="if(event.keyCode==13) handleEmailAuth('${mode}')" ${actionDisabled ? 'disabled' : ''}>
                ${isSignup ? `
                    <label for="auth-password-confirm">${t('auth_password_confirm_label')}</label>
                    <input type="password" id="auth-password-confirm" autocomplete="new-password" placeholder="${t('auth_password_confirm_placeholder')}" oninput="updateSignupSubmitState()" onkeypress="if(event.keyCode==13) handleEmailAuth('signup')" ${actionDisabled ? 'disabled' : ''}>
                ` : ''}
                ${authBusyNotice}
                <div class="auth-actions auth-login-actions">
                    <button id="login-submit-btn" onclick="handleEmailAuth('login')" ${actionDisabled ? 'disabled' : ''}>${t('auth_login')}</button>
                    <button type="button" class="secondary" onclick="setAuthMode('signup')" ${actionDisabled ? 'disabled' : ''}>${t('auth_signup')}</button>
                </div>
                <div class="auth-help-actions">
                    <button type="button" onclick="setAuthMode('help')" ${actionDisabled ? 'disabled' : ''}>${t('auth_login_help')}</button>
                </div>
                <div class="auth-social-buttons">
                    ${renderGoogleAuthButton(actionDisabled)}
                    ${renderSteamAuthButton(actionDisabled)}
                    ${renderKakaoAuthButton(actionDisabled)}
                    ${renderNaverAuthButton(actionDisabled)}
                    ${renderDiscordAuthButton(actionDisabled)}
                    ${renderGithubAuthButton(actionDisabled)}
                </div>
                `}
            </div>
        </div>
        </div>
    `;
    if (isSignup) {
        updateSignupSubmitState();
        startSignupEmailCountdown();
    } else {
        stopSignupEmailCountdown();
    }
}

const LANDING_CATEGORY_IMAGES = {
    '1인칭 미니 FPS': '/static/landing/fps-main.png',
    '던전 탐색': '/static/landing/dungeon-main.jpeg',
    '서바이벌 디펜스': '/static/landing/defense-main.jpeg',
    '강화된 벽돌깨기': '/static/landing/brick-main.jpeg',
    '카드배틀': '/static/landing/card-main.jpeg',
    '횡스크롤 액션': '/static/landing/side-main.jpeg',
};

const LANDING_MARQUEE_IMAGE_GROUPS = {
    fps: [1, 2, 3, 4, 5].map((n) => `/static/landing/marquee/fps-${n}.jpg`),
    dungeon: [1, 2, 3, 4, 5].map((n) => `/static/landing/marquee/dungeon-${n}.jpg`),
    defense: [1, 2, 3, 4, 5].map((n) => `/static/landing/marquee/defense-${n}.jpg`),
    brick: [1, 2, 3, 4, 5].map((n) => `/static/landing/marquee/brick-${n}.jpg`),
    card: [1, 2, 3, 4, 5].map((n) => `/static/landing/marquee/card-${n}.jpg`),
    side: [1, 2, 3, 4, 5].map((n) => `/static/landing/marquee/side-${n}.jpg`),
};

const LANDING_CATEGORY_IMAGE_GROUPS = {
    '1인칭 미니 FPS': LANDING_MARQUEE_IMAGE_GROUPS.fps,
    '던전 탐색': LANDING_MARQUEE_IMAGE_GROUPS.dungeon,
    '서바이벌 디펜스': LANDING_MARQUEE_IMAGE_GROUPS.defense,
    '강화된 벽돌깨기': LANDING_MARQUEE_IMAGE_GROUPS.brick,
    '카드배틀': LANDING_MARQUEE_IMAGE_GROUPS.card,
    '횡스크롤 액션': LANDING_MARQUEE_IMAGE_GROUPS.side,
};

let landingCategoryCarouselController = null;

function shuffleLandingItems(items) {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function getLandingMarqueeImages() {
    const groups = Object.entries(LANDING_MARQUEE_IMAGE_GROUPS).map(([key, images]) => ({
        key,
        images: shuffleLandingItems(images),
    }));
    const sequence = [];
    let lastKey = null;

    for (let index = 0; index < 5; index += 1) {
        let round = shuffleLandingItems(groups);
        if (round[0]?.key === lastKey) {
            const swapIndex = round.findIndex((group) => group.key !== lastKey);
            if (swapIndex > 0) {
                [round[0], round[swapIndex]] = [round[swapIndex], round[0]];
            }
        }
        round.forEach((group) => {
            sequence.push(group.images[index]);
            lastKey = group.key;
        });
    }

    const firstKind = sequence[0]?.match(/marquee\/([a-z]+)-/)?.[1];
    const lastKind = sequence[sequence.length - 1]?.match(/marquee\/([a-z]+)-/)?.[1];
    if (firstKind && firstKind === lastKind) {
        const swapIndex = sequence.findIndex((src) => src.match(/marquee\/([a-z]+)-/)?.[1] !== firstKind);
        if (swapIndex > 0) {
            [sequence[0], sequence[swapIndex]] = [sequence[swapIndex], sequence[0]];
        }
    }

    return sequence;
}

function formatLandingHeroTitle() {
    return t('landing_hero_title');
}

function initLandingScrollAnimations(root) {
    if (!root) return;
    const targets = root.querySelectorAll('.landing-reveal');
    if (!targets.length) return;

    if (!('IntersectionObserver' in window)) {
        targets.forEach((target) => target.classList.add('visible'));
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    targets.forEach((target) => observer.observe(target));
}

function initLandingCategoryCarousel(root) {
    if (landingCategoryCarouselController?.stop) {
        landingCategoryCarouselController.stop();
    }
    landingCategoryCarouselController = null;
    if (!root) return;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const mediaNodes = Array.from(root.querySelectorAll('.landing-category-carousel'));
    if (reduceMotion || mediaNodes.length === 0 || !('IntersectionObserver' in window)) return;

    const visibleNodes = new Set();
    const items = mediaNodes.map((media) => {
        let images = [];
        try {
            images = JSON.parse(media.dataset.images || '[]');
        } catch (error) {
            images = [];
        }
        return {
            media,
            current: media.querySelector('.landing-category-image-current'),
            next: media.querySelector('.landing-category-image-next'),
            images,
            index: 0,
            animating: false,
        };
    }).filter((item) => item.current && item.next && item.images.length > 1);

    if (!items.length) return;

    let stopped = false;
    let timerId = null;
    const displayMs = 4000;
    const staggerMs = 145;
    const transitionMs = 460;

    const getVisibleItems = () => items.filter((item) => visibleNodes.has(item.media) && item.media.isConnected);

    const preloadNextImages = () => {
        getVisibleItems().forEach((item) => {
            const preload = new Image();
            preload.src = item.images[(item.index + 1) % item.images.length];
        });
    };

    const schedule = () => {
        window.clearTimeout(timerId);
        if (stopped) return;
        timerId = window.setTimeout(runSequence, displayMs);
    };

    const finishTransition = (item, nextSrc) => {
        item.media.classList.add('is-resetting');
        item.current.src = nextSrc;
        item.next.classList.remove('is-active');
        item.next.removeAttribute('src');
        item.media.classList.remove('is-sliding');
        item.media.offsetHeight;
        window.requestAnimationFrame(() => {
            item.media.classList.remove('is-resetting');
        });
        item.animating = false;
    };

    const transitionItem = (item) => {
        if (item.animating || item.images.length < 2) return;
        const nextIndex = (item.index + 1) % item.images.length;
        const nextSrc = item.images[nextIndex];
        item.animating = true;
        item.index = nextIndex;
        item.next.src = nextSrc;
        item.next.alt = item.current.alt;

        window.requestAnimationFrame(() => {
            if (stopped || !visibleNodes.has(item.media) || !item.media.isConnected) {
                finishTransition(item, nextSrc);
                return;
            }
            item.media.classList.add('is-sliding');
            item.next.classList.add('is-active');
        });

        window.setTimeout(() => finishTransition(item, nextSrc), transitionMs);
    };

    function runSequence() {
        if (stopped) return;
        if (document.hidden) {
            schedule();
            return;
        }

        const sequence = getVisibleItems();
        if (!sequence.length) {
            schedule();
            return;
        }

        preloadNextImages();
        sequence.forEach((item, index) => {
            window.setTimeout(() => {
                if (!stopped && visibleNodes.has(item.media) && item.media.isConnected) {
                    transitionItem(item);
                }
            }, index * staggerMs);
        });

        window.setTimeout(schedule, Math.max(0, (sequence.length - 1) * staggerMs + transitionMs));
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                visibleNodes.add(entry.target);
            } else {
                visibleNodes.delete(entry.target);
            }
        });
        preloadNextImages();
    }, { threshold: 0.45, rootMargin: '0px 0px -8% 0px' });

    items.forEach((item) => observer.observe(item.media));
    const handleVisibilityChange = () => {
        if (!document.hidden) schedule();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    schedule();

    landingCategoryCarouselController = {
        stop() {
            stopped = true;
            window.clearTimeout(timerId);
            observer.disconnect();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        },
    };
}

function renderLanding() {
    const el = document.getElementById('view-home');
    const categoryCount = state.categories?.length || 0;
    const variantsPerCategory = Math.max(
        0,
        ...((state.categories || []).map((category) => state.games?.[category.name]?.length || 0))
    );
    const totalBlindVariants = Object.values(state.games || {}).reduce((sum, items) => sum + items.length, 0);
    const processSteps = [
        {
            title: t('landing_step_1_title'),
            color: '#4fc3f7',
            nextColor: '#6cb1f8',
            icon: `
                <circle cx="10" cy="8" r="3.6"></circle>
                <path d="M4 22v-2.2a6 6 0 0 1 12 0V22"></path>
                <rect x="14.5" y="14.5" width="9" height="7.5" rx="1.6"></rect>
                <path d="M16.2 14.5v-2a2.8 2.8 0 0 1 5.6 0v2"></path>
            `,
        },
        {
            title: t('landing_step_2_title'),
            color: '#6cb1f8',
            nextColor: '#899ef9',
            icon: `
                <circle cx="14" cy="8" r="4.2"></circle>
                <path class="landing-process-icon-fill" d="M12 12.3h4l-.7 6.2h-2.6z"></path>
                <rect x="5" y="19" width="18" height="5" rx="2.4"></rect>
            `,
        },
        {
            title: t('landing_step_3_title'),
            color: '#899ef9',
            nextColor: '#a78bfa',
            icon: `
                <rect x="5" y="5" width="18" height="20" rx="2.2"></rect>
                <rect x="10" y="3" width="8" height="4" rx="1.2"></rect>
                <path d="m9 13 2 2 3.5-3.5"></path>
                <path d="M17 12h3"></path>
                <path d="m9 19 2 2 3.5-3.5"></path>
                <path d="M17 18h3"></path>
            `,
        },
        {
            title: t('landing_step_4_title'),
            color: '#a78bfa',
            nextColor: '#a78bfa',
            icon: `
                <circle cx="11" cy="8" r="3.6"></circle>
                <path d="M5 22v-2.2a6 6 0 0 1 12 0V22"></path>
                <rect x="15.5" y="14.5" width="8.5" height="7" rx="1.6"></rect>
                <path d="M17 14.5v-2.4a2.6 2.6 0 0 1 4.8-1.3"></path>
            `,
        },
    ];
    const processStepsHtml = processSteps.map((step, index) => `
        <article class="landing-process-step landing-reveal" style="--step-color: ${step.color};">
            <span class="landing-process-tag">STEP ${String(index + 1).padStart(2, '0')}</span>
            <div class="landing-process-icon" aria-hidden="true">
                <svg viewBox="0 0 28 28" fill="none">
                    ${step.icon}
                </svg>
            </div>
            <h4>${step.title}</h4>
        </article>
        ${index < processSteps.length - 1 ? `
            <div class="landing-process-arrow" aria-hidden="true" style="--arrow-color: ${step.nextColor};">
                <span></span>
                <span></span>
            </div>
        ` : ''}
    `).join('');
    const renderCategoryCards = (groupName) => (state.categories || [])
        .filter((category) => category.group === groupName && state.games?.[category.name]?.length)
        .map((category) => {
            const imageSet = LANDING_CATEGORY_IMAGE_GROUPS[category.name] || [LANDING_CATEGORY_IMAGES[category.name]].filter(Boolean);
            const imageSrc = imageSet[0];
            const guide = getGameGuideContent(category.name);
            const summary = guide?.lines?.[0] || '';
            return `
                <article class="landing-category-card landing-reveal" onclick="selectCategory('${category.name}')">
                    <div class="landing-category-media landing-category-carousel" data-images="${escapeHtml(JSON.stringify(imageSet))}">
                        <img class="landing-category-image landing-category-image-current" src="${imageSrc}" alt="${escapeHtml(getCategoryDisplayName(category.name))}">
                        <img class="landing-category-image landing-category-image-next" alt="" aria-hidden="true">
                    </div>
                    <div class="landing-category-body">
                        <h3>${escapeHtml(getCategoryDisplayName(category.name))}</h3>
                        <p>${escapeHtml(summary)}</p>
                    </div>
                </article>
            `;
        }).join('');
    const strictCategoryCards = renderCategoryCards('strict');
    const advancedCategoryCards = renderCategoryCards('advanced');
    const landingMarqueeImages = getLandingMarqueeImages();
    const marqueeImages = [...landingMarqueeImages, ...landingMarqueeImages].map((src) => `
        <div class="landing-marquee-item">
            <img src="${src}" alt="">
        </div>
    `).join('');

    el.innerHTML = `
        <div class="landing-page">
            <section class="landing-band landing-hero">
                <div class="landing-hero-marquee" aria-hidden="true">
                    <div class="landing-marquee-track">
                        ${marqueeImages}
                    </div>
                </div>
                <div class="landing-shell landing-hero-grid">
                    <div class="landing-hero-copy">
                        <div class="landing-hero-main-copy">${t('landing_hero_main_copy')}</div>
                        <h2>${formatLandingHeroTitle()}</h2>
                        <p class="landing-hero-lead">${t('landing_hero_copy')}</p>
                        <div class="landing-hero-actions">
                            <button type="button" class="primary-action landing-primary" onclick="scrollLandingToCategories()">${t('landing_cta_browse')}</button>
                        </div>
                        <div class="landing-metrics">
                            <div class="landing-metric">
                                <strong>${categoryCount}</strong>
                                <span>${t('landing_metric_categories')}</span>
                            </div>
                            <div class="landing-metric">
                                <strong>${variantsPerCategory || 15}</strong>
                                <span>${t('landing_metric_variants')}</span>
                            </div>
                            <div class="landing-metric">
                                <strong>${totalBlindVariants || 90}</strong>
                                <span>${t('landing_metric_total')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section class="landing-band">
                <div class="landing-shell landing-intro-grid">
                    <div class="landing-section-heading landing-reveal">
                        <span class="landing-kicker">${t('landing_intro_kicker')}</span>
                        <h3>${t('landing_intro_title')}</h3>
                    </div>
                    <div class="landing-intro-copy landing-reveal">
                        <p>${t('landing_intro_copy_1')}</p>
                    </div>
                </div>
            </section>

            <section class="landing-band">
                <div class="landing-shell">
                    <div class="landing-section-heading landing-section-heading-with-cards landing-reveal">
                        <span class="landing-kicker">${t('landing_modes_kicker')}</span>
                        <h3>${t('landing_modes_title')}</h3>
                    </div>
                    <div class="landing-mode-grid">
                        <article class="landing-mode-card landing-reveal">
                            <div class="landing-mode-icon landing-mode-icon-strict" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none">
                                    <rect x="5" y="5" width="14" height="14" rx="3"></rect>
                                    <path d="M9 9h6M9 12h6M9 15h4"></path>
                                </svg>
                            </div>
                            <h4>${t('group_strict_title')}</h4>
                            <p>${t('landing_mode_strict_body')}</p>
                        </article>
                        <article class="landing-mode-card landing-reveal">
                            <div class="landing-mode-icon landing-mode-icon-advanced" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none">
                                    <rect x="4.5" y="7" width="8" height="8" rx="2"></rect>
                                    <rect x="11.5" y="9" width="8" height="8" rx="2"></rect>
                                </svg>
                            </div>
                            <h4>${t('group_advanced_title')}</h4>
                            <p>${t('landing_mode_advanced_body')}</p>
                        </article>
                    </div>
                </div>
            </section>

            <section class="landing-band">
                <div class="landing-shell">
                    <div class="landing-section-heading landing-section-heading-with-cards landing-reveal">
                        <span class="landing-kicker">${t('landing_process_kicker')}</span>
                        <h3>${t('landing_process_title')}</h3>
                    </div>
                    <div class="landing-process-grid">
                        ${processStepsHtml}
                    </div>
                </div>
            </section>

            <section id="landing-game-categories" class="landing-band">
                <div class="landing-shell">
                    <div class="landing-section-heading landing-reveal">
                        <span class="landing-kicker">${t('landing_categories_kicker')}</span>
                        <h3>${t('landing_categories_title')}</h3>
                        <p>${t('landing_categories_desc')}</p>
                    </div>
                    <div class="landing-category-group">
                        <div class="landing-category-group-title landing-reveal">
                            <span class="landing-category-group-icon landing-category-group-icon-strict" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none">
                                    <rect x="5" y="5" width="14" height="14" rx="3"></rect>
                                    <path d="M9 9h6M9 12h6M9 15h4"></path>
                                </svg>
                            </span>
                            <span>${t('group_strict_title')}</span>
                        </div>
                        <div class="landing-category-grid">
                            ${strictCategoryCards}
                        </div>
                    </div>
                    <div class="landing-category-group">
                        <div class="landing-category-group-title landing-reveal">
                            <span class="landing-category-group-icon landing-category-group-icon-advanced" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none">
                                    <rect x="4.5" y="7" width="8" height="8" rx="2"></rect>
                                    <rect x="11.5" y="9" width="8" height="8" rx="2"></rect>
                                </svg>
                            </span>
                            <span>${t('group_advanced_title')}</span>
                        </div>
                        <div class="landing-category-grid">
                            ${advancedCategoryCards}
                        </div>
                    </div>
                </div>
            </section>

        </div>
    `;
    initLandingScrollAnimations(el);
    initLandingCategoryCarousel(el);
}

function scrollLandingToCategories() {
    const target = document.getElementById('landing-game-categories');
    if (!target) return;
    const contentLayer = document.getElementById('content-layer');
    const header = document.getElementById('main-header');
    const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

    if (header) {
        header.style.transform = 'translateY(0px)';
        header.style.opacity = '1';
        header.style.visibility = 'visible';
    }

    if (contentLayer) {
        const targetTop = target.offsetTop;
        const headerOffset = header?.offsetHeight || 0;
        contentLayer.scrollTo({
            top: Math.max(targetTop - headerOffset - 12, 0),
            behavior,
        });
        requestAnimationFrame(() => {
            if (header) {
                header.style.transform = 'translateY(0px)';
                header.style.opacity = '1';
                header.style.visibility = 'visible';
            }
        });
        return;
    }

    target.scrollIntoView({ behavior, block: 'start' });
}

function renderGameList() {
    const el = document.getElementById('view-list');
    const category = state.selectedCategory;
    const models = state.games[category] || [];
    const categoryMeta = state.categories.find(item => item.name === category);
    const catLabel = categoryMeta && categoryMeta.translation_key?.startsWith('cat_')
        ? t(categoryMeta.translation_key)
        : category;
    const evaluatedCount = models.filter((model) => checkEvaluated(category, model)).length;
    const remainingCount = Math.max(models.length - evaluatedCount, 0);

    const modelsHtml = models.map((model) => {
        const isEval = checkEvaluated(category, model);
        const actualName = getActualModelNameIfEvaluated(category, model);
        const titleText = isEval
            ? escapeHtml(actualName || `Model ${model.blind_id}`)
            : `Model ${escapeHtml(model.blind_id)}`;

        return `
            <button
                type="button"
                class="model-selection-card${isEval ? ' completed' : ''}"
                onclick='playGame(${JSON.stringify(model.blind_id)})'
                ${state.isPlayLaunching ? 'disabled' : ''}
            >
                <strong class="model-selection-name">${titleText}</strong>
                <span class="model-selection-stats">
                    <span><b>${model.play_count || 0}</b>${t('view_count')}</span>
                    <span><b>${model.eval_count || 0}</b>${t('eval_count')}</span>
                </span>
            </button>
        `;
    }).join('');

    el.innerHTML = `
        <main class="model-selection-page">
            <section
                class="model-selection-hero"
                aria-labelledby="model-selection-title"
            >
                <div class="model-selection-hero-copy">
                    <span class="model-selection-kicker">${t('model_selection_kicker')}</span>
                    <h2 id="model-selection-title">${catLabel}</h2>
                    ${renderGameGuideCard(category, { concise: true, marginTop: '0', marginBottom: '0' })}
                    <p class="model-selection-device-note">${t('model_selection_device_note')}</p>
                </div>
                <dl class="model-selection-summary">
                    <div>
                        <dt>${t('model_selection_total')}</dt>
                        <dd>${models.length}</dd>
                    </div>
                    <div>
                        <dt>${t('model_selection_completed')}</dt>
                        <dd>${evaluatedCount}</dd>
                    </div>
                    <div>
                        <dt>${t('model_selection_remaining')}</dt>
                        <dd>${remainingCount}</dd>
                    </div>
                </dl>
            </section>

            <section class="model-selection-content" aria-labelledby="model-selection-grid-title">
                <div class="model-selection-heading">
                    <div>
                        <span class="model-selection-kicker">${t('model_selection_round_kicker')}</span>
                        <h3 id="model-selection-grid-title">${t('model_selection_title')}</h3>
                    </div>
                    <div class="model-selection-copy">
                        <p>${t('model_selection_description')}</p>
                    </div>
                </div>
                <div class="model-selection-results">
                    <button type="button" class="model-selection-results-button" onclick="navigateTo('results', renderResults)">
                        ${t('all_results')}
                    </button>
                </div>
                <div class="model-selection-grid">
                ${modelsHtml}
                </div>
            </section>
        </main>
    `;
}

function renderPlayArea() {
    const el = document.getElementById('view-play');
    const game = state.selectedGame;
    state.evaluationTouchedScores = new Set();
    el.innerHTML = `
        <div class="play-page-shell">
            <div class="play-toolbar">
                <button type="button" class="primary-action" style="width: auto; padding: 1.05rem 1.8rem;" onclick="navigateTo('list', renderGameList)">← ${state.language === 'ko' ? '모델 목록으로' : 'Back to Models'}</button>
                <button type="button" class="primary-action" style="width: auto; padding: 1.05rem 1.8rem;" onclick="toggleFullScreen()">${state.language === 'ko' ? '전체화면 모드' : 'Fullscreen'}</button>
            </div>
            ${renderGameGuideCard(state.selectedCategory, { marginTop: '0', marginBottom: '1.5rem' })}
            <div class="game-container play-game-frame" style="width: 100%; height: 1050px; background: #000; overflow: hidden; flex-shrink: 0;">
                <iframe id="game-iframe" src="${game.file}" allowfullscreen="true" style="width: 100%; height: 100%; border: none;"></iframe>
            </div>
            <div id="play-evaluation-form-root">
                ${renderPlayEvaluationForm()}
            </div>
            <div id="play-comments-container" style="width:100%; margin-top:2rem;">
                ${renderPlayModelCommentsSection()}
            </div>
        </div>
    `;
}

function renderPlayEvaluationForm() {
    const game = state.selectedGame;
    const participationLocked = !canParticipateWithAccount();
    return `
        <div class="evaluation-form play-evaluation-shell" style="background: var(--card-bg); padding: 3rem; border-radius: 24px; margin: 2rem auto 0; border: 1px solid var(--border-color); box-shadow: 0 10px 25px rgba(0,0,0,0.3); width: 100%; max-width: 1100px; display: flex; flex-direction: column; align-items: center; position:relative;">
            ${participationLocked ? `
                <div class="participation-gate-overlay">
                    <div class="participation-gate-card">
                        <div class="participation-gate-title">${t('participation_login_required_title')}</div>
                        <button type="button" class="primary-action participation-gate-button" onclick="openAuthDialog('login')">${t('menu_login')}</button>
                    </div>
                </div>
            ` : ''}
            <div class="play-evaluation-content" style="width:100%; opacity:${participationLocked ? '0.28' : '1'}; pointer-events:${participationLocked ? 'none' : 'auto'};">
                <h3 style="margin-bottom: 2rem; color: var(--primary); font-size: 1.8rem; border-left: 6px solid var(--primary); padding-left: 1.5rem; align-self: flex-start; width: 100%;">${t('eval_submit')} - Model ${game.blind_id}</h3>
                <div class="play-eval-grid" style="margin-top: 0; width: 100%;">
                    ${EVALUATION_SCORE_KEYS.map((key) => `
                        <div class="slider-group play-eval-item">
                            <label class="play-eval-label" style="font-size: 1.1rem; margin-bottom: 1rem; font-weight: 600;">
                                <span class="play-eval-label-text">${formatEvaluationLabel(t('eval_' + key))}</span>
                                <span id="val-${key}" class="play-eval-score-value" style="color: var(--primary); font-size: 1.3rem; flex-shrink:0;">-</span>
                            </label>
                            <div class="liquid-range is-unrated" data-progress="44.44" style="--range-progress: 44.44%; --range-visual-progress: 44.44%;">
                                <input type="range" id="score-${key}" min="1" max="10" value="5" onpointerdown="markScoreTouched('${key}')" onkeydown="markScoreTouchedFromKey(event, '${key}')" oninput="updateScore('${key}')" ${participationLocked ? 'disabled' : ''}>
                                <span class="liquid-range-glass" aria-hidden="true"></span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div style="margin-top: 3rem; width: 100%; max-width: 1100px;">
                    <label style="display: block; margin-bottom: 1rem; font-size: 1.2rem; font-weight: bold; color: var(--primary);">${state.language === 'ko' ? '코멘트 (150자 이내)' : 'Comment (Max 150 chars)'}</label>
                    <textarea id="comment" rows="4" maxlength="150" placeholder="${t('comment_placeholder')}" ${participationLocked ? 'disabled' : ''} style="width: 100%; padding: 1.5rem; font-size: 1.2rem; border-radius: 15px; background: var(--surface-bg); color: var(--text-color); border: 1px solid var(--border-color); transition: border-color 0.3s; line-height: 1.6;"></textarea>
                </div>
                <button type="button" id="evaluation-submit-btn" class="primary-action" onclick="submitEvaluation()" ${participationLocked ? 'disabled' : ''} style="margin-top: 2.5rem; padding: 1.15rem 3rem; font-size: 1.4rem; font-weight: 800; width: auto; min-width: 300px;">${t('eval_submit')}</button>
            </div>
        </div>
    `;
}

function rerenderPlayInteractionPanels() {
    const evaluationRoot = document.getElementById('play-evaluation-form-root');
    if (evaluationRoot) {
        evaluationRoot.innerHTML = renderPlayEvaluationForm();
    }
    const commentsContainer = document.getElementById('play-comments-container');
    if (commentsContainer) {
        commentsContainer.innerHTML = renderPlayModelCommentsSection();
    }
}

function renderAbout() {
    const el = document.getElementById('view-list');
    el.innerHTML = `
        <div class="card about-page-card">
            <div class="about-brand">
                <h2 class="visually-hidden">${t('title')}</h2>
                <img src="/static/og-image.png?v=20260619-og1" alt="" aria-hidden="true">
            </div>
            <div class="about-page-copy">
                <p style="margin-bottom: 1.5rem;">${t('about_desc_1')}</p>
                <p style="margin-bottom: 2.5rem;">${t('about_desc_2')}</p>
                <h3 style="margin-bottom: 1.5rem; color: var(--text-color); font-size: 1.8rem; border-left: 5px solid var(--primary); padding-left: 1rem;">${state.language === 'ko' ? '실험 조건' : 'Experiment Constraints'}</h3>
                <div style="margin-bottom: 2.5rem;">
                    <p style="margin-bottom: 1.5rem;">${state.language === 'ko' ? '본 벤치마크는 두 가지 실험 조건으로 나뉘어 진행되었습니다.' : 'This benchmark was conducted under two different experimental conditions.'}</p>
                    <ul class="about-condition-list">
                        <li>
                            <strong style="color: var(--primary); font-size: 1.3rem;">${t('about_cond_1_title')}</strong><br>
                            ${t('about_cond_1_desc')}
                        </li>
                        <li>
                            <strong style="color: var(--primary); font-size: 1.3rem;">${t('about_cond_2_title')}</strong><br>
                            ${t('about_cond_2_desc')}
                        </li>
                        <li>
                            <strong style="color: var(--primary); font-size: 1.3rem;">${t('about_cond_3_title')}</strong><br>
                            ${t('about_cond_3_desc')}
                        </li>
                        <li>
                            <strong style="color: var(--primary); font-size: 1.3rem;">${t('about_cond_4_title')}</strong><br>
                            ${t('about_cond_4_desc')}
                        </li>
                        <li>
                            <strong style="color: var(--primary); font-size: 1.3rem;">${t('about_cond_5_title')}</strong><br>
                            ${t('about_cond_5_desc')}
                        </li>
                    </ul>
                </div>
                <h3 style="margin-bottom: 1.5rem; color: var(--text-color); font-size: 1.8rem; border-left: 5px solid var(--primary); padding-left: 1rem;">${state.language === 'ko' ? '관전 포인트' : 'Evaluation Points'}</h3>
                <p style="margin-bottom: 1rem;">${state.language === 'ko' ? '이 프로젝트를 통해 각 모델의 프롬프트 해석, 구현 역량, 창의성, 기술 활용력, 웹 디자인 감각의 차이를 살펴볼 수 있습니다.' : 'This project makes it possible to examine differences across models in prompt interpretation, implementation capability, creativity, technical execution, and web design sensibility.'}</p>
                <p>${state.language === 'ko' ? '또한 여러 사람의 평가가 축적될수록, 개별적인 인상에 머물 수 있는 판단을 보다 비교 가능한 평가로 확장해볼 수 있습니다.' : 'As evaluations from more people accumulate, judgments that might otherwise remain subjective impressions can be extended into a more comparable form of evaluation.'}</p>
            </div>
            <div class="about-contact-section">
                <button class="about-action-button" onclick="navigateToInquiry()">${t('contact')}</button>
            </div>
            <section class="about-extra-section">
                <h3>${t('support_heading')}</h3>
                <p>${t('support_body_1')}</p>
                <p>${t('support_body_2')}</p>
                <div class="about-link-actions">
                    <a class="about-action-button" href="https://ctee.kr/place/wikihoney" target="_blank" rel="noopener noreferrer">${t('support_kr')}</a>
                    <a class="about-action-button" href="https://ko-fi.com/wikihoney" target="_blank" rel="noopener noreferrer">${t('support_global')}</a>
                </div>
            </section>
            <section class="about-extra-section">
                <h3>${t('footer_other_projects')}</h3>
                <a class="about-project-link" href="https://www.hrmz.today" target="_blank" rel="noopener noreferrer">
                    <span class="about-project-main">
                        <img class="about-project-logo" src="/external-projects/hormuz-monitor-logo.jpg" alt="" aria-hidden="true">
                        <strong>Hormuz Monitor</strong>
                    </span>
                    <span class="about-project-url">https://www.hrmz.today</span>
                </a>
            </section>
        </div>
    `;
}

function navigateToInquiry() {
    const el = document.getElementById('view-list');
    const displayNameParam = encodeURIComponent(getCurrentProfileDisplayName() || "");
    const googleFormUrl = `https://docs.google.com/forms/d/e/1FAIpQLSfe83B3pzmpGqtHKDBjMIge3fcobUbT_lNZYjCZPm_Bm1n6wA/viewform?embedded=true&entry.1188400760=${displayNameParam}`;

    el.innerHTML = `
        <div class="card" style="height: 85vh; display: flex; flex-direction: column; max-width: 1000px; padding: 2rem; margin-top: 2rem;">
            <button class="secondary" style="width: auto; margin-bottom: 1.5rem;" onclick="renderAbout()">← ${t('btn_back')}</button>
            <h2 style="margin-bottom: 1.5rem; font-size: 1.8rem;">${t('contact')}</h2>
            <div class="game-container" style="flex: 1; box-shadow: inset 0 0 10px rgba(0,0,0,0.5);">
                <iframe src="${googleFormUrl}" width="100%" height="100%" frameborder="0" marginheight="0" marginwidth="0">로드 중…</iframe>
            </div>
        </div>
    `;
}

function updateScore(key) {
    markScoreTouched(key);
    const valEl = document.getElementById(`val-${key}`);
    const slider = document.getElementById(`score-${key}`);
    if (!slider) return;
    if (valEl) valEl.innerText = slider.value;
    const min = Number(slider.min || 1);
    const max = Number(slider.max || 10);
    const value = Number(slider.value);
    const progress = ((value - min) / (max - min)) * 100;
    const range = slider.closest('.liquid-range');
    const previous = Number(range?.dataset.progress ?? 44.44);
    const delta = progress - previous;
    const direction = delta >= 0 ? 1 : -1;
    const intensity = Math.min(Math.abs(delta) / 16, 1);
    const glassStretch = 1 + intensity * 0.18;
    const glassShift = direction * -1 * intensity * 3;
    slider.style.setProperty('--range-progress', `${progress}%`);
    if (!range) return;
    range.dataset.progress = `${progress}`;
    range.style.setProperty('--range-progress', `${progress}%`);
    range.style.setProperty('--range-visual-progress', getRangeThumbCenterPosition(slider, progress));
    range.style.setProperty('--range-glass-stretch', glassStretch.toFixed(3));
    range.style.setProperty('--range-glass-shift', `${glassShift.toFixed(1)}px`);
    range.classList.add('is-moving');
    window.clearTimeout(Number(range.dataset.resetTimer || 0));
    range.dataset.resetTimer = `${window.setTimeout(() => {
        range.classList.remove('is-moving');
        range.style.setProperty('--range-glass-stretch', '1');
        range.style.setProperty('--range-glass-shift', '0px');
    }, 140)}`;
}

function getRangeThumbCenterPosition(slider, progress) {
    const range = slider?.closest('.liquid-range');
    const width = Number(range?.clientWidth || slider?.clientWidth || 0);
    if (!width) return `${progress}%`;
    const thumbWidth = 42;
    const ratio = Math.min(Math.max(progress / 100, 0), 1);
    const travelWidth = Math.max(width - thumbWidth, 0);
    const centerPx = Math.min(width, (thumbWidth / 2) + (travelWidth * ratio));
    return `${centerPx.toFixed(1)}px`;
}

function markScoreTouched(key) {
    if (!EVALUATION_SCORE_KEYS.includes(key)) return;
    state.evaluationTouchedScores.add(key);
    const valEl = document.getElementById(`val-${key}`);
    const slider = document.getElementById(`score-${key}`);
    const range = slider?.closest('.liquid-range');
    if (!slider) return;
    if (valEl) valEl.innerText = slider.value;
    if (range) range.classList.remove('is-unrated');
}

function markScoreTouchedFromKey(event, key) {
    const scoringKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', ' ', 'Enter']);
    if (!scoringKeys.has(event?.key)) return;
    markScoreTouched(key);
}

function toggleFullScreen() {
    const iframe = document.getElementById('game-iframe');
    if (!iframe) return;

    if (!document.fullscreenElement) {
        if (iframe.requestFullscreen) iframe.requestFullscreen();
        else if (iframe.webkitRequestFullscreen) iframe.webkitRequestFullscreen();
        else if (iframe.msRequestFullscreen) iframe.msRequestFullscreen();
    } else if (document.exitFullscreen) {
        document.exitFullscreen();
    }
}
