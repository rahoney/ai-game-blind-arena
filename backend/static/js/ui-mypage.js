function renderMyPage() {
    const el = document.getElementById('view-mypage');
    const accountProfile = state.account?.profile || {};
    const displayName = accountProfile.display_name || '';
    const loginId = accountProfile.login_id || '';
    const realName = accountProfile.real_name || '';
    const data = state.myPageData || {
        display_name: displayName,
        unique_eval_model_count: 0,
        evaluations_by_game_type: [],
        top_game_type: null,
        top_models: [],
    };

    const evalsByGameHtml = data.evaluations_by_game_type.length
        ? data.evaluations_by_game_type.map(item => `
            <li style="padding: 0.9rem 0; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; gap: 1rem;">
                <span>${escapeHtml(getCategoryDisplayName(item.game_type))}</span>
                <strong>${item.count}</strong>
            </li>
        `).join('')
        : `<li style="padding: 0.9rem 0; color: var(--text-muted);">${t('mypage_empty_evals')}</li>`;

    const topModelsHtml = data.top_models.length
        ? data.top_models.map((item, index) => `
            <li style="padding: 1rem 0; border-bottom: 1px solid var(--border-color);">
                <div style="display:flex; justify-content:space-between; gap: 1rem;">
                    <strong>#${index + 1} ${escapeHtml(item.actual_model_name)}</strong>
                    <span>${item.views}</span>
                </div>
                <div style="color: var(--text-muted); font-size: 0.95rem; margin-top: 0.25rem;">${escapeHtml(getCategoryDisplayName(item.game_type))}</div>
            </li>
        `).join('')
        : `<li style="padding: 1rem 0; color: var(--text-muted);">${t('mypage_empty_views')}</li>`;

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
    const badgeProgressText = currentProfileBadgeKey === badge.stage_key
        ? (badge.is_max_stage
            ? t('badge_max_stage')
            : t('badge_progress_to_next', { current: badge.current_count, next: badge.next_threshold }))
        : t('mypage_profile_badge_selected');
    const unlockedBadgeKeys = data.unlocked_badge_keys || ['badge_egg'];
    const unlockedBadgeCountText = String(data.unlocked_badge_count || unlockedBadgeKeys.length).padStart(2, '0');
    const selectedBadgeKey = state.profileBadgeSelection || currentProfileBadgeKey;
    const providerButtons = [
        ['google', 'google.com', 'auth_link_google'],
        ['kakao', 'oidc.kakao', 'auth_link_kakao'],
        ['naver', 'oidc.naver', 'auth_link_naver'],
        ['discord', 'oidc.discord', 'auth_link_discord'],
        ['github', 'github.com', 'auth_link_github'],
    ].map(([providerKey, providerId, labelKey]) => (
        state.account && !hasLinkedProvider(providerId)
            ? `<button class="secondary" style="width:auto; padding:0.85rem 1rem;" onclick="handleLinkSocialProvider('${providerKey}')">${t(labelKey)}</button>`
            : ''
    )).join('');

    el.innerHTML = `
        <div class="card" style="max-width: 1000px; margin-top: 2rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap: 1rem; margin-bottom: 2rem;">
                <button class="secondary" style="width: auto;" onclick="navigateTo('list', renderGameList)">← ${t('btn_back')}</button>
                <h2 style="margin:0; color: var(--primary); font-size: 2rem;">${t('menu_mypage')}</h2>
                <div style="width: 90px;"></div>
            </div>

            <div style="display:grid; grid-template-columns: 180px 1fr; gap: 2rem; align-items:start; margin-bottom: 2rem; padding:1.5rem; border-radius:28px; background:var(--surface-bg); border:1px solid var(--border-color); box-shadow:0 18px 40px rgba(0, 0, 0, 0.22);">
                <div>
                    <div style="width:160px; height:160px; border-radius: 24px; display:flex; align-items:center; justify-content:center; background:var(--card-bg); border:1px solid var(--border-color);">
                        ${renderBadgeSvg(currentProfileBadgeKey)}
                    </div>
                    <div style="width:160px; margin-top:0.85rem; padding:0.9rem; border:1px solid var(--border-color); border-radius:16px; background:var(--card-bg); text-align:center;">
                        <div style="font-size:0.82rem; color:var(--text-muted); font-weight:800; margin-bottom:0.25rem;">${t('mypage_badge_title')}</div>
                        <div style="font-size:1.05rem; font-weight:900; color:var(--text-color);">${badgeLabel}</div>
                        <div style="font-size:0.85rem; color:var(--text-muted); margin-top:0.35rem; line-height:1.35;">${badgeProgressText}</div>
                    </div>
                </div>
                <div>
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; margin-bottom:1rem;">
                        <div style="padding:0.85rem 1rem; border:1px solid var(--border-color); border-radius:14px; background:var(--card-bg);">
                            <div style="font-size:0.82rem; color:var(--text-muted); font-weight:800; margin-bottom:0.25rem;">${t('display_name_label')}</div>
                            <div style="font-size:1.25rem; color:var(--text-color); font-weight:900; word-break:break-word;">${escapeHtml(data.display_name || displayName || '-')}</div>
                        </div>
                        <div style="padding:0.85rem 1rem; border:1px solid var(--border-color); border-radius:14px; background:var(--card-bg);">
                            <div style="font-size:0.82rem; color:var(--text-muted); font-weight:800; margin-bottom:0.25rem;">${t('auth_real_name_label')}</div>
                            <div style="font-size:1.25rem; color:var(--text-color); font-weight:900; word-break:break-word;">${escapeHtml(realName || '-')}</div>
                        </div>
                        <div style="padding:0.85rem 1rem; border:1px solid var(--border-color); border-radius:14px; background:var(--card-bg);">
                            <div style="font-size:0.82rem; color:var(--text-muted); font-weight:800; margin-bottom:0.25rem;">${t('auth_login_id_label')}</div>
                            <div style="font-size:1.25rem; color:var(--text-color); font-weight:900; word-break:break-word;">${escapeHtml(loginId || '-')}</div>
                        </div>
                    </div>
                    <div style="display:flex; gap:0.6rem; align-items:stretch; flex-wrap:wrap; margin-bottom:1rem;">
                        <button class="secondary" style="width:auto; padding:0.85rem 1rem;" onclick="handleCurrentUserPasswordReset()">${t('mypage_password_reset')}</button>
                        ${providerButtons}
                        <button class="secondary" style="width:auto; padding:0.85rem 1rem; color:#ef4444;" onclick="handleDeleteAccount()">${t('mypage_delete_account')}</button>
                    </div>
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
                        <div style="padding: 1rem; border: 1px solid var(--border-color); border-radius: 16px; background: var(--card-bg); box-shadow:0 10px 24px rgba(0, 0, 0, 0.18);">
                            <div style="font-size: 0.9rem; color: var(--text-muted);">${t('mypage_unique_eval_models')}</div>
                            <div style="font-size: 1.8rem; font-weight: 700; color:var(--text-color);">${data.unique_eval_model_count}</div>
                        </div>
                        <div style="padding: 1rem; border: 1px solid var(--border-color); border-radius: 16px; background: var(--card-bg); box-shadow:0 10px 24px rgba(0, 0, 0, 0.18);">
                            <div style="font-size: 0.9rem; color: var(--text-muted);">${t('mypage_top_game_type')}</div>
                            <div style="font-size: 1.15rem; font-weight: 700; color:var(--text-color);">${topGameTypeLabel}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <div style="padding: 1.5rem; border: 1px solid var(--border-color); border-radius: 18px;">
                    <h3 style="margin-bottom: 1rem; color: var(--primary);">${t('mypage_eval_by_category')}</h3>
                    <ul style="list-style:none; padding:0; margin:0;">${evalsByGameHtml}</ul>
                </div>
                <div style="padding: 1.5rem; border: 1px solid var(--border-color); border-radius: 18px;">
                    <h3 style="margin-bottom: 1rem; color: var(--primary);">${t('mypage_top_models')}</h3>
                    <ul style="list-style:none; padding:0; margin:0;">${topModelsHtml}</ul>
                </div>
            </div>

            <div style="margin-top:2.5rem; padding:2rem; background:var(--surface-bg); border:1px solid var(--border-color); border-radius:24px; color:var(--text-color); box-shadow:0 10px 15px -3px rgba(0,0,0,0.18);">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1.5rem;">
                    <div>
                        <h3 style="margin:0; color:var(--text-color); font-size:1.6rem; font-weight:900;">${t('mypage_badge_collection')} <span style="display:inline-flex; align-items:center; margin-left:0.5rem; padding:0.2rem 0.55rem; border-radius:999px; background:var(--card-bg); border:1px solid var(--border-color); font-size:0.9rem; color:var(--text-muted); vertical-align:middle;">${t('mypage_unlocked_badges')} ${unlockedBadgeCountText}</span></h3>
                        <div style="font-size:0.95rem; color:var(--text-muted); margin-top:0.4rem; font-weight:600;">${t('mypage_badge_collection_desc')}</div>
                    </div>
                    <button onclick="saveProfileBadge()" style="width:auto; padding:0.9rem 1.5rem; background:var(--primary); color:var(--bg-color); border-radius:14px; font-weight:800;">${t('mypage_set_profile_badge')}</button>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:1.2rem;">
                    ${BADGE_DISPLAY_ORDER.map((badgeKey) => {
                        const isUnlocked = unlockedBadgeKeys.includes(badgeKey);
                        const isSelected = selectedBadgeKey === badgeKey;
                        if (!isUnlocked) {
                            return `
                                <div style="padding:1rem; border-radius:20px; border:2px dashed var(--border-color); background:var(--card-bg); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.7rem; opacity:0.72; min-height:162px;">
                                    <div style="width:90px; height:90px; border-radius:24px; background:var(--bg-color); color:var(--text-muted); display:flex; align-items:center; justify-content:center; font-size:3rem; font-weight:900;">?</div>
                                    <div style="font-size:0.9rem; font-weight:800; text-align:center; color:var(--text-muted);">${t('badge_locked_placeholder')}</div>
                                </div>
                            `;
                        }
                        return `
                            <button onclick="selectProfileBadge('${badgeKey}')" style="padding:1rem; border-radius:20px; border:2px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}; background:${isSelected ? 'var(--bg-color)' : 'var(--card-bg)'}; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:0.7rem; transition:all 0.2s;">
                                <div style="width:90px; height:90px;">${renderBadgeSvg(badgeKey, 90)}</div>
                                <div style="font-size:0.9rem; font-weight:800; text-align:center; color:${isSelected ? 'var(--primary)' : 'var(--text-color)'};">${t(badgeKey)}</div>
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
}
