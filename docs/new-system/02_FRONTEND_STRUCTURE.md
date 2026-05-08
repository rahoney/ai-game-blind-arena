# Frontend Structure Plan

## 1. 기술 스택

- React 18+
- TypeScript
- Vite
- React Router DOM
- TanStack Query
- Zustand
- React Hook Form
- Zod
- Tailwind CSS
- clsx
- class-variance-authority
- GSAP

## 2. frontend 디렉토리 구조

```text
frontend/
  public/
    favicon.svg
    badges/
  src/
    app/
      App.tsx
      main.tsx
      router.tsx
      providers.tsx
      store/
        auth-store.ts
        ui-store.ts
        onboarding-store.ts
    pages/
      OnboardingPage/
      GameListPage/
      PlayPage/
      ResultsPage/
      MyPage/
      AboutPage/
      PrivacyPage/
      Auth/
    features/
      auth/
      onboarding/
      games/
      play/
      evaluations/
      comments/
      badges/
      mypage/
      admin/
      policy/
      layout/
    shared/
      api/
      components/
      hooks/
      lib/
      i18n/
      types/
      constants/
      assets/
      config/
      styles/
```

## 3. 책임 분리

### 3.1 `pages/`
- route 단위 컨테이너
- 데이터 로드 orchestration
- 페이지 레이아웃 결정
- feature 조합

### 3.2 `features/`
- 비즈니스 도메인별 UI/로직 단위
- 페이지가 직접 복잡한 로직을 가지지 않도록 캡슐화

### 3.3 `shared/`
- 재사용 기초 계층
- 도메인 독립 컴포넌트와 유틸

## 4. 핵심 페이지 설계

### 4.1 OnboardingPage

Phase 1 parity 하위 구조:
- `LanguageStep`
- `LegacyNicknameStep`
- `CategoryStep`

Phase 5 auth 확장 하위 구조:
- `EntryModeStep`
- `LoginStep`
- `SignupStep`
- `RecoverStep`

주의:
- 레거시의 슬라이드 감도를 유지
- parity 단계에서는 레거시와 같은 흐름을 우선 유지
- auth 도입 이후 guest와 auth 진입을 같은 온보딩 흐름 안에서 제어

### 4.2 GameListPage

구성:
- 상단 헤더
- 카테고리 타이틀
- 게임 설명 문구
- 모델 카드 그리드
- 전체 비교 결과 진입 버튼

하위 컴포넌트:
- `CategoryHeader`
- `GameGuideNotice`
- `ModelCard`
- `ModelCardStatus`

### 4.3 PlayPage

구성:
- back control
- game guide notice
- game viewport
- evaluation form
- play comments section

평가 항목 parity:
- `창의성`
- `완성도`
- `조작감`
- `몰입감`
- `재미`
- `프롬프트 반영도`

하위 컴포넌트:
- `GameFrame`
- `EvaluationGrid`
- `EvaluationField`
- `CommentInput`
- `SubmitEvaluationButton`
- `PlayCommentsPanel`

권한 분기:
- guest는 평가폼은 보이되 submit 시 로그인 유도
- user는 정상 제출

### 4.4 ResultsPage

구성:
- score table
- score sort headers
- comment sort tabs
- comments list
- replies area

하위 컴포넌트:
- `ResultsTable`
- `SortableMetricHeader`
- `CommentsToolbar`
- `CommentCard`
- `ReactionButton`
- `RepliesList`
- `ReplyComposer`

중요:
- 레거시의 “깜빡임 최소화”를 유지해야 하므로
  - 전체 페이지 리렌더가 아니라 query cache + local UI state 조합으로 처리

### 4.5 MyPage

구성:
- profile summary
- current badge
- stats panels
- charts or stat list
- badge collection

하위 컴포넌트:
- `ProfileBadgePanel`
- `StatsSummaryCard`
- `MostViewedCategoryCard`
- `TopModelsCard`
- `BadgeCollectionGrid`
- `BadgeCard`

### 4.6 PrivacyPage

구성:
- sectioned policy content
- bilingual rendering
- effective date
- back action

### 4.7 AboutPage

구성:
- about content
- experiment constraints
- inquiry CTA
- embedded inquiry panel or routed subview preserving current Google Form iframe behavior

주의:
- 레거시의 문의 흐름은 외부 새 창이 아니라 서비스 내부 iframe 렌더에 가깝다.
- 신규 구현에서도 처음에는 이 흐름을 parity 기준으로 유지한다.

## 5. 상태 설계

## 5.1 Zustand store

### auth-store
- `sessionUser`
- `role`
- `isAuthenticated`
- `adminSession`
- `guestMode`
- `loginModalOpen`

### ui-store
- `language`
- `themeMode`
- `activeModal`
- `toastQueue`
- `sidebarOpen`
- `privacyReturnPath`

### onboarding-store
- `currentStep`
- `direction`
- `selectedCategory`
- `selectedModel`

## 5.2 React Query server state

query keys 예시:
- `games`, language
- `user-evals`, userId
- `results`, category, sort
- `play-comments`, category, blindId
- `mypage`, userId
- `badges`, userId

mutation 예시:
- login
- signup
- submitEvaluation
- submitReply
- toggleReaction
- updateProfileBadge
- toggleBlind

## 6. 타입 설계

### 공통 타입
- `Language`
- `UserRole`
- `CategoryKey`
- `BlindModelId`
- `ActualModelName`
- `BadgeKey`
- `ApiError`

### 도메인 타입
- `GameCategory`
- `GameModel`
- `EvaluationPayload`
- `EvaluationRecord`
- `CommentRecord`
- `ReplyRecord`
- `MyPageSummary`
- `BadgeRecord`
- `AdminBlindPayload`

원칙:
- 백엔드 응답 스키마와 1:1 매핑
- nullable/optional을 명시적으로 다룸

## 7. API 계층 설계

```text
shared/api/
  client.ts
  errors.ts
  query-client.ts
features/
  auth/api.ts
  games/api.ts
  evaluations/api.ts
  comments/api.ts
  mypage/api.ts
  admin/api.ts
  policy/api.ts
```

### 7.1 client.ts 책임
- base URL 관리
- JSON 파싱
- 에러 정규화
- auth header 주입
- admin token header 주입

### 7.2 API 규칙
- fetch raw call을 컴포넌트 안에 직접 쓰지 않는다.
- mutation 성공 후 invalidation key를 명확히 지정한다.

## 8. 인증 설계 초안

### 8.1 계정 도입 전제
- parity 완료 전까지는 레거시 닉네임 진입을 유지한다.
- auth 도입 시점에 닉네임 기반 진입을 폐기한다.
- `로그인`, `회원가입`, `둘러보기`를 온보딩에 노출

### 8.2 둘러보기
- 서버에 guest session을 만들지 여부는 백엔드 설계에서 결정
- 프런트는 guest role만으로도 충분히 동작 가능하게 설계

### 8.3 로그인 유도 UX
- 평가 제출
- 댓글 작성
- 좋아요/싫어요
- 마이페이지 진입
위 액션에서 guest이면 로그인 모달 오픈

## 9. 성능 및 렌더 전략

원칙:
- 페이지 전체를 교체하는 식 렌더 금지
- 리스트 아이템은 stable key 사용
- comment/reply local state와 server state를 분리
- iframe 영역은 unnecessary remount 방지

특히:
- `PlayPage`의 게임 iframe은 평가/댓글 상호작용으로 remount 되면 안 된다.
- `ResultsPage`는 정렬 변경 시 테이블과 댓글 섹션을 목적에 맞게 분리 갱신해야 한다.

## 10. 신규 구현 체크포인트

- 레거시 온보딩 애니메이션 체감 유지
- 결과 페이지 스크롤 점프 없음
- 댓글 액션 시 눈에 띄는 깜빡임 없음
- 마이페이지 미획득 배지 `?` 유지
- 관리자 블라인드 흐름 유지
