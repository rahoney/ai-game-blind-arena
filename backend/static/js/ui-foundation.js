function renderBadgeSvg(stageKey, size = 160) {
    const badgeAssetVersion = '20260416-15';
    const assetMap = {
        badge_egg: 'badge_egg.svg',
        badge_junior_owl: 'badge_junior_owl.svg',
        badge_student_owl: 'badge_student_owl.svg',
        badge_apprentice_owl: 'badge_apprentice_owl.svg',
        badge_senior_owl: 'badge_senior_owl.svg',
        badge_critic_owl: 'badge_critic_owl.svg',
        badge_doctor_owl: 'badge_doctor_owl.svg',
        badge_professor_owl: 'badge_professor_owl.svg',
        badge_goat_owl: 'badge_goat_owl.svg',
        badge_gamer_owl: 'badge_gamer_owl.png',
        badge_wizard_owl: 'badge_wizard_owl.png',
        badge_soldier_owl: 'badge_soldier_owl.png',
        badge_mario_owl: 'badge_mario_owl.png',
        badge_cardmaster_owl: 'badge_cardmaster_owl.png',
        badge_spaceship_owl: 'badge_spaceship_owl.png',
        badge_board_owl: 'badge_board_owl.png',
    };
    const fileName = assetMap[stageKey] || assetMap.badge_egg;
    const src = `/static/badges/${fileName}?v=${badgeAssetVersion}`;
    return `<img src="${src}" alt="${escapeHtml(stageKey)}" width="${size}" height="${size}" style="width:${size}px;height:${size}px;object-fit:contain;display:block;" />`;
}

const BADGE_DISPLAY_ORDER = [
    'badge_egg',
    'badge_junior_owl',
    'badge_student_owl',
    'badge_apprentice_owl',
    'badge_senior_owl',
    'badge_critic_owl',
    'badge_doctor_owl',
    'badge_professor_owl',
    'badge_goat_owl',
    'badge_gamer_owl',
    'badge_wizard_owl',
    'badge_soldier_owl',
    'badge_mario_owl',
    'badge_cardmaster_owl',
    'badge_spaceship_owl',
    'badge_board_owl',
];

function getCategoryDisplayName(categoryName) {
    const category = (state.categories || []).find((item) => item.name === categoryName);
    const key = category?.translation_key || categoryName;
    return key && key.startsWith('cat_') ? t(key) : key;
}

function formatEvaluationLabel(label) {
    const rawLabel = String(label || '');
    const bracketIndex = rawLabel.indexOf('(');
    if (bracketIndex === -1) {
        return escapeHtml(rawLabel);
    }

    const mainLabel = rawLabel.slice(0, bracketIndex).trim();
    const detailLabel = rawLabel.slice(bracketIndex).trim();
    return `${escapeHtml(mainLabel)}<br><span class="play-eval-label-detail">${escapeHtml(detailLabel)}</span>`;
}

function getGameGuideContent(categoryName) {
    const guides = {
        ko: {
            '던전 탐색': {
                title: '던전 탐색 2D 게임',
                lines: [
                    '전략적으로 이동하여 탈출구를 찾는 게임입니다.',
                    '모델 마다 다르지만 이동은 대체로 WASD 또는 방향키입니다.',
                    '게임 화면에서 나가려면 ESC 키를 누르세요.',
                ],
            },
            '강화된 벽돌깨기': {
                title: '강화된 벽돌깨기 게임',
                lines: [
                    '패들을 조작해 공을 튕겨 모든 벽돌을 제거하는 게임입니다.',
                    '모델 마다 다르지만 이동은 대체로 방향키입니다.',
                    '게임 화면에서 나가려면 ESC 키를 누르세요.',
                ],
            },
            '카드배틀': {
                title: '카드 배틀 게임',
                lines: [
                    '카드를 전략적으로 사용해 적을 쓰러뜨리는 턴제 전투 게임입니다.',
                    '게임 화면에서 나가려면 ESC 키를 누르세요.',
                ],
            },
            '1인칭 미니 FPS': {
                title: '1인칭 미니 FPS 게임',
                lines: [
                    '1인칭 시점으로 적을 조준하고 공격하여 제압하는 슈팅 게임입니다.',
                    '모델 마다 다르지만 이동은 대체로 WASD 키 입니다.',
                    '게임 화면에서 나가려면 ESC 키를 누르세요.',
                ],
            },
            '서바이벌 디펜스': {
                title: '서바이벌 디펜스 게임',
                lines: [
                    '몰려오는 적을 상대로 생존하며, 선택을 통해 점점 강해지는 액션 생존 게임입니다.',
                    '모델 마다 다르지만 이동은 대체로 WASD 또는 방향키입니다.',
                    '게임 화면에서 나가려면 ESC 키를 누르세요.',
                ],
            },
            '횡스크롤 액션': {
                title: '횡스크롤 액션 게임',
                lines: [
                    '마리오처럼 우측으로 이동하여 골인 지점까지 도달해야 하는 2D 액션 게임입니다.',
                    '모델 마다 다르지만 이동은 대체로 WASD 또는 방향키입니다.',
                    '게임 화면에서 나가려면 ESC 키를 누르세요.',
                ],
            },
        },
        en: {
            '던전 탐색': {
                title: 'Dungeon Exploration 2D Game',
                lines: [
                    'Move strategically to find the exit.',
                    'Controls vary by model, but movement is usually with WASD or the arrow keys.',
                    'Press ESC to leave the game screen.',
                ],
            },
            '강화된 벽돌깨기': {
                title: 'Enhanced Brick Breaker Game',
                lines: [
                    'Control the paddle, bounce the ball, and clear every brick.',
                    'Controls vary by model, but movement is usually with the arrow keys.',
                    'Press ESC to leave the game screen.',
                ],
            },
            '카드배틀': {
                title: 'Card Battle Game',
                lines: [
                    'Use cards strategically to defeat enemies in turn-based battles.',
                    'Press ESC to leave the game screen.',
                ],
            },
            '1인칭 미니 FPS': {
                title: 'Mini First-Person FPS Game',
                lines: [
                    'Aim at enemies and take them down in a first-person shooter experience.',
                    'Controls vary by model, but movement is usually with the WASD keys.',
                    'Press ESC to leave the game screen.',
                ],
            },
            '서바이벌 디펜스': {
                title: 'Survival Defense Game',
                lines: [
                    'Survive waves of enemies and grow stronger through your choices in this action survival game.',
                    'Controls vary by model, but movement is usually with WASD or the arrow keys.',
                    'Press ESC to leave the game screen.',
                ],
            },
            '횡스크롤 액션': {
                title: 'Side-Scrolling Action Game',
                lines: [
                    'Move to the right like Mario and reach the goal in this 2D action game.',
                    'Controls vary by model, but movement is usually with WASD or the arrow keys.',
                    'Press ESC to leave the game screen.',
                ],
            },
        },
    };

    const language = state.language === 'en' ? 'en' : 'ko';
    return guides[language]?.[categoryName] || guides.ko[categoryName] || null;
}

function renderGameGuideCard(categoryName, options = {}) {
    const { concise = false, marginTop = '0', marginBottom = '1.75rem' } = options;
    const guide = getGameGuideContent(categoryName);
    if (!guide) return '';
    const guideLines = concise ? guide.lines.slice(0, 1) : guide.lines;
    const renderGuideLine = (line) => escapeHtml(line).replace(
        /(ESC|WASD|방향키|arrow keys)/g,
        '<span class="game-guide-keyword">$1</span>'
    );

    return `
        <div class="game-guide-card" style="margin:${marginTop} auto ${marginBottom};">
            <div class="game-guide-lines">
                ${guideLines.map((line) => `<div>${renderGuideLine(line)}</div>`).join('')}
            </div>
        </div>
    `;
}

let sidebarGlassRenderer = null;
let sidebarGlassResizeHandler = null;

function createSidebarGlassRenderer(canvas) {
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
    if (!gl) return null;

    const vertexSource = `
        attribute vec2 a_position;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
        }
    `;
    const fragmentSource = `
        precision highp float;
        uniform vec2 u_resolution;
        uniform vec4 u_rect;
        uniform sampler2D u_background;
        uniform float u_opacity;
        uniform float u_time;

        float roundedBox(vec2 p, vec2 b, float r) {
            vec2 q = abs(p) - b + r;
            return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
        }

        float noise(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        vec3 sampleBackground(vec2 uv) {
            return texture2D(u_background, clamp(uv, 0.0, 1.0)).rgb;
        }

        void main() {
            vec2 frag = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
            vec2 center = u_rect.xy + u_rect.zw * 0.5;
            vec2 halfSize = vec2(u_rect.z * 0.5, u_rect.w * 0.5);
            vec2 local = frag - center;
            float radius = u_rect.w * 0.5;
            float d = roundedBox(local, halfSize, radius);

            float inside = 1.0 - smoothstep(-1.0, 1.0, d);
            float rim = 1.0 - smoothstep(0.0, 5.5, abs(d));

            vec2 uv = (local / max(halfSize, vec2(1.0))) * 0.5 + 0.5;
            vec2 normal = local / max(length(local), 1.0);
            float refractionBand = smoothstep(-36.0, -4.0, d)
                * (1.0 - smoothstep(-4.0, 7.5, d));
            float innerRefraction = inside * (1.0 - smoothstep(0.0, 0.78, length((uv - 0.5) * vec2(1.0, 1.66))));
            vec2 wave = vec2(
                sin((uv.y + u_time * 0.08) * 9.0),
                cos((uv.x - u_time * 0.06) * 7.0)
            ) * inside * 0.0016;
            vec2 baseUv = frag / u_resolution;
            vec2 centerUv = center / u_resolution;
            vec2 magnifiedUv = centerUv + (baseUv - centerUv) * (1.0 - inside * 0.19);
            vec2 distortion = normal * refractionBand * 0.188 + normal * innerRefraction * 0.039 + wave;
            vec3 base = sampleBackground(baseUv);
            vec3 refracted;
            refracted.r = sampleBackground(magnifiedUv + distortion * 1.31).r;
            refracted.g = sampleBackground(magnifiedUv + distortion).g;
            refracted.b = sampleBackground(magnifiedUv + distortion * 0.69).b;
            vec3 delta = refracted - base;

            vec2 capsulePoint = local / max(u_rect.zw, vec2(1.0));
            float h1 = 1.0 - smoothstep(0.0, 0.28, distance(capsulePoint, vec2(-0.18, -0.20)));
            float h2 = 1.0 - smoothstep(0.0, 0.24, distance(capsulePoint, vec2(0.28, 0.10)));
            float h3 = 1.0 - smoothstep(0.0, 0.18, distance(capsulePoint, vec2(0.02, -0.04)));
            float highlight = h1 * 0.30 + h2 * 0.18 + h3 * 0.08;
            vec3 lightDir = normalize(vec3(-0.6, -0.8, 0.7));
            float facingLight = clamp(dot(vec3(normal, 0.45), lightDir), 0.0, 1.0);
            float edgeLight = rim * pow(facingLight, 1.8);
            vec3 secondaryDir = normalize(vec3(0.7, 0.55, 0.45));
            float secondaryLight = rim * pow(clamp(dot(vec3(normal, 0.35), secondaryDir), 0.0, 1.0), 2.4);
            float shimmer = (noise(floor((uv + u_time * 0.015) * 42.0)) - 0.5) * inside;

            float refractionMix = clamp(inside * 0.43 + refractionBand * 0.56 + innerRefraction * 0.28, 0.0, 0.89);
            vec3 glass = mix(base, refracted, refractionMix * u_opacity);
            vec3 color = delta * 1.5
                + vec3(1.0) * edgeLight * 0.52
                + vec3(0.72, 0.90, 1.0) * secondaryLight * 0.26
                + vec3(1.0) * highlight * 0.42
                + vec3(0.55, 0.78, 1.0) * rim * 0.10
                + vec3(0.85, 0.96, 1.0) * shimmer * 0.01;

            float effect = inside * 0.062
                + refractionBand * 0.27
                + edgeLight * 0.34
                + secondaryLight * 0.18
                + highlight * 0.36
                + rim * 0.12;
            effect = clamp(effect, 0.0, 0.76) * u_opacity;
            gl_FragColor = vec4(glass + color * effect, 1.0);
        }
    `;

    const compileShader = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.warn(gl.getShaderInfoLog(shader));
            return null;
        }
        return shader;
    };

    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertexShader || !fragmentShader) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn(gl.getProgramInfoLog(program));
        return null;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
    const rectLocation = gl.getUniformLocation(program, 'u_rect');
    const backgroundLocation = gl.getUniformLocation(program, 'u_background');
    const opacityLocation = gl.getUniformLocation(program, 'u_opacity');
    const timeLocation = gl.getUniformLocation(program, 'u_time');
    const backgroundTexture = gl.createTexture();
    const textureCanvas = document.createElement('canvas');
    const textureContext = textureCanvas.getContext('2d');

    const current = { x: 0, y: 0, w: 0, h: 0, opacity: 0 };
    const target = { x: 0, y: 0, w: 0, h: 0, opacity: 0 };
    let frameId = null;

    const uploadBackgroundTexture = (width, height) => {
        if (!textureContext) return;
        textureCanvas.width = width;
        textureCanvas.height = height;

        const gradient = textureContext.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#afd7f6');
        gradient.addColorStop(0.62, '#c7d7f5');
        gradient.addColorStop(1, '#d4d2f0');
        textureContext.fillStyle = gradient;
        textureContext.fillRect(0, 0, width, height);

        const addGlow = (x, y, radius, color) => {
            const glow = textureContext.createRadialGradient(x, y, 0, x, y, radius);
            glow.addColorStop(0, color);
            glow.addColorStop(1, 'rgba(255,255,255,0)');
            textureContext.fillStyle = glow;
            textureContext.fillRect(0, 0, width, height);
        };

        addGlow(width * 0.18, height * 0.18, width * 0.62, 'rgba(255,255,255,0.32)');
        addGlow(width * 0.86, height * 0.30, width * 0.58, 'rgba(145,185,255,0.26)');
        addGlow(width * 0.30, height * 0.74, width * 0.56, 'rgba(210,175,255,0.12)');
        addGlow(width * 0.72, height * 0.88, width * 0.46, 'rgba(100,200,232,0.12)');

        const imageData = textureContext.getImageData(0, 0, width, height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const n = Math.sin((i * 12.9898) % 78.233) * 43758.5453;
            const grain = (n - Math.floor(n) - 0.5) * 4;
            data[i] = Math.max(0, Math.min(255, data[i] + grain));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + grain));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + grain * 1.2));
        }
        textureContext.putImageData(imageData, 0, 0);

        gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureCanvas);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };

    const resize = () => {
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.max(1, Math.round(rect.width * dpr));
        const height = Math.max(1, Math.round(rect.height * dpr));
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
            uploadBackgroundTexture(width, height);
        }
    };

    const draw = (time) => {
        resize();
        const dpr = canvas.width / Math.max(1, canvas.getBoundingClientRect().width);
        current.x += (target.x - current.x) * 0.22;
        current.y += (target.y - current.y) * 0.22;
        current.w += (target.w - current.w) * 0.22;
        current.h += (target.h - current.h) * 0.22;
        current.opacity += (target.opacity - current.opacity) * 0.18;

        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
        gl.uniform4f(rectLocation, current.x * dpr, current.y * dpr, current.w * dpr, current.h * dpr);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
        gl.uniform1i(backgroundLocation, 0);
        gl.uniform1f(opacityLocation, current.opacity);
        gl.uniform1f(timeLocation, time * 0.001);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        const isMoving = Math.abs(current.x - target.x) + Math.abs(current.y - target.y)
            + Math.abs(current.w - target.w) + Math.abs(current.h - target.h)
            + Math.abs(current.opacity - target.opacity) > 0.01;
        frameId = current.opacity > 0.002 || isMoving ? requestAnimationFrame(draw) : null;
    };

    const start = () => {
        if (!frameId) frameId = requestAnimationFrame(draw);
    };

    return {
        setTarget(rect) {
            if (!rect) {
                target.opacity = 0;
                start();
                return;
            }
            target.x = rect.x - 14;
            target.y = rect.y - 8;
            target.w = rect.w + 28;
            target.h = rect.h + 16;
            target.opacity = 1;
            start();
        },
        resize,
    };
}

function updateSidebarGlassTarget(target) {
    sidebarGlassRenderer?.setTarget(null);
}

function hideSidebarGlassTarget() {
    sidebarGlassRenderer?.setTarget(null);
}

function bindSidebarGlassTarget() {
    if (sidebarGlassResizeHandler) {
        window.removeEventListener('resize', sidebarGlassResizeHandler);
        sidebarGlassResizeHandler = null;
    }
    hideSidebarGlassTarget();
}

let headerNavigationEventsBound = false;

function getHeaderProfileBadgeKey() {
    return state.myPageData?.profile_badge_key
        || state.account?.profile?.profile_badge_key
        || state.account?.profile_badge_key
        || 'badge_egg';
}

function getHeaderDisplayName() {
    return state.account?.profile?.display_name || '';
}

function getHeaderAccountLabel() {
    const displayName = getHeaderDisplayName();
    if (!displayName) return t('menu_mypage');
    return state.language === 'ko' ? `${displayName} 님` : `Hi, ${displayName}`;
}

function renderHeaderCategoryGroups({ mobile = false } = {}) {
    const categories = state.categories || [];
    const groups = [
        { key: 'strict', label: t('group_strict_title') },
        { key: 'advanced', label: t('group_advanced_title') },
    ];
    return groups.map((group) => {
        const items = categories
            .filter((category) => category.group === group.key && state.games?.[category.name])
            .map((category) => `
                <button
                    type="button"
                    class="${mobile ? 'header-mobile-category' : 'header-dropdown-item'}${state.selectedCategory === category.name ? ' active' : ''}"
                    onclick='headerSelectCategory(${JSON.stringify(category.name)})'
                >${escapeHtml(getCategoryDisplayName(category.name))}</button>
            `).join('');
        return items ? `
            <div class="${mobile ? 'header-mobile-group' : 'header-dropdown-group'}">
                <div class="${mobile ? 'header-mobile-group-label' : 'header-dropdown-label'}">${group.label}</div>
                ${items}
            </div>
        ` : '';
    }).join('');
}

function renderLanguageMenu({ mobile = false } = {}) {
    const itemClass = mobile ? 'header-mobile-language' : 'header-dropdown-item';
    return `
        <button type="button" class="${itemClass}${state.language === 'ko' ? ' active' : ''}" onclick="headerChangeLanguage('ko')">한국어</button>
        <button type="button" class="${itemClass}${state.language === 'en' ? ' active' : ''}" onclick="headerChangeLanguage('en')">English</button>
    `;
}

function renderGlobalNavigation() {
    const publicRoot = document.getElementById('header-public-nav');
    const accountRoot = document.getElementById('header-auth-actions');
    const mobileRoot = document.getElementById('header-mobile-menu');
    if (!publicRoot || !accountRoot || !mobileRoot) return;

    const isSignedIn = !!state.account?.profile;
    const headerBadgeKey = getHeaderProfileBadgeKey();
    const badgeMarkup = headerBadgeKey ? renderBadgeSvg(headerBadgeKey, 30) : '';
    const accountLabel = escapeHtml(getHeaderAccountLabel());

    publicRoot.innerHTML = `
        <div class="header-menu" data-header-menu="game">
            <button type="button" class="header-nav-button" aria-haspopup="true" aria-expanded="false" onclick="toggleHeaderDropdown('game', event)">
                GAME <span class="header-menu-caret" aria-hidden="true"></span>
            </button>
            <div class="header-dropdown header-game-dropdown" role="menu">
                ${renderHeaderCategoryGroups()}
            </div>
        </div>
        <button type="button" class="header-nav-button" onclick="headerOpenAbout()">ABOUT</button>
    `;

    accountRoot.innerHTML = `
        ${isSignedIn ? `
            <div class="header-menu header-account-menu" data-header-menu="account">
                <button type="button" class="header-account-button" aria-haspopup="true" aria-expanded="false" onclick="toggleHeaderDropdown('account', event)">
                    <span class="header-account-badge">${badgeMarkup}</span>
                    <span class="header-account-name">${accountLabel}</span>
                    <span class="header-menu-caret" aria-hidden="true"></span>
                </button>
                <div class="header-dropdown header-account-dropdown" role="menu">
                    <button type="button" class="header-dropdown-item" onclick="headerOpenMyPage()">${t('menu_mypage')}</button>
                    <button type="button" class="header-dropdown-item header-logout-button" onclick="headerLogout()">${t('menu_logout')}</button>
                </div>
            </div>
        ` : `
            <button type="button" class="header-login-button" onclick="openAuthDialog('login')">${t('menu_login')}</button>
        `}
        <div class="header-menu header-language-menu" data-header-menu="language">
            <button type="button" class="header-language-button" aria-haspopup="true" aria-expanded="false" onclick="toggleHeaderDropdown('language', event)">
                ${t('menu_language')} <span class="header-menu-caret" aria-hidden="true"></span>
            </button>
            <div class="header-dropdown header-language-dropdown" role="menu">
                ${renderLanguageMenu()}
            </div>
        </div>
    `;
    accountRoot.classList.add('active');

    mobileRoot.innerHTML = `
        <div class="header-mobile-account">
            ${isSignedIn ? `
                <div class="header-mobile-profile">
                    <span class="header-account-badge">${badgeMarkup}</span>
                    <strong>${accountLabel}</strong>
                </div>
                <div class="header-mobile-account-actions">
                    <button type="button" onclick="headerOpenMyPage()">${t('menu_mypage')}</button>
                    <button type="button" class="header-logout-button" onclick="headerLogout()">${t('menu_logout')}</button>
                </div>
            ` : `
                <button type="button" class="header-mobile-login" onclick="headerOpenLogin()">${t('menu_login')}</button>
            `}
        </div>
        <div class="header-mobile-section">
            <div class="header-mobile-section-title">GAME</div>
            ${renderHeaderCategoryGroups({ mobile: true })}
        </div>
        <button type="button" class="header-mobile-about" onclick="headerOpenAbout()">ABOUT</button>
        <div class="header-mobile-section header-mobile-language-section">
            <div class="header-mobile-section-title">${t('menu_language')}</div>
            <div class="header-mobile-language-options">${renderLanguageMenu({ mobile: true })}</div>
        </div>
    `;

    bindHeaderNavigationEvents();
    renderFooter();
}

function renderFooter() {
    const supportText = document.getElementById('footer-support-text');
    const supportKr = document.getElementById('footer-support-kr');
    const supportGlobal = document.getElementById('footer-support-global');
    const projectsLabel = document.getElementById('footer-projects-label');
    const termsLink = document.getElementById('footer-terms-link');
    const privacyLink = document.getElementById('footer-privacy-link');
    if (supportText) supportText.textContent = t('footer_support_text');
    if (supportKr) supportKr.textContent = t('support_kr');
    if (supportGlobal) supportGlobal.textContent = t('support_global');
    if (projectsLabel) projectsLabel.textContent = t('footer_other_projects');
    if (termsLink) termsLink.textContent = t('terms_policy_title');
    if (privacyLink) privacyLink.textContent = t('privacy_policy_title');
}

function renderHeaderActions() {
    renderGlobalNavigation();
}

function bindHeaderNavigationEvents() {
    if (headerNavigationEventsBound) return;
    headerNavigationEventsBound = true;
    document.addEventListener('click', (event) => {
        if (!event.target.closest('.header-inner')) closeHeaderMenus();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeHeaderMenus();
    });
}

function toggleHeaderDropdown(menuName, event) {
    event?.stopPropagation();
    const menu = document.querySelector(`[data-header-menu="${menuName}"]`);
    if (!menu) return;
    const shouldOpen = !menu.classList.contains('open');
    closeHeaderMenus();
    if (shouldOpen) {
        menu.classList.add('open');
        menu.querySelector('[aria-expanded]')?.setAttribute('aria-expanded', 'true');
    }
}

function toggleMobileNavigation(event) {
    event?.stopPropagation();
    const trigger = document.getElementById('header-mobile-trigger');
    const menu = document.getElementById('header-mobile-menu');
    if (!trigger || !menu) return;
    const shouldOpen = !menu.classList.contains('open');
    closeHeaderMenus();
    menu.classList.toggle('open', shouldOpen);
    menu.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
    trigger.classList.toggle('open', shouldOpen);
    trigger.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
}

function closeHeaderMenus() {
    document.querySelectorAll('.header-menu.open').forEach((menu) => {
        menu.classList.remove('open');
        menu.querySelector('[aria-expanded]')?.setAttribute('aria-expanded', 'false');
    });
    const trigger = document.getElementById('header-mobile-trigger');
    const mobileMenu = document.getElementById('header-mobile-menu');
    trigger?.classList.remove('open');
    trigger?.setAttribute('aria-expanded', 'false');
    mobileMenu?.classList.remove('open');
    mobileMenu?.setAttribute('aria-hidden', 'true');
}

function headerSelectCategory(category) {
    closeHeaderMenus();
    if (!ensureDisplayNameSetupComplete()) return;
    selectCategory(category);
}

function headerOpenAbout() {
    closeHeaderMenus();
    if (!ensureDisplayNameSetupComplete()) return;
    navigateTo('about', renderAbout);
}

function headerOpenMyPage() {
    closeHeaderMenus();
    if (!ensureDisplayNameSetupComplete()) return;
    openMyPage();
}

function headerOpenLogin() {
    closeHeaderMenus();
    openAuthDialog('login');
}

async function headerLogout() {
    closeHeaderMenus();
    await handleLogout();
}

async function headerChangeLanguage(lang) {
    closeHeaderMenus();
    await changeLanguage(lang);
}

function goToHomeView() {
    if (!ensureDisplayNameSetupComplete()) return;
    navigateTo('home', renderLanding);
}
