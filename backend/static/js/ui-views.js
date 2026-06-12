function renderAuthFieldLabel(inputId, labelKey, statusId = inputId) {
    return `<label class="auth-field-label" for="${inputId}">
        <span>${t(labelKey)}</span>
        <span id="${statusId}-status" class="auth-field-status idle">•</span>
    </label>`;
}

function getAuthLanguageKey() {
    return (state.language || 'ko').split('-')[0] === 'en' ? 'en' : 'ko';
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
    const isSignup = mode === 'signup';
    const isDisplayName = mode === 'display_name';
    const isVerifyEmail = mode === 'verify_email';
    const isHelp = mode === 'help';
    const isFindId = mode === 'find_id';
    const isResetPassword = mode === 'reset_password';
    const authBusyNotice = state.isLoginSubmitting
        ? `<p class="auth-inline-status">${t('auth_login_processing')}</p>`
        : '';
    el.innerHTML = `
        <div class="card auth-card">
            ${isDisplayName || isVerifyEmail || isHelp || isFindId || isResetPassword ? `<p class="auth-description">${isDisplayName ? t('auth_display_name_setup_desc') : isVerifyEmail ? t('auth_verify_email_desc') : isHelp ? t('auth_help_desc') : isFindId ? t('auth_find_id_desc') : t('auth_reset_password_desc')}</p>` : ''}
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
    `;
    if (isSignup) {
        updateSignupSubmitState();
        startSignupEmailCountdown();
    } else {
        stopSignupEmailCountdown();
    }
}

function renderCategorySelection() {
    const el = document.getElementById('view-category');
    const strictCategories = state.categories.filter(category => category.group === 'strict');
    const advancedCategories = state.categories.filter(category => category.group === 'advanced');
    const getCategoryLabel = (category) => {
        const key = category.translation_key || category.name;
        return key.startsWith('cat_') ? t(key) : key;
    };
    const getCategoryHtml = (category) => {
        if (!state.games[category.name]) return '';
        return `<div class="game-card" onclick="selectCategory('${category.name}')">
            <h3 style="font-size: 1.6rem;">${getCategoryLabel(category)}</h3>
        </div>`;
    };

    el.innerHTML = `
        <div class="card" style="max-width: 900px;">
            <h2 style="margin-bottom: 1rem; font-size: 2.2rem; text-align: center;">${t('category_selection_title')}</h2>
            <p style="margin-bottom: 3rem; color: var(--text-muted); font-size: 1.3rem; text-align: center; font-weight: 600;">${t('category_selection_desc')}</p>
            <div style="margin-bottom: 3rem;">
                <h3 style="color: var(--primary); font-size: 1.6rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 1rem;">${t('group_strict_title')}</h3>
                <p style="color: var(--text-muted); font-size: 1.2rem; margin-bottom: 1.5rem;">${t('group_strict_desc')}</p>
                <div class="grid">
                    ${strictCategories.map(getCategoryHtml).join('')}
                </div>
            </div>
            <div>
                <h3 style="color: var(--primary); font-size: 1.6rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 1rem;">${t('group_advanced_title')}</h3>
                <p style="color: var(--text-muted); font-size: 1.2rem; margin-bottom: 1.5rem;">${t('group_advanced_desc')}</p>
                <div class="grid">
                    ${advancedCategories.map(getCategoryHtml).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderGameList() {
    const el = document.getElementById('view-list');
    const category = state.selectedCategory;
    const models = state.games[category] || [];
    const categoryMeta = state.categories.find(item => item.name === category);
    const catLabel = categoryMeta && categoryMeta.translation_key?.startsWith('cat_')
        ? t(categoryMeta.translation_key)
        : category;

    const modelsHtml = models.map((model) => {
        const isEval = checkEvaluated(category, model);
        const actualName = getActualModelNameIfEvaluated(category, model);
        const evalClass = isEval ? 'completed' : '';
        const titleText = isEval
            ? `✅ ${escapeHtml(actualName || `Model ${model.blind_id}`)}`
            : `Model ${model.blind_id}`;

        const launchDisabled = state.isPlayLaunching ? 'aria-disabled="true" style="pointer-events:none; opacity:0.68;"' : '';

        return `<div class="game-card ${evalClass}" ${launchDisabled} onclick="playGame('${model.blind_id}')">
            <h3>${titleText}</h3>
            <div style="margin-top: 1rem; color: var(--text-muted); font-size: 0.9rem;">${t('view_count')}: ${model.play_count || 0}</div>
            <div style="margin-top: 0.35rem; color: var(--text-muted); font-size: 0.9rem;">${t('eval_count')}: ${model.eval_count || 0}</div>
        </div>`;
    }).join('');

    el.innerHTML = `
        <div style="width: 100%; max-width: 1200px; padding-bottom: 4rem;">
            <h2 style="font-size: 2.2rem; margin-bottom: 0.7rem; color: var(--primary); border-bottom: 2px solid var(--border-color); padding-bottom: 0.7rem; text-align: center;">${catLabel}</h2>
            ${renderGameGuideCard(category, { concise: true, marginTop: '0', marginBottom: '1.1rem' })}
            <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));">
                ${modelsHtml}
            </div>
            <div style="margin-top: 3rem; text-align: center;">
                <button class="primary-action" onclick="navigateTo('results', renderResults)" style="width: auto; padding: 1.25rem 2.8rem; font-size: 1.2rem;">${t('all_results')}</button>
            </div>
        </div>
    `;
}

function renderPlayArea() {
    const el = document.getElementById('view-play');
    const game = state.selectedGame;
    el.innerHTML = `
        <div style="width: 100%; max-width: 95vw; display: flex; flex-direction: column; min-height: 90vh; padding-bottom: 50px;">
            <div class="play-toolbar">
                <button type="button" class="primary-action" style="width: auto; padding: 1.05rem 1.8rem;" onclick="navigateTo('list', renderGameList)">← ${state.language === 'ko' ? '모델 목록으로' : 'Back to Models'}</button>
                <button type="button" class="primary-action" style="width: auto; padding: 1.05rem 1.8rem;" onclick="toggleFullScreen()">${state.language === 'ko' ? '전체화면 모드' : 'Fullscreen'}</button>
            </div>
            ${renderGameGuideCard(state.selectedCategory, { marginTop: '0', marginBottom: '1.5rem' })}
            <div class="game-container" style="width: 100%; height: 1050px; border: 2px solid var(--border-color); background: #000; border-radius: 20px; overflow: hidden; box-shadow: 0 0 30px rgba(0,0,0,0.5); flex-shrink: 0;">
                <iframe id="game-iframe" src="${game.file}" allowfullscreen="true" style="width: 100%; height: 100%; border: none;"></iframe>
            </div>
            <div class="evaluation-form" style="background: var(--card-bg); padding: 3rem; border-radius: 24px; margin: 2rem auto 0; border: 1px solid var(--border-color); box-shadow: 0 10px 25px rgba(0,0,0,0.3); width: 100%; max-width: 1100px; display: flex; flex-direction: column; align-items: center;">
                <h3 style="margin-bottom: 2rem; color: var(--primary); font-size: 1.8rem; border-left: 6px solid var(--primary); padding-left: 1.5rem; align-self: flex-start; width: 100%;">${t('eval_submit')} - Model ${game.blind_id}</h3>
                <div class="play-eval-grid" style="margin-top: 0; width: 100%;">
                    ${['control', 'structure', 'presentation', 'difficulty', 'fun', 'overall'].map((key) => `
                        <div class="slider-group play-eval-item">
                            <label class="play-eval-label" style="font-size: 1.1rem; margin-bottom: 1rem; font-weight: 600;">
                                <span class="play-eval-label-text">${formatEvaluationLabel(t('eval_' + key))}</span>
                                <span id="val-${key}" style="color: var(--primary); font-size: 1.3rem; flex-shrink:0;">5</span>
                            </label>
                            <div class="liquid-range" data-progress="44.44" style="--range-progress: 44.44%;">
                                <input type="range" id="score-${key}" min="1" max="10" value="5" oninput="updateScore('${key}')">
                                <span class="liquid-range-glass" aria-hidden="true"></span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div style="margin-top: 3rem; width: 100%; max-width: 1100px;">
                    <label style="display: block; margin-bottom: 1rem; font-size: 1.2rem; font-weight: bold; color: var(--primary);">${state.language === 'ko' ? '코멘트 (150자 이내)' : 'Comment (Max 150 chars)'}</label>
                    <textarea id="comment" rows="4" maxlength="150" placeholder="${t('comment_placeholder')}" style="width: 100%; padding: 1.5rem; font-size: 1.2rem; border-radius: 15px; background: var(--surface-bg); color: var(--text-color); border: 1px solid var(--border-color); transition: border-color 0.3s; line-height: 1.6;"></textarea>
                </div>
                <button type="button" id="evaluation-submit-btn" class="primary-action" onclick="submitEvaluation()" style="margin-top: 2.5rem; padding: 1.15rem 3rem; font-size: 1.4rem; font-weight: 800; width: auto; min-width: 300px;">${t('eval_submit')}</button>
            </div>
            <div id="play-comments-container" style="width:100%; margin-top:2rem;">
                ${renderPlayModelCommentsSection()}
            </div>
        </div>
    `;
}

function renderAbout() {
    const el = document.getElementById('view-list');
    el.innerHTML = `
        <div class="card" style="max-width: 900px; margin-top: 2rem; line-height: 1.8;">
            <h2 style="text-align: center; margin-bottom: 0.5rem; color: var(--primary); font-size: 2.5rem;">${t('title')}</h2>
            <p style="text-align: center; margin-bottom: 2rem; font-size: 1.2rem; color: var(--text-muted); font-weight: 500; border-bottom: 1px solid var(--border-color); padding-bottom: 1.5rem;">${t('subtitle')}</p>
            <div style="color: var(--text-color); font-size: 1.2rem; text-align: left; padding: 0 1rem;">
                <p style="margin-bottom: 1.5rem;">${t('about_desc_1')}</p>
                <p style="margin-bottom: 2.5rem;">${t('about_desc_2')}</p>
                <h3 style="margin-bottom: 1.5rem; color: var(--text-color); font-size: 1.8rem; border-left: 5px solid var(--primary); padding-left: 1rem;">${state.language === 'ko' ? '실험 조건' : 'Experiment Constraints'}</h3>
                <div style="margin-bottom: 2.5rem;">
                    <p style="margin-bottom: 1.5rem;">${state.language === 'ko' ? '본 벤치마크는 두 가지 실험 조건으로 나뉘어 진행되었습니다.' : 'This benchmark was conducted under two different experimental conditions.'}</p>
                    <ul style="list-style: none; padding: 0;">
                        <li style="margin-bottom: 1.5rem; padding: 1.5rem; background: var(--surface-bg); border-radius: 12px; border: 1px solid var(--border-color);">
                            <strong style="color: var(--primary); font-size: 1.3rem;">${t('about_cond_1_title')}</strong><br>
                            ${t('about_cond_1_desc')}
                        </li>
                        <li style="margin-bottom: 1.5rem; padding: 1.5rem; background: var(--surface-bg); border-radius: 12px; border: 1px solid var(--border-color);">
                            <strong style="color: var(--primary); font-size: 1.3rem;">${t('about_cond_2_title')}</strong><br>
                            ${t('about_cond_2_desc')}
                        </li>
                        <li style="margin-bottom: 1.5rem; padding: 1.5rem; background: var(--surface-bg); border-radius: 12px; border: 1px solid var(--border-color);">
                            <strong style="color: var(--primary); font-size: 1.3rem;">${t('about_cond_3_title')}</strong><br>
                            ${t('about_cond_3_desc')}
                        </li>
                        <li style="margin-bottom: 1.5rem; padding: 1.5rem; background: var(--surface-bg); border-radius: 12px; border: 1px solid var(--border-color);">
                            <strong style="color: var(--primary); font-size: 1.3rem;">${t('about_cond_4_title')}</strong><br>
                            ${t('about_cond_4_desc')}
                        </li>
                        <li style="padding: 1.5rem; background: var(--surface-bg); border-radius: 12px; border: 1px solid var(--border-color);">
                            <strong style="color: var(--primary); font-size: 1.3rem;">${t('about_cond_5_title')}</strong><br>
                            ${t('about_cond_5_desc')}
                        </li>
                    </ul>
                </div>
                <h3 style="margin-bottom: 1.5rem; color: var(--text-color); font-size: 1.8rem; border-left: 5px solid var(--primary); padding-left: 1rem;">${state.language === 'ko' ? '관전 포인트' : 'Evaluation Points'}</h3>
                <p style="margin-bottom: 1rem;">${state.language === 'ko' ? '이 프로젝트를 통해 각 모델의 프롬프트 해석, 구현 역량, 창의성, 기술 활용력, 웹 디자인 감각의 차이를 살펴볼 수 있습니다.' : 'This project makes it possible to examine differences across models in prompt interpretation, implementation capability, creativity, technical execution, and web design sensibility.'}</p>
                <p>${state.language === 'ko' ? '또한 여러 사람의 평가가 축적될수록, 개별적인 인상에 머물 수 있는 판단을 보다 비교 가능한 평가로 확장해볼 수 있습니다.' : 'As evaluations from more people accumulate, judgments that might otherwise remain subjective impressions can be extended into a more comparable form of evaluation.'}</p>
            </div>
            <div style="margin-top: 4rem; text-align: center;">
                <button class="primary-action" onclick="navigateToInquiry()" style="width: auto; padding: 1.25rem 3.6rem; font-size: 1.4rem;">${t('contact')}</button>
            </div>
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
