# Execution Runbook

이 문서는 신규 `AI_Game` 구축을 실제로 시작할 때, 무엇부터 어떤 순서로 진행해야 하는지 정리한 즉시 실행용 런북이다.

기준 원칙:
- 레거시 parity 우선
- 현재 단계 범위를 넘는 기능 확장 금지
- 사용자 노출 텍스트 임의 변경 금지
- 계정 시스템은 parity 이후 단계에서 도입

## 1. 지금 바로 시작할 순서

### Step 1. 레거시/신규 분리 실행 계획 확정

목표:
- 현재 작업 루트를 `AI_Game_legacy`로 분리할 실제 절차를 확정
- 신규 `AI_Game` 루트를 어디에 만들지 확정

완료 기준:
- 상위 디렉토리 기준 경로 계획이 문장으로 정리됨
- 이름 변경과 신규 생성 순서가 확정됨

주의:
- 현재 세션이 레거시 루트에 물려 있으므로 즉시 rename을 실행하지 않는다.
- 먼저 상위 경로에서 실행할 절차를 정리한 뒤 수행한다.

### Step 2. 신규 `AI_Game` 최상위 디렉토리 생성

목표:
- 신규 서비스 전용 루트를 만든다.

생성 대상:
- `frontend/`
- `backend/`
- `db/`
- `data/`
- `games/`
- `docs/`
- `infra/`
- `scripts/`

완료 기준:
- 신규 루트가 생성되고, 문서에서 정의한 최상위 구조가 실제로 존재함

### Step 3. 문서 복사 및 기준선 고정

목표:
- 신규 루트의 `docs/` 안에 현재 레거시/신규 설계 문서를 복사 또는 이관

필수 포함 문서:
- legacy-service 문서 세트
- new-system 문서 세트
- `LEGACY_SERVICE_SPEC.md`
- `WORK_CHECKLIST.md`

완료 기준:
- 신규 루트 안에서도 문서 기준으로 바로 작업을 이어갈 수 있음

### Step 4. frontend 스캐폴드 생성

목표:
- React + TypeScript + Vite + Tailwind 기반 프런트 초기 구조 생성

완료 기준:
- dev 서버가 기동 가능
- 기본 라우팅과 앱 진입점이 존재

주의:
- 이 단계에서는 실제 화면 기능 구현에 들어가지 않는다.
- 빌드/실행 기반만 만든다.

### Step 5. 프런트 공통 기반 구성

목표:
- Router
- QueryClient
- Zustand store
- i18n loader
- theme tokens
- 공통 layout shell

완료 기준:
- 빈 페이지라도 `/`, `/games`, `/play`, `/results`, `/mypage`, `/about`, `/privacy` 라우팅이 가능
- 기본/마이페이지 테마 전환 구조가 존재

### Step 6. Onboarding parity 구현

목표:
- 레거시와 동일한 슬라이드 기반 온보딩 재현

범위:
- LanguageStep
- LegacyNicknameStep
- CategoryStep

완료 기준:
- 레거시와 동일한 단계 전환 체감
- 텍스트 동일
- `strict` / `advanced` 그룹 표시

주의:
- 이 단계에서 로그인/회원가입/둘러보기는 구현하지 않는다.

### Step 7. GameListPage parity 구현

목표:
- 모델 목록 화면 재현

범위:
- 카테고리 타이틀
- 설명 문구
- 모델 카드
- 플레이 수 / 평가 수
- 평가 완료 표시
- 전체 비교 평가 보기 버튼

완료 기준:
- 화면 레이아웃과 문구 parity 확보

### Step 8. PlayPage parity 구현

목표:
- 게임 플레이 화면 재현

범위:
- back button
- fullscreen button
- guide notice
- iframe game viewport
- 3열 2행 평가 그리드
- 코멘트 입력
- 플레이 코멘트 패널

완료 기준:
- iframe remount 없이 렌더
- 평가 항목명/문구 parity 확보

### Step 9. ResultsPage parity 구현

목표:
- 결과 테이블과 댓글 인터랙션 재현

범위:
- 점수 테이블
- 헤더 정렬
- 최신순/좋아요순
- 댓글 카드
- 좋아요/싫어요
- 답글 펼치기/등록

완료 기준:
- 스크롤 점프 없음
- 과도한 깜빡임 없음

### Step 10. MyPage / About / Privacy parity 구현

목표:
- 보조 화면 parity 확보

범위:
- 마이페이지 통계
- 배지 컬렉션
- About 내용
- 문의 iframe 흐름
- 개인정보처리방침
- 푸터 정책 링크

완료 기준:
- 레거시 주요 사용자 여정이 전부 재현됨

### Step 11. parity 검증

목표:
- 문서 기준 누락 여부 확인

검증 기준:
- `docs/legacy-service/*`
- `docs/new-system/*`
- `LEGACY_SERVICE_SPEC.md`
- `WORK_CHECKLIST.md`

완료 기준:
- 화면 parity
- 정책 parity
- 텍스트 parity
- UX parity

## 2. 지금 당장 하면 안 되는 것

- 계정 시스템 구현
- 둘러보기 권한 분기 실제 적용
- 광고 배치
- 개인정보처리방침 광고 실구현 기준 추가 보강
- 디자인 개선 명목의 임의 텍스트 수정
- parity 단계 외 기능 추가

## 3. 착수 직전 체크

- [ ] 현재 단계 목표가 “신규 루트 생성 + parity 준비”인지 확인
- [ ] 이번 단계에서 건드릴 문서 범위를 확인
- [ ] 텍스트 parity 원칙을 다시 확인
- [ ] 단계 외 기능 추가 금지 원칙을 다시 확인

## 4. 첫 실행 명령 전에 확정해야 할 것

- 레거시 rename을 언제 할지
- 신규 `AI_Game`를 상위 경로 어디에 만들지
- 신규 루트에 문서를 복사할지, 참조만 할지

## 5. 추천 바로 다음 액션

가장 바로 시작할 작업:
1. 상위 경로 기준으로 `AI_Game_legacy` 전환 절차 확정
2. 신규 `AI_Game` 최상위 디렉토리 생성
3. `frontend` 스캐폴드 생성

이 세 단계가 끝나야 본격적인 화면 이식에 들어갈 수 있다.
