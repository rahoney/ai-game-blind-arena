function getPrivacyPolicyContent() {
    if (state.language === 'en') {
        return {
            title: 'Privacy Policy',
            effectiveDate: 'Effective date: April 17, 2026',
            intro: 'VeilPlays provides an account-based AI game evaluation service. This page explains what data may be processed, why it may be processed, how long it may be retained, what third-party services may be involved, and what disclosures apply if Google AdSense is enabled.',
            sections: [
                {
                    heading: '1. Service Operator',
                    body: [
                        'Service name: VeilPlays',
                        'Operator: WikiHoney',
                        'Main purpose: comparing and evaluating AI-generated games from a single prompt through the AI Game Blind Arena experiment',
                    ],
                },
                {
                    heading: '2. Data We Process',
                    body: [
                        'Account profile information such as login ID, email, display name, and linked provider state',
                        'Evaluation records such as category, blind model ID, score values, and submitted comment text',
                        'Comment interaction data such as likes, dislikes, replies, and moderation state',
                        'View history used for My Page statistics, badge conditions, and gameplay entry history',
                        'Local browser storage data such as selected language and badge-notification seen state',
                        'Technical information that may be generated during service use, such as IP address, browser and device environment, access time, referrer, cookies, local storage values, pixels, or web beacon-related information where applicable',
                        'If the contact form is used, the user may voluntarily submit additional information through Google Forms',
                    ],
                },
                {
                    heading: '3. Why We Use This Data',
                    body: [
                        'To provide account login, recovery, and service continuity',
                        'To store evaluations, comments, replies, and reactions',
                        'To calculate rankings, statistics, My Page summaries, and badge unlock conditions',
                        'To prevent abuse such as spam, repeated submissions, or policy violations',
                        'To respond to inquiries submitted through the Contact Us page and to improve service operations',
                    ],
                },
                {
                    heading: '4. Storage and Retention',
                    body: [
                        'Core service data is stored in Supabase-backed service storage.',
                        'Browser-side settings such as language preference and seen badge alerts may be stored in localStorage on the user device.',
                        'Account profile data, display names, evaluations, comments, replies, reactions, and view history may be retained while the service is operated unless deletion, moderation, legal retention, or policy changes require otherwise.',
                        'If a user deletes their account, account identity fields are anonymized or removed. Existing evaluations, comments, replies, reactions, and related service records may remain with deleted-user display wording so the public evaluation dataset is preserved.',
                    ],
                },
                {
                    heading: '5. Third-Party Services',
                    body: [
                        'Supabase may be used for database storage and backend data handling.',
                        'Google Forms may be used for the inquiry page and user-submitted contact messages.',
                        'Google AdSense may be introduced later. If enabled, Google and its partners may collect, receive, or process data for ad serving, measurement, fraud prevention, frequency capping, reporting, or personalization according to their own policies.',
                        'When third-party advertising is active, third parties may read or write cookies in the browser, use web beacons, and receive technical information such as IP address and browser identifiers in connection with ad requests and ad measurement.',
                    ],
                },
                {
                    heading: '6. Cookies, Local Storage, Web Beacons, and Ads',
                    body: [
                        'The service currently uses browser localStorage for language preference and some UI state.',
                        'If Google AdSense is enabled, Google and its partners may use cookies, local storage, pixels, web beacons, SDK-like identifiers, or similar technologies for ad delivery, frequency capping, measurement, fraud detection, and personalized or non-personalized advertising where applicable.',
                        'In connection with those technologies, technical data such as IP address, browser type, device information, page access records, and interaction signals may be collected or processed.',
                        'Users may review or manage ad personalization through Google Ad Settings: https://adssettings.google.com/',
                        'Users may also review how Google uses information from sites or apps that use its services: https://policies.google.com/technologies/partner-sites',
                    ],
                },
                {
                    heading: '7. User Rights and Requests',
                    body: [
                        'Users may request information about stored personal data to the extent reasonably possible for this service structure.',
                        'Users may delete their account from My Page. Account identity information is removed or anonymized, while already posted evaluations and comments may remain as deleted-user content.',
                        'Users may request review of moderation or removal needs for posted content through the Contact Us page linked from the About screen.',
                        'Some requests may be limited where ownership cannot be reliably verified from account records.',
                    ],
                },
                {
                    heading: '8. Policy Updates',
                    body: [
                        'This policy may be updated when service features, storage structure, advertising, or legal requirements change.',
                        'When material changes are made, the updated text and effective date will be reflected on this page.',
                    ],
                },
            ],
            notice: 'If Google AdSense is actually enabled later, this policy should be reviewed again and updated to match the live ad implementation, actual cookie and web beacon usage, and any legally required regional disclosures or consent requirements.',
        };
    }

    return {
        title: '개인정보처리방침',
        effectiveDate: '시행일: 2026년 4월 17일',
        intro: 'VeilPlays는 계정 기반의 AI 게임 평가 서비스를 제공합니다. 본 페이지는 어떤 정보가 처리될 수 있는지, 왜 처리되는지, 얼마나 보관될 수 있는지, 어떤 제3자 서비스가 관여할 수 있는지, 그리고 향후 Google AdSense가 도입될 경우 어떤 고지가 적용되는지를 설명합니다.',
        sections: [
            {
                heading: '1. 서비스 운영자',
                body: [
                    '서비스명: VeilPlays',
                    '운영자: WikiHoney',
                    '주요 목적: AI Game Blind Arena 실험을 통한 단일 프롬프트 기반 AI 생성 게임의 비교 및 평가',
                ],
            },
            {
                heading: '2. 처리하는 정보 항목',
                body: [
                    '로그인 아이디, 이메일, 표시 닉네임, 연결된 로그인 제공자 등 계정 프로필 정보',
                    '카테고리, 블라인드 모델 ID, 점수값, 코멘트 텍스트 등 평가 기록',
                    '좋아요, 싫어요, 댓글, 블라인드 상태 등 코멘트 상호작용 데이터',
                    '마이페이지 통계, 배지 조건 계산, 게임 진입 이력에 사용되는 조회 기록',
                    '선택 언어, 배지 알림 확인 상태 등 브라우저 로컬 스토리지 정보',
                    '서비스 이용 과정에서 생성될 수 있는 IP 주소, 브라우저 및 기기 환경, 접속 시각, 유입 정보, 쿠키, 로컬 스토리지 값, 픽셀 또는 웹 비콘 관련 정보 등 기술적 정보',
                    '문의하기를 사용할 경우 Google Forms를 통해 사용자가 자발적으로 입력한 추가 정보',
                ],
            },
            {
                heading: '3. 정보 이용 목적',
                body: [
                    '계정 로그인, 복구, 서비스 이용 연속성을 제공하기 위해',
                    '평가, 코멘트, 댓글, 반응 기록을 저장하고 보여주기 위해',
                    '랭킹, 통계, 마이페이지 요약, 배지 획득 조건을 계산하기 위해',
                    '스팸, 반복 입력, 정책 위반 등 서비스 오남용을 방지하기 위해',
                    '문의하기 페이지를 통해 접수된 문의에 응답하고 서비스 운영을 개선하기 위해',
                ],
            },
            {
                heading: '4. 저장 위치 및 보관',
                body: [
                    '핵심 서비스 데이터는 Supabase 기반 저장소에 보관될 수 있습니다.',
                    '언어 설정, 배지 알림 확인 상태 등 일부 브라우저 설정은 사용자 기기의 localStorage에 저장될 수 있습니다.',
                    '닉네임, 평가, 코멘트, 댓글, 반응, 조회 기록은 서비스 운영 중 보관될 수 있으며, 운영 정책 변경, 블라인드 처리, 삭제 검토, 법령상 보관 사유가 있는 경우를 제외하고 별도 종료 시점까지 유지될 수 있습니다.',
                    '회원 탈퇴 시 계정 식별 정보는 삭제 또는 익명화됩니다. 이미 등록된 평가, 코멘트, 댓글, 반응 및 관련 서비스 기록은 공개 평가 데이터 보존을 위해 탈퇴한 사용자 표시로 남을 수 있습니다.',
                ],
            },
            {
                heading: '5. 제3자 서비스 이용',
                body: [
                    '데이터 저장 및 백엔드 처리를 위해 Supabase를 사용할 수 있습니다.',
                    '문의 페이지 운영을 위해 Google Forms를 사용할 수 있습니다.',
                    '향후 Google AdSense가 도입될 수 있으며, 실제 도입 시 Google 및 파트너사는 광고 제공, 성과 측정, 사기 방지, 노출 빈도 제한, 개인화 등의 목적으로 데이터를 수집하거나 처리할 수 있습니다.',
                    '제3자 광고가 활성화되면 광고 요청 및 측정 과정에서 제3자가 브라우저의 쿠키를 읽거나 저장하고, 웹 비콘을 사용하며, IP 주소나 브라우저 식별자 같은 기술적 정보를 전달받을 수 있습니다.',
                ],
            },
            {
                heading: '6. 쿠키, 로컬 스토리지, 웹 비콘 및 광고',
                body: [
                    '현재 서비스는 언어 설정과 일부 UI 상태 저장을 위해 브라우저 localStorage를 사용할 수 있습니다.',
                    'Google AdSense가 활성화되면 Google 및 파트너사는 광고 제공, 빈도 제한, 성과 측정, 사기 방지, 맞춤형 또는 비맞춤형 광고 제공 등을 위해 쿠키, 로컬 스토리지, 픽셀, 웹 비콘 또는 유사 기술을 사용할 수 있습니다.',
                    '이 과정에서 IP 주소, 브라우저 종류, 기기 정보, 페이지 접근 기록, 상호작용 신호 등 기술적 정보가 수집되거나 처리될 수 있습니다.',
                    '광고 기능이 활성화된 경우 사용자는 Google 광고 설정 페이지(https://adssettings.google.com/)를 통해 맞춤형 광고 관련 설정을 확인하거나 관리할 수 있습니다.',
                    '또한 Google 서비스가 사이트 및 앱에서 정보를 처리하는 방식은 https://policies.google.com/technologies/partner-sites 에서 확인할 수 있습니다.',
                ],
            },
            {
                heading: '7. 이용자 권리 및 요청',
                body: [
                    '서비스 구조상 가능한 범위 내에서 저장 정보에 대한 문의를 요청할 수 있습니다.',
                    '마이페이지에서 회원 탈퇴를 진행할 수 있습니다. 탈퇴 시 계정 식별 정보는 삭제 또는 익명화되며, 이미 게시한 평가와 코멘트는 탈퇴한 사용자 콘텐츠로 남을 수 있습니다.',
                    '게시된 코멘트나 댓글에 대한 삭제 또는 블라인드 검토 요청은 About 화면의 문의하기 페이지를 통해 접수할 수 있습니다.',
                    '일부 요청은 계정 기록만으로 소유권을 충분히 확인하기 어려운 경우 제한될 수 있습니다.',
                ],
            },
            {
                heading: '8. 방침 변경',
                body: [
                    '서비스 기능, 저장 구조, 광고 도입, 법령 또는 정책 요구사항이 달라지면 본 방침은 변경될 수 있습니다.',
                    '중요한 변경이 있는 경우 이 페이지에 최신 시행일과 함께 반영합니다.',
                ],
            },
        ],
        notice: '향후 Google AdSense가 실제로 활성화되면, 실제 광고 구현 방식, 쿠키 및 웹 비콘 사용 방식, 지역별 법적 고지 의무 또는 동의 요구사항에 맞춰 본 방침을 다시 검토하고 보완해야 합니다.',
    };
}

function openPrivacyPolicy() {
    if (state.currentView?.id !== 'privacy') {
        state.privacyReturnView = state.currentView ? { ...state.currentView } : null;
    }
    navigateTo('privacy', renderPrivacyPolicy);
}

function closePrivacyPolicy() {
    const previous = state.privacyReturnView;
    state.privacyReturnView = null;
    if (previous?.func) {
        navigateTo(previous.id, previous.func, ...(previous.args || []));
        return;
    }
    navigateTo(state.selectedCategory ? 'list' : 'category', state.selectedCategory ? renderGameList : renderCategorySelection);
}

function renderPrivacyPolicy() {
    const el = document.getElementById('view-privacy');
    const content = getPrivacyPolicyContent();
    el.innerHTML = `
        <div class="card" style="max-width: 980px; margin-top: 2rem; line-height: 1.75;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1.75rem;">
                <button class="secondary" style="width:auto;" onclick="closePrivacyPolicy()">← ${t('btn_back')}</button>
                <h2 style="margin:0; color:var(--primary); font-size:2rem; text-align:center;">${content.title}</h2>
                <div style="width:90px;"></div>
            </div>
            <div style="padding:1.3rem 1.4rem; border:1px solid var(--border-color); border-radius:18px; background:var(--surface-bg); margin-bottom:1.5rem;">
                <div style="font-size:0.95rem; color:var(--text-muted); margin-bottom:0.55rem;">${content.effectiveDate}</div>
                <div style="font-size:1.02rem; color:var(--text-color);">${content.intro}</div>
            </div>
            <div style="display:grid; gap:1rem;">
                ${content.sections.map((section) => `
                    <section style="padding:1.25rem 1.35rem; border:1px solid var(--border-color); border-radius:18px; background:var(--card-bg);">
                        <h3 style="margin:0 0 0.85rem; color:var(--primary); font-size:1.2rem;">${section.heading}</h3>
                        <ul style="margin:0; padding-left:1.2rem; color:var(--text-color); display:grid; gap:0.55rem;">
                            ${section.body.map((item) => `<li>${item}</li>`).join('')}
                        </ul>
                    </section>
                `).join('')}
            </div>
            <div style="margin-top:1.5rem; padding:1rem 1.15rem; border-radius:16px; background:var(--surface-elevated); border:1px solid var(--border-color); color:var(--text-muted);">
                ${content.notice}
            </div>
        </div>
    `;
}
