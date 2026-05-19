# Nickname Removal Inventory

## 1. 목적

닉네임 로그인과 닉네임 기반 사용자 식별을 제거하기 위한 실제 코드 영향 범위를 기록한다.

기준 문서:
- [06_AUTH_ACCOUNT_PLAN.md](./06_AUTH_ACCOUNT_PLAN.md)

## 2. 백엔드 제거/교체 대상

### 2.1 Models

파일: `backend/models.py`

제거/교체 대상:
- `NicknameLogin`
- `Evaluation.nickname`
- `PlayEvent.nickname`
- `CommentReactionToggle.nickname`
- `CommentReplyCreate.nickname`
- `AdminAuthRequest.nickname`
- `ProfileBadgeUpdate.nickname`

대체 방향:
- 요청 사용자는 Firebase ID token에서 resolve한다.
- 사용자 표시 이름은 `profiles.display_name`에서 가져온다.
- 관리자 인증은 nickname/password payload가 아니라 Firebase token + role 검증으로 대체한다.

### 2.2 Main API

파일: `backend/main.py`

제거 대상:
- `POST /api/nickname/login`
- `POST /api/admin/auth`
- `GET /api/user_evals/{nickname}`
- `GET /api/mypage/{nickname}`

교체 대상:
- `GET /api/me`
- `GET /api/user_evals`
- `GET /api/mypage`
- `POST /api/mypage/profile-badge`
- `POST /api/evaluate`
- `POST /api/comment-reaction`
- `POST /api/comment-reply`
- `POST /api/admin/blind`

변경 방향:
- 모든 사용자 식별은 `Authorization: Bearer <firebase_id_token>`에서 resolve한다.
- 기존 `nickname` query/body/header는 제거한다.
- 관리자 여부는 `profiles.role`로 판단한다.
- 기존 `X-Admin-Token`은 제거한다.

### 2.3 Utils

파일: `backend/utils.py`

제거/교체 대상:
- `validate_nickname`
- nickname blocklist loading
- `build_user_badge_lookup`의 nickname key
- `summarize_mypage_data(nickname, ...)`
- `get_admin_nicknames`
- `is_admin_nickname`
- `get_admin_password`
- `issue_admin_token`
- `verify_admin_token`

대체 방향:
- display name validation은 별도 함수로 분리한다.
- badge lookup은 `user_id` 기준으로 계산한다.
- admin 판단은 `profiles.role`과 `SUPER_ADMIN_FIREBASE_UIDS`로 처리한다.

### 2.4 Schema

파일: `backend/schema.sql`

제거/교체 대상:
- `nicknames`
- `nickname_views`
- `evaluations.nickname`
- `comment_reactions.nickname`
- `comment_replies.nickname`
- `unique_user_eval` on `nickname`
- `unique_comment_reaction` on `nickname`

대체 방향:
- `profiles`
- `user_views` or no view history table
- `evaluations.user_id`
- `comment_reactions.user_id`
- `comment_replies.user_id`
- `unique(user_id, game_type, actual_model_name)`
- `unique(evaluation_id, user_id)`

## 3. 프런트엔드 제거/교체 대상

### 3.1 State/API

파일:
- `backend/static/js/state.js`
- `backend/static/js/api.js`

제거 대상:
- `state.nickname`
- `state.adminToken`
- `apiNicknameLogin`
- nickname query/body payloads
- `X-Admin-Token`

대체 방향:
- Firebase Auth current user/session state
- `Authorization: Bearer <firebase_id_token>`
- `/api/me`

### 3.2 Login/Actions

파일:
- `backend/static/js/ui-views.js`
- `backend/static/js/main-actions.js`
- `backend/static/js/main-common.js`

제거 대상:
- nickname input login UI
- `handleLogin` nickname flow
- nickname validation/blocklist
- admin password prompt

대체 방향:
- email/password signup
- email/password login
- Google login
- logout
- profile display name setup

### 3.3 MyPage/Comments

파일:
- `backend/static/js/ui-mypage.js`
- `backend/static/js/ui-comments.js`

제거 대상:
- nickname display as identity
- nickname-based badge seen storage key
- comment/reply author nickname source

대체 방향:
- profile display name
- profile badge by `user_id`
- user-specific local storage key by `profiles.id` or Firebase uid

### 3.4 Policy Text

파일:
- `backend/static/js/ui-policy.js`
- `backend/static/lang.json`

교체 대상:
- nickname-based service wording
- nickname login retention wording

대체 방향:
- Firebase Auth
- social login providers
- account/profile data
- Supabase storage

## 4. 1차 구현 순서

1. 환경변수 정리
2. Firebase token 검증 유틸 추가
3. `profiles` schema 초안 작성
4. `/api/me` 추가
5. nickname login UI/API 제거
6. email/password login UI 추가
7. Google login 추가
8. evaluate/comment/reaction/mypage API를 `user_id` 기준으로 전환
9. 관리자 role 전환
10. policy/lang 문구 교체

## 5. 구현 전 외부 입력 필요

- Supabase key 방식: Publishable/Secret 또는 Legacy anon/service_role
- 서버에서 사용할 Supabase secret/service key 값
- Firebase project id
- Firebase web app config
- Firebase Admin credential 방식
- 최초 `SUPER_ADMIN_FIREBASE_UIDS`
