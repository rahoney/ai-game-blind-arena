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

    return `
        <div style="background:var(--surface-bg); border:1px solid var(--border-color); border-radius:18px; padding:1.35rem 1.5rem; margin:${marginTop} auto ${marginBottom}; box-shadow:0 10px 24px rgba(0,0,0,0.16); max-width:1100px; text-align:center;">
            <div style="display:grid; gap:0.55rem; color:var(--text-color); line-height:1.7; font-size:1.12rem; font-weight:700;">
                ${guideLines.map((line) => `<div>${escapeHtml(line)}</div>`).join('')}
            </div>
        </div>
    `;
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const willOpen = !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', willOpen);
    overlay.classList.toggle('open', willOpen);
    document.body.classList.toggle('sidebar-open', willOpen);
    document.documentElement.classList.toggle('sidebar-open', willOpen);
    if (willOpen) {
        requestAnimationFrame(updateSidebarGlassTarget);
    }
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
        uniform float u_opacity;
        uniform float u_time;

        float roundedBox(vec2 p, vec2 b, float r) {
            vec2 q = abs(p) - b + r;
            return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
        }

        float noise(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        vec3 sidebarBackground(vec2 uv) {
            uv = clamp(uv, 0.0, 1.0);
            vec3 top = vec3(0.662, 0.827, 0.984);
            vec3 bottom = vec3(0.773, 0.816, 0.980);
            vec3 color = mix(top, bottom, uv.y);
            float glow1 = 1.0 - smoothstep(0.0, 0.55, distance(uv, vec2(0.24, 0.18)));
            float glow2 = 1.0 - smoothstep(0.0, 0.48, distance(uv, vec2(0.82, 0.56)));
            float glow3 = 1.0 - smoothstep(0.0, 0.42, distance(uv, vec2(0.28, 0.86)));
            float diagonal = 0.5 + 0.5 * sin((uv.x + uv.y) * 22.0);
            float fine = 0.5 + 0.5 * sin((uv.x * 29.0 + uv.y * 43.0));
            float softLine = 0.5 + 0.5 * sin((uv.x * 2.4 - uv.y * 3.2) * 13.0);
            color += glow1 * vec3(0.080, 0.120, 0.180);
            color += glow2 * vec3(0.030, 0.080, 0.160);
            color += glow3 * vec3(0.090, 0.060, 0.160);
            color += diagonal * vec3(1.0) * 0.010;
            color += fine * vec3(0.008, 0.009, 0.013);
            color += softLine * vec3(0.030, 0.040, 0.060) * 0.035;
            return color;
        }

        void main() {
            vec2 frag = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
            vec2 center = u_rect.xy + u_rect.zw * 0.5;
            vec2 halfSize = vec2(u_rect.z * 0.5, u_rect.w * 0.5);
            vec2 local = frag - center;
            float radius = u_rect.w * 0.5;
            float d = roundedBox(local, halfSize, radius);

            float inside = 1.0 - smoothstep(-1.0, 1.0, d);
            float rim = 1.0 - smoothstep(0.0, 5.0, abs(d));

            vec2 uv = (local / max(halfSize, vec2(1.0))) * 0.5 + 0.5;
            vec2 normal = local / max(length(local), 1.0);
            float refractionBand = smoothstep(-34.0, -4.0, d)
                * (1.0 - smoothstep(-4.0, 7.0, d));
            float innerRefraction = inside * (1.0 - smoothstep(0.0, 0.74, length((uv - 0.5) * vec2(1.0, 1.7))));
            vec2 wave = vec2(
                sin((uv.y + u_time * 0.08) * 9.0),
                cos((uv.x - u_time * 0.06) * 7.0)
            ) * inside * 0.0012;
            vec2 baseUv = frag / u_resolution;
            vec2 distortion = normal * refractionBand * 0.064 + normal * innerRefraction * 0.010 + wave;
            vec3 base = sidebarBackground(baseUv);
            vec3 refracted;
            refracted.r = sidebarBackground(baseUv + distortion * 1.18).r;
            refracted.g = sidebarBackground(baseUv + distortion).g;
            refracted.b = sidebarBackground(baseUv + distortion * 0.84).b;
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

            float refractionMix = clamp(refractionBand * 0.78 + innerRefraction * 0.18, 0.0, 0.82);
            vec3 glass = mix(base, refracted, refractionMix);
            vec3 color = (glass - base) * 1.35
                + delta * 3.0
                + vec3(1.0) * edgeLight * 0.48
                + vec3(0.72, 0.90, 1.0) * secondaryLight * 0.26
                + vec3(1.0) * highlight * 0.42
                + vec3(0.55, 0.78, 1.0) * rim * 0.080
                + vec3(0.85, 0.96, 1.0) * shimmer * 0.01;

            float effect = inside * 0.055
                + refractionBand * 0.24
                + edgeLight * 0.34
                + secondaryLight * 0.18
                + highlight * 0.36
                + rim * 0.12;
            effect = clamp(effect, 0.0, 0.76) * u_opacity;
            gl_FragColor = vec4(base + color * effect, 1.0);
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
    const opacityLocation = gl.getUniformLocation(program, 'u_opacity');
    const timeLocation = gl.getUniformLocation(program, 'u_time');

    const current = { x: 0, y: 0, w: 0, h: 0, opacity: 0 };
    const target = { x: 0, y: 0, w: 0, h: 0, opacity: 0 };
    let frameId = null;

    const resize = () => {
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.max(1, Math.round(rect.width * dpr));
        const height = Math.max(1, Math.round(rect.height * dpr));
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
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
    const sidebar = document.getElementById('sidebar');
    const canvas = document.querySelector('#sidebar .sidebar-glass-canvas');
    const visibleTarget = target || document.querySelector('#sidebar .sidebar-menu-item.active');

    if (!sidebar || !canvas || !visibleTarget) {
        sidebarGlassRenderer?.setTarget(null);
        return;
    }

    if (!sidebarGlassRenderer) {
        sidebarGlassRenderer = createSidebarGlassRenderer(canvas);
    }

    const sidebarRect = sidebar.getBoundingClientRect();
    const label = visibleTarget.querySelector('span') || visibleTarget;
    const targetRect = label.getBoundingClientRect();
    const paddingX = 14;
    const paddingY = 8;
    sidebarGlassRenderer?.setTarget({
        x: targetRect.left - sidebarRect.left - paddingX,
        y: targetRect.top - sidebarRect.top - paddingY,
        w: targetRect.width + paddingX * 2,
        h: targetRect.height + paddingY * 2,
    });
}

function hideSidebarGlassTarget() {
    sidebarGlassRenderer?.setTarget(null);
}

function bindSidebarGlassTarget() {
    const sidebar = document.getElementById('sidebar');
    const sidebarBody = sidebar?.querySelector('.sidebar-body');
    if (!sidebar || !sidebarBody) return;

    const targets = sidebar.querySelectorAll('.sidebar-menu-item, .sidebar-about-button, .sidebar-language-switch button');
    targets.forEach((target) => {
        target.addEventListener('mouseenter', () => updateSidebarGlassTarget(target));
        target.addEventListener('focus', () => updateSidebarGlassTarget(target));
    });

    sidebarBody.addEventListener('mouseleave', () => {
        const activeTarget = sidebar.querySelector('.sidebar-menu-item.active, .sidebar-language-switch button.active');
        if (activeTarget) {
            updateSidebarGlassTarget(activeTarget);
        } else {
            hideSidebarGlassTarget();
        }
    });
    sidebar.addEventListener('scroll', () => updateSidebarGlassTarget());
    if (sidebarGlassResizeHandler) {
        window.removeEventListener('resize', sidebarGlassResizeHandler);
    }
    sidebarGlassResizeHandler = () => {
        sidebarGlassRenderer?.resize();
        updateSidebarGlassTarget();
    };
    window.addEventListener('resize', sidebarGlassResizeHandler);
}

function renderSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar || !state.games) return;

    const strictCategories = state.categories.filter(category => category.group === 'strict');
    const advancedCategories = state.categories.filter(category => category.group === 'advanced');

    const getCategoryLabel = (category) => getCategoryDisplayName(category.name);
    const getMenuItem = (category) => {
        if (!state.games[category.name]) return '';
        const activeClass = state.selectedCategory === category.name ? 'active' : '';
        return `<li class="sidebar-menu-item ${activeClass}" 
                    onclick="sidebarSelectCategory('${category.name}')">
            <span><strong>${getCategoryLabel(category)}</strong></span>
        </li>`;
    };

    sidebar.innerHTML = `
        <canvas class="sidebar-glass-canvas" aria-hidden="true"></canvas>
        <div class="sidebar-body">
            <div class="sidebar-main">
                <h2 class="sidebar-title">${t('menu_title')}</h2>
                <div class="sidebar-group-label">
                    ${t('group_strict_title')}
                </div>
                <ul class="sidebar-menu-list">
                    ${strictCategories.map(getMenuItem).join('')}
                </ul>

                <div class="sidebar-group-label">
                    ${t('group_advanced_title')}
                </div>
                <ul class="sidebar-menu-list">
                    ${advancedCategories.map(getMenuItem).join('')}
                </ul>

                <button type="button" class="sidebar-about-button" onclick="sidebarSelectAbout()"><span>About</span></button>
            </div>

            <div class="sidebar-footer">
                <div class="sidebar-language-block">
                    <div class="sidebar-language-switch" role="group" aria-label="${t('menu_language')}">
                        <button type="button" class="${state.language === 'ko' ? 'active' : ''}" onclick="sidebarChangeLanguage('ko')"><span>한국어</span></button>
                        <button type="button" class="${state.language === 'en' ? 'active' : ''}" onclick="sidebarChangeLanguage('en')"><span>English</span></button>
                    </div>
                </div>
                <ul style="list-style: none;">
                    ${state.nickname ? `<li onclick="sidebarSelectMyPage()" style="padding: 12px 15px; text-align: center; cursor: pointer; border-radius: 6px; margin-bottom: 8px;">
                        <strong>${t('menu_mypage')}</strong>
                    </li>
                    <li onclick="sidebarLogout()" style="padding: 12px 15px; text-align: center; cursor: pointer; border-radius: 6px; color: #fca5a5;">
                        <strong>${t('menu_logout')}</strong>
                    </li>` : ''}
                </ul>
            </div>
        </div>
    `;
    sidebarGlassRenderer = null;
    bindSidebarGlassTarget();
    requestAnimationFrame(updateSidebarGlassTarget);
}

function sidebarSelectCategory(category) { toggleSidebar(); selectCategory(category); }
function sidebarSelectAbout() { toggleSidebar(); navigateTo('about', renderAbout); }
function sidebarSelectMyPage() { toggleSidebar(); openMyPage(); }
function sidebarLogout() { toggleSidebar(); handleLogout(); }
async function sidebarChangeLanguage(lang) {
    await changeLanguage(lang);
}
