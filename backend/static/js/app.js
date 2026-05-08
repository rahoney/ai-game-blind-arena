async function initApp() {
    await loadLanguageData();
    const savedLanguage = localStorage.getItem('lang');
    if (savedLanguage === 'ko' || savedLanguage === 'en') {
        state.language = savedLanguage;
    } else {
        state.language = detectDefaultLanguage();
    }
    applyDocumentLanguage();
    try { await apiFetchGames(); } catch (e) { console.error("Game data load failed", e); }
    navigateTo('category', renderCategorySelection);
}

function detectDefaultLanguage() {
    const languageCandidates = [navigator.language, ...(navigator.languages || [])]
        .filter(Boolean)
        .map((lang) => String(lang).toLowerCase());
    return languageCandidates.some((lang) => lang === 'ko' || lang.startsWith('ko-')) ? 'ko' : 'en';
}

function applyDocumentLanguage() {
    document.documentElement.lang = state.language === 'ko' ? 'ko' : 'en';
}

function animateOrApply(target, fromVars, toVars) {
    const element = typeof target === 'string' ? document.querySelector(target) : target;
    if (!element) return;

    if (typeof gsap !== 'undefined') {
        if (fromVars && toVars && typeof target !== 'string') {
            gsap.fromTo(element, fromVars, toVars);
        } else if (toVars && typeof target !== 'string') {
            gsap.to(element, toVars);
        } else if (toVars) {
            applyAnimationVars(element, toVars);
        }
        return;
    }

    if (fromVars) applyAnimationVars(element, fromVars);
    if (toVars) applyAnimationVars(element, toVars);
}

function applyAnimationVars(element, vars) {
    if (typeof vars.opacity !== 'undefined') element.style.opacity = String(vars.opacity);
    if (typeof vars.y !== 'undefined') element.style.transform = `translateY(${vars.y}px)`;
}

function navigateTo(viewId, renderFunction, ...args) {
    const onboardingViews = ['login'];
    const contentViews = ['category', 'list', 'play', 'about', 'results', 'mypage', 'privacy'];

    const onboardingLayer = document.getElementById('onboarding-layer');
    const onboardingSlider = document.getElementById('onboarding-slider');
    const contentLayer = document.getElementById('content-layer');
    const hamburger = document.getElementById('hamburger');
    const header = document.getElementById('main-header');
    document.body.classList.toggle('theme-mypage', viewId === 'mypage');

    state.currentView = { id: viewId, func: renderFunction, args: args };
    renderFunction(...args);

    if (onboardingViews.includes(viewId)) {
        onboardingLayer.classList.remove('hidden');
        contentLayer.classList.add('hidden');
        hamburger.classList.add('hidden');
        animateOrApply(header, null, { y: 0, duration: 0.5 });
        const nextIndex = onboardingViews.indexOf(viewId);
        const slideHeight = onboardingLayer ? onboardingLayer.clientHeight : 0;
        const nextY = -(nextIndex * slideHeight);
        if (typeof gsap !== 'undefined') {
            gsap.killTweensOf(onboardingSlider);
            gsap.to(onboardingSlider, {
                y: nextY,
                duration: 1.0,
                ease: 'power3.inOut',
            });
        } else if (onboardingSlider) {
            onboardingSlider.style.transition = 'transform 1s cubic-bezier(0.22, 1, 0.36, 1)';
            onboardingSlider.style.transform = `translate3d(0, ${nextY}px, 0)`;
        }
    } else if (contentViews.includes(viewId)) {
        onboardingLayer.classList.add('hidden');
        contentLayer.classList.remove('hidden');
        hamburger.classList.remove('hidden');
        
        animateOrApply(header, null, { y: 0, duration: 0.5 });

        contentLayer.scrollTop = 0;

        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        
        // About은 view-list 섹션이나 별도 섹션에서 렌더링 가능
        const targetSection = document.getElementById(`view-${viewId}`) || document.getElementById('view-list');
        targetSection.classList.add('active');

        animateOrApply(contentLayer, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6 });
        
        renderSidebar();
    }
}
// 언어 변경 함수: 현재 뷰 유지
async function changeLanguage(lang) {
    if (lang !== 'ko' && lang !== 'en') return;
    state.language = lang;
    localStorage.setItem('lang', lang);
    applyDocumentLanguage();
    await apiFetchGames(); // 언어 변경 시 해당 언어의 게임 목록으로 업데이트
    if (state.currentView) {
        state.currentView.func(...state.currentView.args);
    }
    renderSidebar();
}

window.addEventListener('resize', () => {
    const onboardingViews = ['login'];
    const currentIndex = onboardingViews.indexOf(state.currentView?.id || '');
    if (currentIndex === -1) return;
    const onboardingLayer = document.getElementById('onboarding-layer');
    const onboardingSlider = document.getElementById('onboarding-slider');
    if (!onboardingLayer || !onboardingSlider) return;
    const nextY = -(currentIndex * onboardingLayer.clientHeight);
    onboardingSlider.style.transform = `translate3d(0, ${nextY}px, 0)`;
});

initApp();
