async function initApp() {
    await loadLanguageData();
    const savedLanguage = localStorage.getItem('lang');
    if (savedLanguage === 'ko' || savedLanguage === 'en') {
        state.language = savedLanguage;
    } else {
        state.language = detectDefaultLanguage();
    }
    applyDocumentLanguage();
    initializeVeilPlaysAnalytics();

    const initialRoute = getInitialStaticRoute();
    if (initialRoute) {
        navigateTo(initialRoute.id, initialRoute.render);
    } else {
        navigateTo('home', renderLanding);
    }

    const authPromise = initializeFirebaseAuth().catch((e) => {
        console.error("Firebase auth initialization failed", e);
    });
    const gamePromise = refreshGameCatalog({ rerender: true }).catch((e) => {
        console.error("Game data load failed", e);
    });

    await authPromise;

    if (state.authUser) {
        refreshUserEvaluations({ rerender: true }).catch((e) => {
            console.error("User evaluation load failed", e);
        });
    }

    if (state.authMode === 'verify_email') {
        navigateTo('login', renderLogin);
        return;
    }
    if (state.account?.profile && !state.account.profile.display_name_set) {
        state.authMode = 'display_name';
        navigateTo('login', renderLogin);
        return;
    }

    void gamePromise;
}

function getInitialStaticRoute() {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    if (path === '/about') return { id: 'about', render: renderAbout };
    if (path === '/terms') return { id: 'terms', render: renderTermsPolicy };
    if (path === '/privacy') return { id: 'privacy', render: renderPrivacyPolicy };
    return null;
}

function detectDefaultLanguage() {
    const languageCandidates = [navigator.language, ...(navigator.languages || [])]
        .filter(Boolean)
        .map((lang) => String(lang).toLowerCase());
    return languageCandidates.some((lang) => lang === 'ko' || lang.startsWith('ko-')) ? 'ko' : 'en';
}

function applyDocumentLanguage() {
    document.documentElement.lang = state.language === 'ko' ? 'ko' : 'en';
    document.body.classList.toggle('lang-en', state.language === 'en');
    document.body.classList.toggle('lang-ko', state.language !== 'en');
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
    const contentViews = ['home', 'list', 'play', 'about', 'results', 'mypage', 'admin', 'terms', 'privacy'];
    if (viewId !== 'login' && typeof requiresDisplayNameSetup === 'function' && requiresDisplayNameSetup()) {
        state.authMode = 'display_name';
        viewId = 'login';
        renderFunction = renderLogin;
        args = [];
    }

    const onboardingLayer = document.getElementById('onboarding-layer');
    const onboardingSlider = document.getElementById('onboarding-slider');
    const contentLayer = document.getElementById('content-layer');
    const header = document.getElementById('main-header');
    if (typeof closeHeaderMenus === 'function') closeHeaderMenus();
    document.body.classList.toggle('theme-mypage', viewId === 'mypage' || viewId === 'admin');
    document.body.classList.toggle('theme-home', viewId === 'home');
    document.body.classList.toggle('theme-model-list', viewId === 'list');
    document.body.classList.toggle('theme-auth', viewId === 'login');
    document.body.classList.toggle('theme-app', ['play', 'results', 'mypage', 'admin', 'about', 'terms', 'privacy'].includes(viewId));

    state.currentView = { id: viewId, func: renderFunction, args: args };
    renderFunction(...args);
    trackVirtualPageView(viewId);
    if (typeof renderHeaderActions === 'function') {
        renderHeaderActions();
    }

    if (onboardingViews.includes(viewId)) {
        onboardingLayer.classList.remove('hidden');
        contentLayer.classList.add('hidden');
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
        
        animateOrApply(header, null, { y: 0, duration: 0.5 });

        contentLayer.scrollTop = 0;

        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        
        // About은 view-list 섹션이나 별도 섹션에서 렌더링 가능
        const targetSection = document.getElementById(`view-${viewId}`) || document.getElementById('view-list');
        targetSection.classList.add('active');

        animateOrApply(contentLayer, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6 });
        
        renderGlobalNavigation();
    }
}
// 언어 변경 함수: 현재 뷰 유지
async function changeLanguage(lang) {
    if (lang !== 'ko' && lang !== 'en') return;
    state.language = lang;
    localStorage.setItem('lang', lang);
    trackAnalyticsEvent('language_change', { language: lang });
    applyDocumentLanguage();
    await refreshGameCatalog({ rerender: false }); // 언어 변경 시 해당 언어의 게임 목록으로 업데이트
    if (state.currentView) {
        state.currentView.func(...state.currentView.args);
    }
    if (typeof renderHeaderActions === 'function') {
        renderHeaderActions();
    }
    renderGlobalNavigation();
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
