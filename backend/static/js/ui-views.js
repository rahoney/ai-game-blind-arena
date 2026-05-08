function renderLogin() {
    const el = document.getElementById('view-login');
    el.innerHTML = `
        <div class="card" style="text-align: center; border: 2px solid var(--primary); box-shadow: 0 0 40px rgba(0, 0, 0, 0.22);">
            <h2 style="margin-bottom: 2rem; font-size: 2.2rem; color: var(--text-color); line-height: 1.3; font-weight: 800; letter-spacing: -0.5px;">${t('subtitle')}</h2>
            <p style="color: var(--text-muted); margin-bottom: 3rem; font-size: 1.4rem; line-height: 1.8; font-weight: 700; max-width: 600px; margin-left: auto; margin-right: auto; padding: 1.5rem; background: var(--surface-bg); border-radius: 12px;">${t('description')}</p>
            <div class="input-group" style="margin-bottom: 3rem; max-width: 500px; margin-left: auto; margin-right: auto;">
                <label for="nickname" style="font-weight: 900; font-size: 1.6rem; color: var(--text-color); display: block; margin-bottom: 1.2rem; text-transform: uppercase; letter-spacing: 2px;">${t('nickname_label')}</label>
                <input type="text" id="nickname" class="login-nickname-input" placeholder="${t('nickname_placeholder')}" onfocus="handleNicknameFocus(this)" onblur="handleNicknameBlur(this)" onkeypress="if(event.keyCode==13) handleLogin()" style="text-align: center; border-width: 3px; font-weight: 700; font-size: 1.8rem; padding: 1.5rem; border-radius: 18px; background: var(--surface-bg);" />
            </div>
            <button id="login-submit-btn" onclick="handleLogin()" style="padding: 1.5rem; font-size: 1.5rem; max-width: 450px; margin-left: auto; margin-right: auto; text-transform: uppercase; letter-spacing: 1px;">${t('btn_set')}</button>
        </div>
    `;
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
        const isEval = checkEvaluated(category, model.blind_id);
        const actualName = getActualModelNameIfEvaluated(category, model.blind_id);
        const evalClass = isEval ? 'completed' : '';
        const titleText = isEval
            ? `✅ Model ${model.blind_id} <br><span style="color: var(--success); font-size: 0.9em;">(${actualName})</span>`
            : `Model ${model.blind_id}`;

        return `<div class="game-card ${evalClass}" onclick="playGame('${model.blind_id}')">
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
                            <input type="range" id="score-${key}" min="1" max="10" value="5" oninput="updateScore('${key}')" style="--range-progress: 44.44%;">
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
    const nickname = encodeURIComponent(state.nickname || "");
    const googleFormUrl = `https://docs.google.com/forms/d/e/1FAIpQLSfe83B3pzmpGqtHKDBjMIge3fcobUbT_lNZYjCZPm_Bm1n6wA/viewform?embedded=true&entry.1188400760=${nickname}`;

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
    slider.style.setProperty('--range-progress', `${progress}%`);
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
