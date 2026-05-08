# Target Architecture

## 1. 목표

신규 `AI_Game` 시스템은 다음을 만족해야 한다.

- 레거시 서비스의 화면/기능/정책 parity 유지
- 프런트 아키텍처를 React + TypeScript + Vite 기반으로 재구성
- 계정 기반 구조와 둘러보기 권한 분기를 수용할 수 있는 상태 모델 확보
- 백엔드 FastAPI는 초기에는 유지하고, 프런트만 독립 교체
- 스타일은 Tailwind + 디자인 토큰 + 공통 컴포넌트 규칙으로 통제

## 2. 최상위 디렉토리 구조

신규 시스템 루트:

```text
AI_Game/
  frontend/
  backend/
  db/
  data/
  games/
  docs/
  infra/
  scripts/
  .env.example
  README.md
```

### 2.1 디렉토리 역할

- `frontend/`
  - React + TypeScript + Vite 앱
  - UI, 페이지, 상태, i18n, 컴포넌트, 프런트 테스트

- `backend/`
  - FastAPI 앱
  - 인증, 게임 목록 API, 평가, 댓글, 배지, 관리자 기능

- `db/`
  - 스키마
  - 마이그레이션 문서
  - 시드 전략

- `data/`
  - 금지어 목록
  - 모델 메타데이터
  - 번역 보조 데이터

- `games/`
  - 언어별, 카테고리별 게임 HTML 자산

- `docs/`
  - 레거시 기준 문서
  - 신규 구조 문서
  - 운영/정책/광고/배포 문서

- `infra/`
  - 배포 관련 설정
  - reverse proxy, process manager, platform 메모

- `scripts/`
  - 데이터 정리
  - 빌드 보조
  - 자산 동기화

## 3. 프런트와 백엔드 경계

### 3.1 프런트 책임

- 온보딩
- 로그인 / 회원가입 / 둘러보기
- 게임 카테고리/모델 탐색
- 게임 플레이 화면 렌더
- 평가 UI
- 결과 화면 UI
- 댓글 / 반응 / 정렬 UI
- 마이페이지 UI
- 배지 컬렉션 UI
- About / 개인정보처리방침 / 문의 경로 UI
- 팝업 및 토스트 UI

### 3.2 백엔드 책임

- 계정 인증/세션
- 게스트/사용자/관리자 권한 검증
- 닉네임/계정/입력 검증
- 평가 저장 및 쿨다운 검증
- 댓글/반응/블라인드 검증
- 배지 조건 계산
- 마이페이지 집계
- 광고/정책 관련 서버 설정 보조

## 4. 사용자 권한 모델

신규 시스템은 처음부터 아래 권한 모델을 전제로 설계한다.

### 4.1 Guest

허용:
- 언어 선택
- 게임 카테고리/모델 목록 탐색
- 게임 플레이
- 결과 열람
- About / 개인정보처리방침 확인

제한:
- 평가 제출 불가
- 댓글/반응 불가
- 마이페이지 없음
- 배지 획득 없음

유도:
- 평가 버튼 또는 댓글 액션 클릭 시 로그인 모달 노출

### 4.2 User

허용:
- 평가 제출
- 댓글 / 좋아요 / 싫어요 / 답글
- 마이페이지
- 배지 획득 / 선택

### 4.3 Admin

허용:
- User 권한 전체
- 코멘트/댓글 블라인드
- 관리자 도구 접근

## 5. 라우팅 목표 구조

```text
/                       온보딩 또는 홈
/auth/login             로그인
/auth/signup            회원가입
/auth/recover           계정 복구
/browse                 둘러보기 진입
/games                  카테고리 선택
/games/:category        모델 목록
/play/:category/:blindId
/results/:category
/mypage
/about
/privacy
```

원칙:
- parity 1차 단계에서는 레거시의 `language/login/category` 온보딩을 `/` 내부 step 상태로 먼저 재현한다.
- 계정 도입 이후 `/auth/*`와 `/browse` 라우트를 활성화한다.
- 페이지 전환은 React Router로 관리
- 슬라이드 UX는 온보딩 내부 애니메이션으로 유지

## 6. 데이터 도메인 분리

도메인은 최소 아래 단위로 분리한다.

- `auth`
- `onboarding`
- `games`
- `play`
- `evaluations`
- `comments`
- `badges`
- `mypage`
- `admin`
- `policy`
- `layout`

각 도메인은 다음을 가질 수 있다.
- `api`
- `types`
- `hooks`
- `components`
- `utils`
- `constants`

## 7. 설계 원칙

### 7.1 parity first
- 레거시 동작과 정책을 먼저 맞춘다.
- 사용자에게 노출되는 텍스트도 parity 범위에 포함한다.

### 7.2 auth ready
- 계정 기능이 아직 일부 미완성이어도 권한 구조는 미리 설계한다.

### 7.3 typed boundaries
- API 응답, 라우트 파라미터, 폼 데이터, store 상태는 전부 타입으로 고정한다.

### 7.4 render without direct DOM mutation
- 수동 DOM 교체 금지
- 선언형 컴포넌트 렌더 원칙 유지

### 7.5 server truth
- 쿨다운, 배지, 관리자 권한, 블라인드는 서버 기준

## 8. 비목표

초기 비목표:
- Next.js SSR
- 마이크로프론트엔드
- CSS-in-JS
- 과도한 상태관리 라이브러리 복합 사용
- 디자인 시스템 과투자

## 9. 마이그레이션 완료 정의

완료로 보는 기준:
- 레거시 기능/정책 parity 확보
- 신규 auth/guest 구조를 수용할 수 있는 프런트 구조 확보
- 레거시 정적 UI 의존 제거
- 신규 시스템이 독립 루트에서 단독 실행 가능
