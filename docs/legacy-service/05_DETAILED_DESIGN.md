# Detailed Functional and Structural Design

## 1. 프런트 구조

현재 레거시 파일:
- `backend/static/js/app.js`
- `backend/static/js/state.js`
- `backend/static/js/api.js`
- `backend/static/js/ui-foundation.js`
- `backend/static/js/ui-views.js`
- `backend/static/js/ui-comments.js`
- `backend/static/js/ui-mypage.js`
- `backend/static/js/ui-policy.js`
- `backend/static/js/main-common.js`
- `backend/static/js/main-actions.js`

역할:
- `app.js`: 초기화, 뷰 전환, 슬라이더
- `state.js`: 전역 상태 저장
- `api.js`: 백엔드 API 호출
- `ui-*`: 화면 HTML 렌더
- `main-*`: 사용자 액션 처리

## 2. 전역 상태

주요 상태:
- `nickname`
- `language`
- `games`
- `categories`
- `selectedCategory`
- `selectedGame`
- `userEvals`
- `myPageData`
- `resultsData`
- `playModelCommentsResult`
- `resultsSort`
- `commentSort`
- `profileBadgeSelection`
- `isAdmin`
- `adminToken`
- `expandedCommentIds`
- pending set 들

## 3. 백엔드 구조

핵심 파일:
- `backend/main.py`: API 엔드포인트
- `backend/utils.py`: 검증, 배지 로직, 보조 처리
- `backend/services.py`: 서비스 계층
- `backend/database.py`: DB 접근
- `backend/models.py`: 데이터 모델
- `backend/schema.sql`: DB 구조

## 4. 데이터 흐름

### 4.1 게임 목록 로드
- 언어 선택
- `/api/games` 호출
- 카테고리/모델 목록 렌더

### 4.2 평가 제출
- 점수 + 코멘트 입력
- 프런트 검증
- `/api/evaluate` 호출
- 사용자 평가 데이터 및 마이페이지 갱신

### 4.3 결과 화면
- `/api/results/{gameType}` 호출
- 점수 테이블 + 코멘트 목록 렌더
- 정렬/댓글은 부분 갱신

### 4.4 마이페이지
- `/api/mypage/{nickname}` 호출
- 통계, 배지, 프로필 배지 렌더

## 5. 핵심 정책 상세

### 5.1 닉네임
- 소유권 인증 없음
- 규칙 기반 검증만 존재

### 5.2 평가 쿨다운
- 서버 기준으로 제한
- 동일 모델 연속 코멘트 제한 유지

### 5.3 댓글 쿨다운
- 10초 쿨다운
- 20시간 내 50개 제한

### 5.4 반응
- 닉네임당 코멘트당 단일 반응

### 5.5 블라인드
- 관리자만 토글
- 일반 사용자에게는 블라인드 문구만 노출

## 6. 리팩터링 시 구조 대응

레거시 → 신규 대응:
- `state.js` → 전역 store + query state
- `api.js` → typed API client
- `ui-*` → React feature components
- `main-*` → hooks / event handlers / mutations
- `lang.json` → i18n resource 유지
- `style.css` → 초기에 유지 후 점진 정리

## 7. 신규 시스템에서 우선 보존할 예외 동작

- 온보딩 슬라이드 동작
- 코멘트 상호작용 시 상단 점프 방지
- 코멘트 상호작용 시 깜빡임 완화
- 배지 획득 팝업 노출 시점
- 영어 마이페이지 카테고리 표시명
- 마이페이지 미획득 배지 `?` 표시
