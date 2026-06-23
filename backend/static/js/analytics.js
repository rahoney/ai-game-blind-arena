let veilPlaysAnalyticsReady = false;

function initializeVeilPlaysAnalytics() {
    const measurementId = String(RUNTIME_CONFIG.gaMeasurementId || '').trim();
    if (!/^G-[A-Z0-9]+$/i.test(measurementId)) return;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() {
        window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
        send_page_view: false,
        anonymize_ip: true,
    });

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(script);
    veilPlaysAnalyticsReady = true;
}

function getAnalyticsCategorySlug() {
    const category = state.selectedCategory || '';
    const slugByCategory = {
        '던전 탐색': 'dungeon',
        '강화된 벽돌깨기': 'brick-breaker',
        '카드배틀': 'card-battle',
        '1인칭 미니 FPS': 'fps',
        '서바이벌 디펜스': 'survival-defense',
        '횡스크롤 액션': 'side-scroll',
    };
    return slugByCategory[category] || 'unknown';
}

function getAnalyticsPath(viewId) {
    const categorySlug = getAnalyticsCategorySlug();
    const blindId = String(state.selectedGame?.blind_id || '').toLowerCase();
    const paths = {
        home: '/',
        login: '/login',
        about: '/about',
        mypage: '/mypage',
        privacy: '/privacy',
        list: `/games/${categorySlug}`,
        play: `/play/${categorySlug}/${blindId || 'unknown'}`,
        results: `/results/${categorySlug}`,
    };
    return paths[viewId] || '/';
}

function trackVirtualPageView(viewId) {
    if (!veilPlaysAnalyticsReady || typeof window.gtag !== 'function') return;
    const pagePath = getAnalyticsPath(viewId);
    window.gtag('event', 'page_view', {
        page_title: document.title,
        page_location: `${FRONTEND_ORIGIN}${pagePath}`,
        page_path: pagePath,
        language: state.language || 'ko',
    });
}

function trackAnalyticsEvent(eventName, params = {}) {
    if (!veilPlaysAnalyticsReady || typeof window.gtag !== 'function') return;
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(eventName)) return;
    window.gtag('event', eventName, params);
}
