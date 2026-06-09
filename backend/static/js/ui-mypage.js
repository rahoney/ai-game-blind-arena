const MYPAGE_PROVIDER_META = [
    { key: 'google', label: 'Google', icon: 'google' },
    { key: 'steam', label: 'Steam', iconPath: '/static/social/steam_icon_square.svg' },
    { key: 'kakao', label: 'Kakao', iconText: 'K' },
    { key: 'naver', label: 'Naver', iconText: 'N' },
    { key: 'discord', label: 'Discord', iconPath: '/static/social/discord_symbol_white.svg' },
    { key: 'github', label: 'GitHub', iconPath: '/static/social/github_invertocat_white.svg' },
];

function getMyPageProfileValue(key, fallback = '') {
    return state.account?.profile?.[key] || fallback || '';
}

function renderMyPageInfoTile(labelKey, value, extraClass = '') {
    return `
        <div class="mypage-info-tile ${extraClass}">
            <div class="mypage-info-label">${t(labelKey)}</div>
            <div class="mypage-info-value">${escapeHtml(value || '-')}</div>
        </div>
    `;
}

function renderMyPageAccountManageTile() {
    return `
        <button type="button" class="mypage-info-tile mypage-account-manage-tile" onclick="toggleMyPageAccountManagement()">
            <span>${t('mypage_account_manage')}</span>
        </button>
    `;
}

function renderMyPageProviderIcon(provider) {
    if (provider.icon === 'google') {
        return `
            <span class="mypage-provider-icon google" aria-hidden="true">
                <svg viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
            </span>
        `;
    }
    if (provider.iconPath) {
        return `<span class="mypage-provider-icon ${provider.key}" aria-hidden="true"><img src="${provider.iconPath}" alt=""></span>`;
    }
    return `<span class="mypage-provider-icon ${provider.key}" aria-hidden="true">${provider.iconText}</span>`;
}

function renderMyPageProviderRow(provider) {
    const linked = hasLinkedProvider(provider.key);
    const canUnlink = canUnlinkProvider(provider.key);
    return `
        <div class="mypage-provider-row">
            <div class="mypage-provider-name">
                ${renderMyPageProviderIcon(provider)}
                <span>${provider.label}</span>
            </div>
            ${linked
                ? (canUnlink ? `<div class="mypage-provider-actions">
                    <span class="mypage-provider-status">${t('mypage_provider_linked')}</span>
                    <button type="button" class="mypage-provider-unlink-button" onclick="handleMyPageProviderUnlink('${provider.key}')" ${state.isLoginSubmitting ? 'disabled' : ''}>${t('mypage_provider_unlink')}</button>
                </div>` : `<span class="mypage-provider-status">${t('mypage_provider_linked')}</span>`)
                : `<button type="button" class="mypage-provider-link-button" onclick="handleMyPageProviderLink('${provider.key}')" ${state.isLoginSubmitting ? 'disabled' : ''}>${t('mypage_provider_link')}</button>`
            }
        </div>
    `;
}

async function handleMyPageProviderLink(providerKey) {
    if (state.isLoginSubmitting) return;
    await handleLinkSocialProvider(providerKey);
}

async function handleMyPageProviderUnlink(providerKey) {
    if (state.isLoginSubmitting) return;
    await handleUnlinkSocialProvider(providerKey);
}

function renderAccountEmailChangeDialog() {
    if (!state.accountEmailChange?.open) return '';
    const email = state.accountEmailChange.email || getMyPageProfileValue('email', firebaseAuth?.currentUser?.email || '');
    const codeSent = !!state.accountEmailChange.codeSent;
    return `
        <div class="mypage-dialog-backdrop" role="presentation">
            <div class="mypage-dialog" role="dialog" aria-modal="true" aria-labelledby="account-email-change-title">
                <div class="mypage-dialog-header">
                    <h3 id="account-email-change-title">${t('account_email_change_title')}</h3>
                    <button type="button" class="mypage-dialog-close" onclick="closeAccountEmailChangeDialog()" aria-label="${t('btn_back')}">×</button>
                </div>
                <p class="mypage-dialog-desc">${t('account_email_change_desc')}</p>
                <label class="mypage-dialog-label" for="account-email-change-email">${t('account_email_change_new_email')}</label>
                <input type="email" id="account-email-change-email" value="${escapeHtml(email)}" placeholder="${t('auth_email_placeholder')}" ${codeSent || state.isLoginSubmitting ? 'disabled' : ''}>
                ${codeSent ? `
                    <label class="mypage-dialog-label" for="account-email-change-code">${t('auth_signup_code_label')}</label>
                    <input type="text" id="account-email-change-code" inputmode="numeric" maxlength="6" placeholder="${t('auth_signup_code_placeholder')}" oninput="updateAccountEmailChangeCodeState()" ${state.isLoginSubmitting ? 'disabled' : ''}>
                    <p id="account-email-change-countdown" class="auth-inline-status">${t('auth_signup_code_countdown', { time: getAccountEmailChangeCountdownText() })}</p>
                    <div class="mypage-dialog-actions">
                        <button id="account-email-change-confirm-btn" type="button" onclick="handleAccountEmailChangeConfirm()" disabled>${t('auth_signup_code_confirm')}</button>
                        <button type="button" class="secondary" onclick="handleAccountEmailChangeCodeRequest()" ${state.isLoginSubmitting ? 'disabled' : ''}>${t('auth_signup_code_resend')}</button>
                    </div>
                ` : `
                    <div class="mypage-dialog-actions">
                        <button type="button" onclick="handleAccountEmailChangeCodeRequest()" ${state.isLoginSubmitting ? 'disabled' : ''}>${t('auth_signup_code_send')}</button>
                        <button type="button" class="secondary" onclick="closeAccountEmailChangeDialog()">${t('admin_password_cancel')}</button>
                    </div>
                `}
            </div>
        </div>
    `;
}

function renderAccountLoginIdSetupDialog() {
    if (!state.accountLoginIdSetup?.open) return '';
    const email = state.accountLoginIdSetup.email || getMyPageProfileValue('email', firebaseAuth?.currentUser?.email || '');
    const codeSent = !!state.accountLoginIdSetup.codeSent;
    const token = state.accountLoginIdSetup.token || '';
    return `
        <div class="mypage-dialog-backdrop" role="presentation">
            <div class="mypage-dialog" role="dialog" aria-modal="true" aria-labelledby="account-login-id-setup-title">
                <div class="mypage-dialog-header">
                    <h3 id="account-login-id-setup-title">${t('account_login_id_create_title')}</h3>
                    <button type="button" class="mypage-dialog-close" onclick="closeAccountLoginIdSetupDialog()" aria-label="${t('btn_back')}">×</button>
                </div>
                <p class="mypage-dialog-desc">${t('account_login_id_create_desc')}</p>
                ${token ? `
                    <p class="auth-inline-status success">${t('auth_signup_email_verified_for', { email: escapeHtml(email) })}</p>
                    <label class="mypage-dialog-label" for="account-login-id">${t('auth_login_id_label')}</label>
                    <div class="mypage-dialog-inline-field">
                        <input type="text" id="account-login-id" maxlength="15" placeholder="${t('auth_login_id_placeholder')}" oninput="handleAccountLoginIdInput()" ${state.isLoginSubmitting ? 'disabled' : ''}>
                        <button type="button" class="secondary" onclick="handleAccountLoginIdAvailabilityCheck()" ${state.isLoginSubmitting ? 'disabled' : ''}>${t('auth_login_id_check')}</button>
                    </div>
                    <p id="account-login-id-availability" class="auth-field-message"></p>
                    <label class="mypage-dialog-label" for="account-real-name">${t('auth_real_name_label')}</label>
                    <input type="text" id="account-real-name" placeholder="${t('auth_real_name_placeholder')}" oninput="updateAccountLoginIdSetupSubmitState()" ${state.isLoginSubmitting ? 'disabled' : ''}>
                    <label class="mypage-dialog-label" for="account-password">${t('auth_password_label')}</label>
                    <input type="password" id="account-password" placeholder="${t('auth_password_placeholder')}" oninput="updateAccountLoginIdSetupSubmitState()" ${state.isLoginSubmitting ? 'disabled' : ''}>
                    <label class="mypage-dialog-label" for="account-password-confirm">${t('auth_password_confirm_label')}</label>
                    <input type="password" id="account-password-confirm" placeholder="${t('auth_password_confirm_placeholder')}" oninput="updateAccountLoginIdSetupSubmitState()" ${state.isLoginSubmitting ? 'disabled' : ''}>
                    <div class="mypage-dialog-actions">
                        <button id="account-login-id-submit-btn" type="button" onclick="handleAccountLoginIdSetupSubmit()" disabled>${t('account_login_id_create_submit')}</button>
                        <button type="button" class="secondary" onclick="closeAccountLoginIdSetupDialog()">${t('admin_password_cancel')}</button>
                    </div>
                ` : codeSent ? `
                    <p class="auth-inline-status">${t('auth_verify_email_sent_to', { email: escapeHtml(email) })}</p>
                    <label class="mypage-dialog-label" for="account-login-id-code">${t('auth_signup_code_label')}</label>
                    <input type="text" id="account-login-id-code" inputmode="numeric" maxlength="6" placeholder="${t('auth_signup_code_placeholder')}" oninput="updateAccountLoginIdSetupCodeState()" ${state.isLoginSubmitting ? 'disabled' : ''}>
                    <p id="account-login-id-code-countdown" class="auth-inline-status">${t('auth_signup_code_countdown', { time: getAccountLoginIdSetupCountdownText() })}</p>
                    <div class="mypage-dialog-actions">
                        <button id="account-login-id-code-confirm-btn" type="button" onclick="handleAccountLoginIdSetupCodeConfirm()" disabled>${t('auth_signup_code_confirm')}</button>
                        <button type="button" class="secondary" onclick="handleAccountLoginIdSetupCodeRequest()" ${state.isLoginSubmitting ? 'disabled' : ''}>${t('auth_signup_code_resend')}</button>
                    </div>
                ` : `
                    <label class="mypage-dialog-label" for="account-login-id-email">${t('auth_email_label')}</label>
                    <input type="email" id="account-login-id-email" value="${escapeHtml(email)}" placeholder="${t('auth_email_placeholder')}" ${state.isLoginSubmitting ? 'disabled' : ''}>
                    <div class="mypage-dialog-actions">
                        <button type="button" onclick="handleAccountLoginIdSetupCodeRequest()" ${state.isLoginSubmitting ? 'disabled' : ''}>${t('auth_signup_code_send')}</button>
                        <button type="button" class="secondary" onclick="closeAccountLoginIdSetupDialog()">${t('admin_password_cancel')}</button>
                    </div>
                `}
            </div>
        </div>
    `;
}

function renderMyPageModalRoot() {
    const root = document.getElementById('global-modal-root');
    if (!root) return;
    root.innerHTML = `${renderAccountEmailChangeDialog()}${renderAccountLoginIdSetupDialog()}`;
}

function renderMyPageAccountManagementPanel() {
    if (!state.mypageAccountManagementOpen) return '';
    const realName = getMyPageProfileValue('real_name');
    const email = getMyPageProfileValue('email', firebaseAuth?.currentUser?.email || '');
    const loginId = getMyPageProfileValue('login_id');
    const hasLoginId = !!loginId;
    const passwordReady = hasPasswordLoginMethod() && hasLoginId;
    return `
        <section class="mypage-account-panel">
            <div class="mypage-account-panel-header">
                <h3>${t('mypage_account_manage')}</h3>
                <button type="button" class="secondary mypage-account-close-button" onclick="toggleMyPageAccountManagement(false)">${t('mypage_account_manage_close')}</button>
            </div>
            <div class="mypage-account-section">
                <h4>${t('mypage_account_basic_info')}</h4>
                <dl class="mypage-account-definition-list">
                    <div>
                        <dt>${t('mypage_login_id_label')}</dt>
                        <dd>
                            <span>${escapeHtml(loginId || '-')}</span>
                            ${hasLoginId ? '' : `<button type="button" class="mypage-inline-link" onclick="openAccountLoginIdSetupDialog()">${t('account_login_id_create')}</button>`}
                        </dd>
                    </div>
                    <div>
                        <dt>${t('auth_real_name_label')}</dt>
                        <dd>${escapeHtml(realName || '-')}</dd>
                    </div>
                    <div>
                        <dt>${t('mypage_registered_email')}</dt>
                        <dd>
                            <span>${escapeHtml(email || '-')}</span>
                            ${passwordReady
                                ? `<button type="button" class="mypage-inline-link" onclick="openAccountEmailChangeDialog()">${t('account_email_change_link')}</button>`
                                : `<button type="button" class="mypage-inline-link" disabled title="${t('account_email_change_requires_login_id')}">${t('account_email_change_link')}</button>`
                            }
                        </dd>
                    </div>
                </dl>
            </div>
            <div class="mypage-account-section">
                <h4>${t('mypage_login_security')}</h4>
                <button type="button" class="secondary mypage-compact-action" onclick="handleCurrentUserPasswordReset()" ${passwordReady ? '' : `disabled title="${t('mypage_password_reset_requires_login_id')}"`}>${t('mypage_password_reset')}</button>
            </div>
            <div class="mypage-account-section">
                <h4>${t('mypage_social_login')}</h4>
                <div class="mypage-provider-list">
                    ${MYPAGE_PROVIDER_META.map(renderMyPageProviderRow).join('')}
                </div>
            </div>
            <div class="mypage-account-section danger">
                <h4>${t('mypage_delete_account')}</h4>
                <p>${t('mypage_delete_account_desc')}</p>
                <button type="button" class="secondary mypage-delete-button" onclick="handleDeleteAccount()">${t('mypage_delete_account')}</button>
            </div>
        </section>
    `;
}

function toggleMyPageAccountManagement(forceOpen) {
    state.mypageAccountManagementOpen = typeof forceOpen === 'boolean'
        ? forceOpen
        : !state.mypageAccountManagementOpen;
    renderMyPage();
}

function renderMyPage() {
    const el = document.getElementById('view-mypage');
    const accountProfile = state.account?.profile || {};
    const displayName = accountProfile.display_name || '';
    const loginId = accountProfile.login_id || '';
    const data = state.myPageData || {
        display_name: displayName,
        unique_eval_model_count: 0,
        evaluations_by_game_type: [],
        top_game_type: null,
        top_models: [],
    };

    const evalsByGameHtml = data.evaluations_by_game_type.length
        ? data.evaluations_by_game_type.map(item => `
            <li class="mypage-stat-list-item">
                <span>${escapeHtml(getCategoryDisplayName(item.game_type))}</span>
                <strong>${item.count}</strong>
            </li>
        `).join('')
        : `<li class="mypage-empty-list-item">${t('mypage_empty_evals')}</li>`;

    const topModelsHtml = data.top_models.length
        ? data.top_models.map((item, index) => `
            <li class="mypage-model-list-item">
                <div>
                    <strong>#${index + 1} ${escapeHtml(item.actual_model_name)}</strong>
                    <span>${item.views}</span>
                </div>
                <p>${escapeHtml(getCategoryDisplayName(item.game_type))}</p>
            </li>
        `).join('')
        : `<li class="mypage-empty-list-item">${t('mypage_empty_views')}</li>`;

    const topGameTypeLabel = data.top_game_type
        ? `${escapeHtml(getCategoryDisplayName(data.top_game_type.game_type))} (${data.top_game_type.views})`
        : t('mypage_empty_top_game');
    const badge = data.badge || {
        stage_key: 'badge_egg',
        current_count: data.unique_eval_model_count || 0,
        next_threshold: 5,
        is_max_stage: false,
    };
    const currentProfileBadgeKey = data.profile_badge_key || badge.stage_key || 'badge_egg';
    const badgeLabel = t(currentProfileBadgeKey);
    const unlockedBadgeKeys = data.unlocked_badge_keys || ['badge_egg'];
    const unlockedBadgeCountText = String(data.unlocked_badge_count || unlockedBadgeKeys.length).padStart(2, '0');
    const selectedBadgeKey = state.profileBadgeSelection || currentProfileBadgeKey;

    el.innerHTML = `
        <div class="card mypage-card">
            <div class="mypage-header">
                <button class="secondary mypage-back-button" onclick="navigateTo('list', renderGameList)">← ${t('btn_back')}</button>
                <h2>${t('menu_mypage')}</h2>
                <div class="mypage-header-spacer"></div>
            </div>

            <div class="mypage-profile-shell">
                <div class="mypage-badge-column">
                    <div class="mypage-badge-preview">${renderBadgeSvg(currentProfileBadgeKey)}</div>
                    <div class="mypage-badge-summary">
                        <div>${t('mypage_badge_title')}</div>
                        <strong>${badgeLabel}</strong>
                    </div>
                </div>
                <div class="mypage-profile-main">
                    <div class="mypage-info-grid">
                        ${renderMyPageInfoTile('display_name_label', data.display_name || displayName || '-')}
                        ${renderMyPageInfoTile('mypage_login_id_label', loginId || '-')}
                        ${renderMyPageAccountManageTile()}
                    </div>
                    ${renderMyPageAccountManagementPanel()}
                    <div class="mypage-metrics-grid">
                        <div class="mypage-metric-card">
                            <div>${t('mypage_unique_eval_models')}</div>
                            <strong>${data.unique_eval_model_count}</strong>
                        </div>
                        <div class="mypage-metric-card">
                            <div>${t('mypage_top_game_type')}</div>
                            <strong>${topGameTypeLabel}</strong>
                        </div>
                    </div>
                </div>
            </div>

            <div class="mypage-stats-grid">
                <div class="mypage-subsection">
                    <h3>${t('mypage_eval_by_category')}</h3>
                    <ul>${evalsByGameHtml}</ul>
                </div>
                <div class="mypage-subsection">
                    <h3>${t('mypage_top_models')}</h3>
                    <ul>${topModelsHtml}</ul>
                </div>
            </div>

            <div class="mypage-badge-collection">
                <div class="mypage-badge-collection-header">
                    <div>
                        <h3>${t('mypage_badge_collection')} <span>${t('mypage_unlocked_badges')} ${unlockedBadgeCountText}</span></h3>
                        <p>${t('mypage_badge_collection_desc')}</p>
                    </div>
                    <button onclick="saveProfileBadge()" class="mypage-save-badge-button">${t('mypage_set_profile_badge')}</button>
                </div>
                <div class="mypage-badge-grid">
                    ${BADGE_DISPLAY_ORDER.map((badgeKey) => {
                        const isUnlocked = unlockedBadgeKeys.includes(badgeKey);
                        const isSelected = selectedBadgeKey === badgeKey;
                        if (!isUnlocked) {
                            return `
                                <div class="mypage-badge-locked">
                                    <div>?</div>
                                    <strong>${t('badge_locked_placeholder')}</strong>
                                </div>
                            `;
                        }
                        return `
                            <button onclick="selectProfileBadge('${badgeKey}')" class="mypage-badge-option ${isSelected ? 'selected' : ''}">
                                <span>${renderBadgeSvg(badgeKey, 90)}</span>
                                <strong>${t(badgeKey)}</strong>
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;

    renderMyPageModalRoot();

    if (state.accountEmailChange?.open && state.accountEmailChange?.codeSent) {
        startAccountEmailChangeCountdown();
    }
}
