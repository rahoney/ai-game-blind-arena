# Migration Execution Plan

## 1. 기본 전략

마이그레이션은 “레거시를 직접 수정하며 전환”이 아니라 “신규 루트를 별도 구축 후 parity 검증” 방식으로 진행한다.

원칙:
- 레거시는 기준선
- 신규는 독립 개발
- API는 1차 유지
- parity 후 auth 확장
- 사용자 노출 텍스트는 임의로 바꾸지 않고 레거시 wording을 그대로 유지
- 현재 단계 문서 범위를 벗어난 기능 확장 금지
- 현재 단계 완료 시 해당 단계 구현을 종료하고 다음 단계로 이동
- 구현 중 발생한 추가 아이디어는 즉시 반영하지 않고 backlog로만 관리
- parity 단계에서는 개선보다 동일성 우선

## 2. 단계별 계획

### Phase 0. 레거시 고정
- 레거시 문서 최신화
- 레거시 디렉토리 `AI_Game_legacy` 분리
- 신규 루트 `AI_Game` 생성

### Phase 1. 신규 루트 스캐폴드
- `frontend` 생성
- `backend` 기본 구조 생성
- `db`, `data`, `games`, `docs`, `infra` 구성
- 공통 `.env.example` 작성

### Phase 2. 프런트 기반
- Vite + React + TypeScript + Tailwind 설치
- Router 구성
- QueryClient 구성
- Zustand store 구성
- theme token 구성
- i18n resource loader 구성

### Phase 3. parity 우선 화면 이식
- 온보딩
- 카테고리 선택
- 모델 목록
- 플레이
- 결과
- 마이페이지
- About
- Privacy

### Phase 4. parity 우선 기능 이식
- 게임 목록 로드
- 평가 제출
- 댓글/반응
- 마이페이지
- 배지
- 관리자 블라인드

### Phase 5. 계정 구조 도입
- guest/login split
- auth pages
- session handling
- guest 제한 UX
- 레거시 닉네임 진입 제거

### Phase 6. 회귀 검증
- 레거시 대비 화면 비교
- 정책 비교
- 쿨다운/배지/블라인드 확인

## 3. 레거시 → 신규 매핑

### 레거시 뷰 파일
- `ui-views.js` → `pages/OnboardingPage`, `pages/GameListPage`, `pages/PlayPage`, `pages/AboutPage`
- `ui-comments.js` → `features/comments`, `pages/ResultsPage`
- `ui-mypage.js` → `features/mypage`, `features/badges`, `pages/MyPage`
- `ui-policy.js` → `pages/PrivacyPage`
- `ui-foundation.js` → `shared/components`, `features/layout`

### 레거시 로직 파일
- `main-actions.js` → feature hooks + mutations
- `main-common.js` → shared hooks + comments controller logic
- `api.js` → typed API modules
- `state.js` → zustand + react-query
- `app.js` → router + app providers + onboarding transition controller

## 4. parity 체크리스트

### 4.1 화면 parity
- 온보딩 전환
- `strict` / `advanced` 카테고리 그룹 구분
- 카테고리별 설명문구
- 플레이 화면 전체화면 버튼
- 플레이 화면 3열 2행 평가 그리드
- 플레이 화면 평가 항목 명칭과 줄바꿈 규칙
- 결과 페이지 댓글 레이아웃
- 마이페이지 배지 컬렉션
- About 내부 문의 iframe 흐름
- 푸터의 개인정보처리방침 링크 유지
- 콘텐츠 영역 사이드바 및 햄버거 진입 유지

### 4.2 정책 parity
- 닉네임 검증 규칙
- 평가/댓글 쿨다운
- 관리자 인증
- 블라인드 처리
- 배지 조건
- 개인정보처리방침 문구
- 카테고리명, 버튼명, 기능명, 안내문구, 팝업 문구, 배지명 등 사용자 노출 텍스트 동일성

### 4.3 UX parity
- 상단 점프 없음
- 결과/플레이 댓글 깜빡임 완화
- 팝업 alert 대체
- 배지 획득 시점 유지

## 5. 리스크와 대응

### 리스크 1. 레거시와 신규가 다른 정책으로 구현됨
대응:
- 구현 전 문서 대조
- 완료 후 checklist 대조

### 리스크 2. 스타일 속도는 빠르나 규칙이 무너짐
대응:
- Tailwind token + cva 강제
- 공통 컴포넌트 우선

### 리스크 3. 계정 도입으로 범위 폭증
대응:
- parity 완료 후 auth 확장
- guest model 먼저 설계만 반영

### 리스크 4. iframe 게임 영역이 리렌더로 깨짐
대응:
- PlayPage 구조에서 iframe stable mount 보장

## 6. 최초 구현 우선순위

1. 신규 루트 구조 확정
2. frontend 스캐폴드 생성
3. theme / router / store / i18n 기반 생성
4. OnboardingPage 구현
5. GameListPage 구현
6. PlayPage 구현
7. ResultsPage 구현
8. MyPage 구현
9. Policy/About 구현
10. parity 검증

## 7. 완료 기준

완료로 보는 기준:
- 신규 `AI_Game`가 단독으로 실행된다.
- 레거시 주요 사용자 여정이 모두 재현된다.
- 문서 기준 누락 없음이 확인된다.
- 이후 auth/ads/policy 확장을 진행할 구조가 확보된다.
