// Archive Mode Manager & Demo Features
const ARCHIVE_DEMO_LOGIN_KEY = "veilplays_archive_demo_logged_in";
const ARCHIVE_NOTICE_SEEN_KEY = "veilplays_archive_notice_seen";

function isDemoLoggedIn() {
  return sessionStorage.getItem(ARCHIVE_DEMO_LOGIN_KEY) === "true";
}

async function initArchiveMode() {
  state.isArchiveMode = true;

  // Check if demo user was logged in previously in this session
  if (isDemoLoggedIn()) {
    await restoreDemoLoginSession();
  }

  // Check first visit in session to show archive notice modal
  if (!sessionStorage.getItem(ARCHIVE_NOTICE_SEEN_KEY)) {
    // Small delay to ensure initial render completes smoothly
    setTimeout(() => {
      showArchiveNoticeModal();
    }, 200);
  }
}

async function restoreDemoLoginSession() {
  try {
    const primaryUrl = "/static/archive/demo-account.json";
    const fallbackUrl = "/archive/demo-account.json";
    let res = await fetch(primaryUrl).catch(() => null);
    if (!res || !res.ok) {
      res = await fetch(fallbackUrl);
    }
    if (res.ok) {
      const demoAccount = await res.json();
      state.authUser = {
        uid: demoAccount.user_id,
        email: demoAccount.email,
        displayName: demoAccount.display_name,
      };
      state.account = demoAccount;
      state.authReady = true;
      state.authConfigured = true;
      await apiFetchUserEvals();
      await apiFetchMyPage();
    }
  } catch (e) {
    console.warn("Failed to restore demo session", e);
  }
}

async function handleDemoLogin() {
  try {
    const primaryUrl = "/static/archive/demo-account.json";
    const fallbackUrl = "/archive/demo-account.json";
    let res = await fetch(primaryUrl).catch(() => null);
    if (!res || !res.ok) {
      res = await fetch(fallbackUrl);
    }
    if (!res.ok) {
      throw new Error("Failed to load demo account");
    }

    const demoAccount = await res.json();
    state.authUser = {
      uid: demoAccount.user_id,
      email: demoAccount.email,
      displayName: demoAccount.display_name,
    };
    state.account = demoAccount;
    state.authReady = true;
    state.authConfigured = true;

    sessionStorage.setItem(ARCHIVE_DEMO_LOGIN_KEY, "true");

    await apiFetchUserEvals();
    await apiFetchMyPage();

    if (typeof renderHeaderActions === "function") {
      renderHeaderActions();
    }
    if (typeof rerenderPostAuthDataViews === "function") {
      rerenderPostAuthDataViews();
    }

    // Close auth dialog if open
    if (typeof closeAuthDialog === "function") {
      closeAuthDialog();
    }

    // If on login view, go to list or home
    if (state.currentView?.id === "login") {
      navigateTo("list", renderGameList);
    }
  } catch (e) {
    console.error("Demo login failed", e);
    alert(
      state.language === "ko"
        ? "데모 로그인 처리 중 오류가 발생했습니다."
        : "Failed to process demo login.",
    );
  }
}

function handleDemoLogout() {
  state.authUser = null;
  state.account = null;
  state.userEvals = [];
  state.myPageData = null;

  sessionStorage.removeItem(ARCHIVE_DEMO_LOGIN_KEY);

  if (typeof renderHeaderActions === "function") {
    renderHeaderActions();
  }
  if (typeof rerenderPostAuthDataViews === "function") {
    rerenderPostAuthDataViews();
  }

  if (state.currentView?.id === "mypage" || state.currentView?.id === "admin") {
    navigateTo("home", renderLanding);
  }
}

function showArchiveNoticeModal() {
  const root = document.getElementById("global-modal-root");
  if (!root) return;

  const isKo = (state.language || "ko") === "ko";

  const title = isKo
    ? "VeilPlays 아카이브 모드 안내"
    : "VeilPlays Archive Mode Notice";

  const body1 = isKo
    ? "VeilPlays는 현재 정식 서비스 운영을 종료하고 <strong>프로젝트 포트폴리오 및 아카이브 체험용</strong>으로 제공됩니다."
    : "VeilPlays has concluded live operations and is now available as a <strong>project portfolio & interactive archive</strong>.";

  const body2 = isKo
    ? "6개 장르 90종 AI 생성 게임 플레이와 벤치마크 랭킹 결과를 자유롭게 둘러보실 수 있습니다. 로그인·평가·마이페이지는 <strong>데모 데이터(서버 통신 0건)</strong>로 원활히 동작합니다."
    : "You can explore 90 AI-generated games across 6 genres and benchmark rankings. Login, evaluations, and MyPage run seamlessly in <strong>demo mode with 0 server requests</strong>.";

  const featureTitle = isKo ? "주요 둘러보기 기능" : "Key Archive Features";
  const feat1 = isKo
    ? "🎮 6개 장르 대표 게임 실시간 플레이 (404 없음)"
    : "🎮 Real-time play for 6 game genres (Zero 404s)";
  const feat2 = isKo
    ? "📊 장르별 AI 모델 벤치마크 랭킹 및 비교 결과"
    : "📊 AI model benchmark rankings & evaluation metrics";
  const feat3 = isKo
    ? "👤 원클릭 데모 로그인 및 마이페이지 대시보드"
    : "👤 1-Click Demo Login & MyPage dashboard experience";
  const feat4 = isKo
    ? "⚡ 프론트엔드 완전 정적화 (0 Server Cost / 0 Network Call)"
    : "⚡ 100% Static Frontend (0 Server Cost / 0 Network Call)";

  const btnExplore = isKo ? "포트폴리오 둘러보기" : "Explore Portfolio";
  const btnDemoLogin = isKo ? "데모 로그인으로 체험" : "Try Demo Login";

  root.innerHTML = `
        <div class="archive-modal-backdrop" onclick="closeArchiveNoticeModal()">
            <div class="archive-modal-card" onclick="event.stopPropagation()">
                <div class="archive-modal-header">
                    <span class="archive-badge-pill">ARCHIVE MODE</span>
                    <h3 class="archive-modal-title">${title}</h3>
                </div>
                <div class="archive-modal-body">
                    <p>${body1}</p>
                    <p>${body2}</p>
                    <div class="archive-features-box">
                        <div class="archive-features-title">${featureTitle}</div>
                        <ul class="archive-features-list">
                            <li>${feat1}</li>
                            <li>${feat2}</li>
                            <li>${feat3}</li>
                            <li>${feat4}</li>
                        </ul>
                    </div>
                </div>
                <div class="archive-modal-actions">
                    <button type="button" class="secondary" onclick="closeArchiveNoticeModal()">${btnExplore}</button>
                    <button type="button" class="primary" onclick="handleArchiveDemoLoginAndClose()">${btnDemoLogin}</button>
                </div>
            </div>
        </div>
    `;
}

function closeArchiveNoticeModal() {
  sessionStorage.setItem(ARCHIVE_NOTICE_SEEN_KEY, "true");
  const root = document.getElementById("global-modal-root");
  if (root) {
    root.innerHTML = "";
  }
}

async function handleArchiveDemoLoginAndClose() {
  closeArchiveNoticeModal();
  await handleDemoLogin();
}
