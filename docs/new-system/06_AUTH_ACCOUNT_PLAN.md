# Auth and Account Plan

## 1. 목적

닉네임 기반 로그인에서 계정 기반 인증으로 전환한다.

목표:
- 마이페이지, 평가, 댓글, 배지, 관리자 기능을 계정 기준으로 연결
- 닉네임 로그인과 닉네임 기반 사용자 식별을 전면 제거
- 기본 계정과 소셜 로그인을 같은 사용자 모델로 통합
- 관리자 권한을 닉네임/비밀번호 기준에서 계정 역할 기준으로 전환

비목표:
- 모든 소셜 로그인을 1차에 동시에 구현하지 않는다.
- 관리자 페이지 전체 기능을 1차에 완성하지 않는다.
- 기존 닉네임 계정 데이터를 새 계정으로 마이그레이션하지 않는다.
- 기존 닉네임 데이터 소유권 복구 UX를 1차 범위에 포함하지 않는다.

## 2. 핵심 결정

### 2.1 인증 기반

권장:
- Firebase Auth Spark 플랜을 1차 인증 시스템으로 우선 검토한다.
- Supabase는 기존 DB/API 저장소로 유지한다.

이유:
- Google 로그인은 Firebase Auth에서 가장 빠르게 검증할 수 있다.
- Firebase Spark는 초기 인증 검증에 적합한 무료 시작점이다.
- 현재 GCP의 다른 유료 리소스를 사용할 계획이 없으므로, GCP 무료 크레딧을 소모하는 방향으로 시작하지 않는다.
- 기존 Supabase DB 구조는 유지하되 Firebase UID를 서비스 사용자 프로필에 매핑한다.

보류:
- Supabase Auth 단독 도입은 보류한다.
- Microsoft 로그인은 1차/2차 우선순위에서 제외한다.

주의:
- Firebase Auth를 쓰면 Supabase DB 사용자와 Firebase 사용자를 매핑해야 한다.
- 이 매핑 비용은 있지만, 현재는 Google 소셜 로그인 진입 비용과 GCP 크레딧 소모 리스크를 낮추는 쪽을 우선한다.
- 최종 확정 전 Firebase Auth 토큰을 백엔드에서 검증하는 방식과 Supabase row 연결 방식을 먼저 프로토타입으로 확인한다.

### 2.2 사용자 식별자

계정 전환 후 인증 기준 식별자는 Firebase `uid`다.

서비스 내부 데이터 기준은 `profiles.id`다.

사용자 로그인 아이디는 `profiles.login_id`다.

연결 방식:
- Firebase `uid`를 `profiles.firebase_uid`에 저장한다.
- 사용자가 입력하는 로그인 아이디는 `profiles.login_id`에 저장한다.
- 평가, 댓글, 답글, 반응, 배지 등 서비스 데이터는 `profiles.id` 또는 `user_id`로 연결한다.
- API 요청에서는 Firebase ID token을 검증한 뒤 `firebase_uid -> profiles.id`를 resolve한다.

닉네임은 더 이상 로그인 식별자나 데이터 소유권 기준으로 사용하지 않는다.

대체:
- 표시 이름은 `profiles.display_name`을 사용한다.
- 댓글 작성자 표시도 profile display name을 사용한다.
- legacy `nickname` 데이터는 새 계정 시스템에 연결하지 않는다.

### 2.3 관리자 권한

관리자 권한은 계정의 role로 관리한다.

권장 role:
- `user`
- `admin`
- `super_admin`

1차에서는 별도 관리자 로그인 페이지를 만들지 않는다.

흐름:
- 일반 로그인과 같은 경로로 로그인
- 로그인 후 `profiles.role` 확인
- 관리자 권한이 있으면 댓글 숨김/삭제/블라인드 같은 관리자 액션 노출
- 관리자 API는 서버에서 Firebase token 검증 후 `profiles.id + role`로 재검증

관리자 페이지는 댓글/신고/운영량이 늘어난 뒤 별도 Phase로 만든다.

## 3. 목표 데이터 구조

### 3.1 `profiles`

서비스 사용자 프로필 테이블.

필드 초안:
- `id`: UUID, primary key, service user id
- `firebase_uid`: Firebase Auth uid, unique
- `login_id`: 사용자가 입력하는 로그인 아이디, unique, 대소문자 비구분
- `real_name`: 계정 복구용 이름. 공개 표시에는 사용하지 않는다.
- `display_name`: 평가/댓글에 노출되는 표시 닉네임. 로그인 식별자로 사용하지 않는다.
- `display_name_set`: 사용자가 표시 닉네임 설정을 완료했는지 여부
- `avatar_url`: 소셜 프로필 이미지, nullable
- `role`: `user` | `admin` | `super_admin`
- `provider`: 최초 가입 provider, nullable. 예: `password`, `google`, `kakao`
- `social_providers`: 연결된 소셜 provider 목록
- `email`: nullable
- `email_verified`: boolean
- `email_verification_required`: 이메일 인증 전 주요 기능 제한 여부
- `account_status`: `active` | `email_unverified` | `dormant` | `withdrawn` | `admin_disabled`
- `created_at`
- `updated_at`
- `last_active_at`
- `last_login_at`

표시 닉네임 정책:
- 닉네임 로그인은 폐기하지만, 평가/댓글 작성자 표시는 `profiles.display_name`을 사용한다.
- 이메일/비밀번호 회원가입 시 표시 닉네임을 필수 입력받는다.
- Google 로그인 사용자는 최초 로그인 후 표시 닉네임 설정 화면을 반드시 거친다.
- 1차 구현은 기존 닉네임 검증 함수를 임시 재사용한다.
- 닉네임 입력 규칙은 별도 논의 후 확정한다. 검토 항목은 한글/영문/숫자 허용, 글자 수, 욕설/음란 표현 제한, 변경 주기다.
- 중복 닉네임은 허용하지 않는다. DB에는 `lower(display_name)` 기준 unique index를 둔다.

회원가입 필드:
- 아이디
- 이름
- 표시 닉네임
- 이메일
- 비밀번호
- 비밀번호 확인

회원가입 흐름:
- Firebase Auth 계정을 생성한다.
- Firebase 이메일 인증 메일을 발송한다.
- 이메일 인증 완료 전까지 평가/댓글/마이페이지 핵심 기능을 제한한다.
- DB에는 Firebase `uid`, 아이디, 이름, 표시 닉네임, 이메일, 최종 로그인 일자를 저장한다.

소셜 로그인 연결:
- 기본 회원가입 후 "소셜 로그인 연결하기"를 제공한다.
- Google 등 소셜 provider는 같은 Firebase uid에 link한다.
- 연결된 provider는 `profiles.social_providers`에 기록한다.
- 소셜 로그인만 먼저 한 사용자는 아이디/이름/표시 닉네임 설정을 완료해야 핵심 기능을 사용할 수 있다.

### 3.2 닉네임 기반 테이블 전환 방향

닉네임 로그인 기능은 전면 제거한다.

전환 방향:
- evaluations: `user_id` 기준으로 재작성
- comment_replies: `user_id` 기준으로 재작성
- comment_reactions: `user_id` 기준으로 재작성
- nickname_views: 제거하거나 `user_views`로 대체
- nicknames: 제거하거나 마이그레이션 완료 전 임시 보관 후 폐기
- badge/progress 관련 데이터: `user_id` 기준으로 재작성

legacy 연결 정책:
- 기존 닉네임 데이터를 새 계정에 자동 연결하지 않는다.
- 기존 닉네임 로그인 화면과 API는 제거한다.
- 기존 닉네임 데이터는 필요하면 백업 테이블 또는 운영 백업으로만 보관한다.
- 새 계정 시스템의 마이페이지, 댓글, 평가, 배지는 기존 닉네임 데이터를 합산하지 않는다.

### 3.3 현재 스키마와 충돌하는 지점

현재 DB는 닉네임 기반 제약이 강하다.

확인된 충돌:
- `evaluations.nickname`은 `NOT NULL`이고 `nicknames(nickname)`를 참조한다.
- `evaluations`는 `unique(nickname, game_type, actual_model_name)`로 중복 평가를 막는다.
- `comment_reactions`는 `unique(evaluation_id, nickname)`로 반응 중복을 막는다.
- `comment_replies`, `nickname_views`, `nicknames.profile_badge_key`도 닉네임 기준이다.
- 마이페이지와 배지 계산 유틸은 대부분 `nickname` 키로 group한다.

따라서 단순히 `user_id` nullable 컬럼을 추가하는 것만으로는 충분하지 않다.

필요한 전환 설계:
- `profiles`를 먼저 만든다.
- `evaluations`, `comment_reactions`, `comment_replies`, view history는 `user_id` 기준으로 마이그레이션 초안을 작성한다.
- `nickname` 컬럼과 `nicknames` 외래키를 제거하는 migration을 계획한다.
- 중복 방지 제약은 계정 기준으로 다시 만든다.

제약 초안:
- 평가 중복: `unique(user_id, game_type, actual_model_name)`
- 반응 중복: `unique(evaluation_id, user_id)`

주의:
- 닉네임 기능을 완전 제거하므로 기존 API와 프런트 호출을 함께 제거해야 한다.
- DB migration보다 코드 전환이 먼저 또는 동시에 진행되어야 한다.
- 기존 운영 데이터 폐기/백업 정책을 먼저 정한다.

### 3.4 서버 키와 DB 접근 원칙

현재 백엔드는 `SUPABASE_KEY` 하나로 Supabase client를 만든다.

계정 전환 전 결정해야 할 사항:
- Supabase의 신규 `Publishable and secret API keys`를 사용할지, 기존 `Legacy anon, service_role API keys`를 사용할지 결정한다.
- 기존 `SUPABASE_KEY`가 anon/public 계열인지 service/secret 계열인지 확인한다.
- 서버 전용 key는 서버 환경변수에만 둔다.
- 클라이언트 번들에는 secret/service role key를 절대 포함하지 않는다.
- Firebase client config는 공개 가능하지만 Firebase Admin credential은 서버에만 둔다.
- DB write는 가능하면 백엔드 API를 통해서만 수행한다.

Supabase key 선택지:
- 선택지 A: 최신 `Publishable key` + `Secret key`
- 선택지 B: Legacy `anon public` + `service_role secret`

계획 단계 결정 사항:
- 백엔드 API만 DB에 접근한다면 서버 전용 secret/service role 계열 key를 사용한다.
- 클라이언트가 Supabase에 직접 접근하지 않는다면 publishable/anon key는 런타임에 필요하지 않다.
- Supabase Dashboard에서 현재 발급 방식과 권장 전환 방식을 확인한 뒤 최종 결정한다.

권장 환경변수 후보:
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PUBLISHABLE_KEY` or `SUPABASE_ANON_KEY` if client-side Supabase가 필요할 때만
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_WEB_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_APP_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_MEASUREMENT_ID`
- `SUPER_ADMIN_FIREBASE_UIDS`

RLS 원칙:
- secret/service role key를 백엔드에서만 쓴다면 RLS는 우회될 수 있다. 이 경우 API 레이어 권한 검증이 필수다.
- anon key를 클라이언트에서 쓰는 구조로 바꾸면 RLS 정책을 먼저 작성해야 한다.
- 기존 schema.sql의 "anon full access" 예시는 운영 정책으로 사용하지 않는다.

## 4. 기능 범위

### Phase A. 현행 흐름 정리

- [ ] 제거할 닉네임 로그인 진입점 목록화
- [ ] 제거/교체할 닉네임 기반 마이페이지 API 목록화
- [ ] 제거/교체할 닉네임 기반 댓글/답글/반응 API 목록화
- [ ] 관리자 모드 로그인/토큰/비밀번호 흐름 목록화
- [ ] 제거/교체할 닉네임 참조 지점 정리
- [ ] 기존 rate limit key가 닉네임/IP 중 무엇을 쓰는지 정리하고 계정 기준으로 대체
- [ ] `LOCAL_TEST_MODE`와 `LOCAL_DB`가 계정 전환 후 어떻게 동작해야 하는지 정리

산출물:
- 닉네임 의존성 제거 목록
- 전환 대상 API 목록
- local mode 대체 정책

### Phase B. 계정 스키마 추가

- [ ] `profiles` 테이블 설계 확정
- [x] `profiles` 1차 생성 migration 작성
- [ ] `profiles.role` 정책 확정
- [ ] `profiles.firebase_uid` unique 정책 확정
- [ ] 기존 테이블을 `user_id NOT NULL` 기준으로 재설계할지 신규 테이블로 만들지 결정
- [ ] 기존 `nickname` 컬럼/외래키 제거 migration 초안 작성
- [ ] 기존 `unique_user_eval` 제거 및 `unique(user_id, game_type, actual_model_name)` 추가
- [ ] `comment_reactions`의 `unique(evaluation_id, nickname)` 제거 및 `unique(evaluation_id, user_id)` 추가
- [ ] 인덱스 설계
- [x] Firebase ID token 검증 방식 확정
- [ ] Supabase RLS 적용 여부 재검토
- [ ] Supabase key 선택 정책 확정: publishable/secret vs legacy anon/service_role
- [ ] 로컬 테스트 모드의 계정 대체 로직 설계

산출물:
- DB migration SQL
- role 정책
- 보안 환경변수 목록
- rollback 계획

### Phase C. 기본 계정 기능

우선순위:
1. 이메일 회원가입
2. 이메일 로그인
3. 로그아웃
4. 세션 유지
5. 프로필 생성/갱신

체크리스트:
- [ ] 아이디/이름/표시 닉네임/이메일/비밀번호 회원가입 UI
- [ ] 이메일/비밀번호 로그인 UI
- [ ] 회원가입 후 Firebase 이메일 인증 메일 발송
- [ ] 이메일 인증 전 주요 기능 제한
- [ ] 로그아웃
- [ ] Firebase Auth 로그인 상태 전역 관리
- [ ] Firebase ID token 백엔드 전달 방식 구현
- [x] `profiles` 자동 생성 1차 구현
- [ ] `login_id`, `real_name`, `display_name` 저장
- [ ] display name 설정
- [ ] 소셜 로그인 연결하기
- [ ] 닉네임 로그인 UI 제거

### Phase D. 기존 기능 계정 연결

- [ ] 평가 제출 시 `user_id` 저장
- [ ] 댓글 작성 시 `user_id` 저장
- [ ] 답글 작성 시 `user_id` 저장
- [ ] 좋아요/싫어요 반응을 `user_id` 기준으로 중복 방지
- [ ] 마이페이지 데이터를 `user_id` 기준으로 조회
- [ ] 배지 조건을 `user_id` 기준으로 계산
- [ ] 기존 닉네임 데이터를 마이페이지에서 합산하지 않도록 제거
- [ ] 계정 사용자에게 `nickname` 호환 필드를 저장하지 않도록 API 정리
- [ ] 평가 upsert 기준을 `user_id`로 전환
- [ ] 댓글 목록의 작성자 표시 값을 `nickname`에서 profile display name으로 전환
- [ ] rate limit key를 `nickname`에서 `user_id + IP` 기준으로 전환

중요 결정:
- 기존 닉네임 데이터를 새 계정에 연결하지 않는다.
- 자동 연결, 수동 연결, 운영자 연결 UX를 1차에 만들지 않는다.
- 필요하면 기존 DB 백업만 보관한다.

### Phase E. 관리자 권한 전환

- [ ] `profiles.role` 기반 관리자 판별
- [ ] 기존 관리자 닉네임/비밀번호 로그인 제거 또는 비활성화
- [ ] 기존 `X-Admin-Token` HMAC 관리자 토큰 폐기 시점 결정
- [ ] 관리자 액션 API에서 Firebase ID token 검증
- [ ] Firebase `uid`로 `profiles` 조회
- [ ] `SUPER_ADMIN_FIREBASE_UIDS` 환경변수 기반 최초 super admin 고정
- [ ] 관리자 댓글 블라인드/삭제 권한 연결
- [ ] 관리자 권한 없는 사용자의 관리자 버튼 미노출
- [ ] 서버에서 권한 재검증
- [ ] role 변경 API는 `super_admin`만 접근하도록 격리
- [ ] 관리자 활동 로그 테이블을 1차에 만들지 2차로 미룰지 결정

최초 관리자 정책:
- 특정 Firebase UID allowlist 방식으로 시작한다.
- 환경변수 예시: `SUPER_ADMIN_FIREBASE_UIDS=uid1,uid2`
- allowlist에 포함된 UID는 profile 생성 또는 `/api/me` resolve 시 `super_admin`으로 취급한다.
- 일반 `admin` role 부여/회수는 추후 `super_admin` 전용 API로만 허용한다.
- 클라이언트가 보낸 role 값은 절대 신뢰하지 않는다.

1차 관리자 UX:
- 별도 관리자 페이지 없음
- 기존 댓글/결과 화면 안에서 관리자 버튼만 조건부 노출

2차 관리자 UX:
- 댓글 관리 페이지
- 신고 목록
- 블라인드 이력
- 사용자 제재/해제
- 관리자 활동 로그

### Phase F. 소셜 로그인 확장

구현 순서:
1. Google via Firebase Auth
2. Kakao
3. Naver
4. Discord
5. GitHub

후순위:
- Facebook
- Amazon
- Line
- Twitch
- Steam
- Microsoft

원칙:
- Firebase Auth로 Google 하나를 끝까지 붙인 뒤 같은 패턴으로 확장한다.
- 모든 provider를 동시에 등록하지 않는다.
- provider별 callback URL, scopes, profile mapping을 문서화한다.
- Microsoft는 비즈니스/엔터프라이즈 로그인 성격이 강하므로 현재 서비스 우선순위에서 제외한다.

## 5. Provider 준비 체크리스트

### 5.1 공통

- [ ] 운영 도메인 확정
- [ ] 로컬 개발 callback URL 확정
- [x] Firebase 프로젝트 생성
- [ ] Firebase Spark 플랜 유지 여부 확인
- [x] Firebase Authentication 활성화
- [ ] Firebase Authorized domains 설정
- [ ] provider별 client id/secret 필요 여부 확인
- [x] Firebase Admin SDK 사용 방식 결정
- [x] 백엔드 Firebase ID token 검증 방식 1차 구현
- [x] `.env.example` 갱신
- [ ] 개인정보처리방침에 소셜 로그인 처리 항목 반영

로컬/운영 확인 항목:
- 로컬 개발 origin
- 운영 도메인
- Firebase Authorized domains
- provider별 redirect/callback 설정

실제 URL은 Firebase Auth 설정 방식과 provider별 개발자 콘솔 정책에 맞춰 확정한다.

### 5.2 Google

준비 위치:
- Firebase Console

작업:
- [x] Firebase 프로젝트 생성
- [x] Spark 플랜 상태 확인
- [x] Authentication > Sign-in method에서 Email/Password 활성화
- [x] Authentication > Sign-in method에서 Google 활성화
- [ ] 프로젝트 공개 이름/support email 설정
- [ ] Authorized domains 등록
- [ ] Web app config 확인
- [ ] Firebase JS SDK로 Google sign-in 구현
- [ ] 백엔드에서 Firebase ID token 검증
- [ ] 프로필 email/name/avatar 매핑 확인

주의:
- Firebase 프로젝트도 내부적으로 Google Cloud 프로젝트를 사용한다.
- 다만 Spark 플랜으로 시작하면 현재 GCP 유료 리소스 사용이나 무료 크레딧 소모를 전제로 하지 않아도 된다.
- Cloud Console에서 별도 유료 리소스를 활성화하지 않는다.

### 5.3 Kakao

준비 위치:
- Kakao Developers

작업:
- [ ] 애플리케이션 생성
- [ ] 플랫폼 Web 등록
- [ ] Redirect URI 등록
- [ ] 카카오 로그인 활성화
- [ ] 동의항목 설정
- [ ] Firebase Auth 커스텀 provider 또는 커스텀 토큰 연동 가능 여부 확인
- [ ] 백엔드 OAuth callback 필요 여부 확인
- [ ] email 제공 조건 확인

주의:
- Kakao는 email 제공이 항상 보장되지 않을 수 있다.
- email이 없을 때 display name 기반 임시 프로필 생성 정책이 필요하다.

### 5.4 Naver

준비 위치:
- Naver Developers

작업:
- [ ] 애플리케이션 등록
- [ ] 서비스 URL 등록
- [ ] Callback URL 등록
- [ ] 제공 정보 범위 설정
- [ ] Firebase Auth 커스텀 provider 또는 커스텀 토큰 연동 가능 여부 확인
- [ ] 백엔드 OAuth callback 필요 여부 확인
- [ ] email/name/avatar 매핑 확인

### 5.5 Discord

준비 위치:
- Discord Developer Portal

작업:
- [ ] Application 생성
- [ ] OAuth2 Redirects 등록
- [ ] scopes 결정: `identify`, `email`
- [ ] Firebase Auth 커스텀 provider 또는 커스텀 토큰 연동 가능 여부 확인
- [ ] 백엔드 OAuth callback 필요 여부 확인
- [ ] username/global_name/avatar 매핑 확인

### 5.6 GitHub

준비 위치:
- GitHub Developer Settings

작업:
- [ ] OAuth App 생성
- [ ] Homepage URL 등록
- [ ] Authorization callback URL 등록
- [ ] Firebase Auth GitHub provider 사용 가능 여부 확인
- [ ] 필요 시 Firebase Sign-in method에서 GitHub 활성화
- [ ] public email이 없는 계정 처리 정책 결정

## 6. 화면/UX 설계 초안

### 6.1 로그인 전

필요 화면:
- 로그인
- 회원가입
- 표시 닉네임 설정
- 아이디 찾기
- 비밀번호 재설정
- 소셜 로그인 버튼 영역

표시 원칙:
- 첫 화면에서 과도한 provider 버튼을 모두 노출하지 않는다.
- 1차는 이메일 + Google 중심으로 단순하게 시작한다.
- Kakao/Naver가 준비되면 한국어 UI에서 우선 노출한다.

### 6.2 로그인 후

필요 기능:
- 마이페이지 접근
- display name 수정
- 연결된 소셜 계정 표시
- 로그아웃
- 계정 삭제/로그아웃 안내

회원 탈퇴/관리자 탈퇴 처리:
- 마이페이지에는 회원탈퇴 메뉴를 추가해야 한다.
- 회원탈퇴 시 Firebase Auth 계정 삭제, `profiles` 삭제 또는 비식별화, 평가/댓글 보존/삭제 정책을 함께 결정해야 한다.
- 관리자 기능 또는 관리자 페이지에는 운영자가 회원을 직권 탈퇴/비활성화하는 기능을 별도로 설계한다.
- 이 기능은 닉네임 규칙 확정 이후 별도 Phase로 논의한다.

### 6.2.1 로그인 문제 해결

로그인 화면에는 "로그인에 문제가 있나요?" 링크만 노출한다.

클릭 후 선택지:
- 아이디 찾기
- 비밀번호 재설정

공통 보안 원칙:
- 형식 오류와 정보 불일치 메시지는 모두 "입력이 잘못되었습니다."로 통일한다.
- 10분 이내 실패 5회 발생 시 10분간 재시도를 제한한다.
- rate limit 기준은 recovery type + IP + 입력 식별자 hash를 함께 사용한다.
- 복구 시도는 `account_recovery_attempts`에 기록한다.
- 클라이언트에 전체 아이디, Firebase UID, 내부 profile id를 내려주지 않는다.

아이디 찾기 입력:
- 이름
- 표시 닉네임
- 이메일

아이디 찾기 흐름:
- 이름 + 표시 닉네임 + 이메일이 모두 일치하는 계정이 있을 때만 다음 단계로 진행한다.
- 일치 계정이 없거나 형식이 틀리면 "입력이 잘못되었습니다."만 출력한다.
- 일치 계정이 있으면 이메일 인증 단계를 진행한다.
- 이메일 인증은 Firebase Auth만으로 임의 복구 메일을 보낼 수 없으므로, 실제 아이디 발송은 Brevo 같은 메일 서비스가 필요하다.
- 이메일 인증 성공 후 브라우저에는 마스킹된 아이디만 내려준다.
- 마스킹 표시 예: `ab*************`
- 브라우저 표시값은 무조건 15자로 고정하여 실제 아이디 글자 수를 추정할 수 없게 한다.
- "아이디 메일로 받기"를 누르면 인증된 이메일로 전체 아이디를 발송한다.
- 전체 아이디는 API 응답이나 브라우저 상태에 절대 포함하지 않는다.

비밀번호 재설정 입력:
- 이름
- 아이디
- 이메일

비밀번호 재설정 흐름:
- 이름 + 아이디 + 이메일이 모두 일치하는 계정이 있을 때만 다음 단계로 진행한다.
- 일치 계정이 없거나 형식이 틀리면 "입력이 잘못되었습니다."만 출력한다.
- 일치 계정이 있으면 Firebase Auth의 비밀번호 재설정 메일을 발송한다.
- 사용자는 Firebase 재설정 링크에서 직접 새 비밀번호를 설정한다.
- 임시 비밀번호는 생성하지 않는다.

메일 송신 정책:
- Firebase Auth 사용 가능: 이메일 인증 메일, 비밀번호 재설정 메일.
- Firebase Auth만으로 부족: 아이디 전체 안내 메일, 운영 공지, 관리자 알림, 맞춤 HTML 메일.
- 커스텀 메일 송신이 필요하면 Brevo 무료 플랜을 우선 검토한다.
- Brevo 도입 시 API key는 서버 환경변수에만 둔다.
- 후보 환경변수: `BREVO_API_KEY`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`.

### 6.3 닉네임 기능 제거 UX

제거 대상:
- 닉네임 입력 로그인 화면
- 기존 닉네임 데이터 연결 안내
- 닉네임 기반 마이페이지 조회
- 댓글/평가 요청 payload의 `nickname`

대체:
- 로그인/회원가입 화면
- profile display name 설정
- 로그인 사용자 기준 마이페이지

주의:
- 기존 닉네임 데이터는 새 계정 화면에 노출하지 않는다.
- 필요하면 운영 백업 또는 별도 archival 테이블로만 유지한다.

## 7. API 전환 계획

### 7.1 인증 필요 API

계정 전환 후 인증 필요:
- 평가 제출
- 댓글 작성
- 답글 작성
- 댓글 반응
- 마이페이지 조회
- 프로필 수정
- 배지 대표 설정

### 7.2 관리자 API

관리자 role 필요:
- 댓글 블라인드
- 답글 블라인드
- 모델 블라인드
- 신고 처리
- 사용자 제재

모든 관리자 API는 클라이언트 표시 여부와 별개로 서버에서 role을 검증한다.

검증 흐름:
- 클라이언트가 Firebase ID token 전송
- 서버가 Firebase Admin SDK 또는 검증 가능한 방식으로 token 검증
- token의 `uid`로 `profiles.firebase_uid` 조회
- `profiles.role` 확인
- 요청 실행

## 8. 보안 설계

### 8.1 비밀번호와 암호화

원칙:
- 서비스 DB에 사용자 비밀번호를 저장하지 않는다.
- 이메일/비밀번호 인증은 Firebase Auth에 위임한다.
- 비밀번호 해시, 재설정, 이메일 인증은 Firebase Auth 기능을 우선 사용한다.
- 자체 비밀번호 암호화/복호화 로직을 만들지 않는다.

저장 가능한 값:
- Firebase `uid`
- email
- email verified 여부
- display name
- avatar URL
- provider

저장하지 않을 값:
- 소셜 provider access token
- refresh token
- 사용자 비밀번호
- Firebase Admin private key 원문을 코드 저장소에 커밋한 값

### 8.2 Firebase 토큰 검증

백엔드 보호 API는 Firebase ID token을 요구한다.

요청 형식:
- `Authorization: Bearer <firebase_id_token>`

검증 규칙:
- token signature 검증
- issuer/audience/project id 검증
- expiration 검증
- revoked token 확인 필요 여부 검토
- 검증 성공 후 `uid`로 `profiles.firebase_uid` 조회
- profile이 없으면 생성 가능한 엔드포인트에서만 생성

주의:
- 클라이언트가 보내는 email, display name, role은 신뢰하지 않는다.
- 권한 판단은 항상 서버가 resolve한 profile row 기준으로 한다.

### 8.3 권한 격리

role 정책:
- `user`: 일반 평가/댓글/마이페이지
- `admin`: 댓글/답글/모델 블라인드 등 운영 액션
- `super_admin`: 관리자 role 부여/회수, 운영 설정 변경

격리 원칙:
- `profiles.role`은 일반 프로필 수정 API에서 변경할 수 없다.
- role 변경 API는 `super_admin`만 접근할 수 있다.
- 관리자 버튼 노출은 UX 보조일 뿐이며 보안 경계가 아니다.
- 모든 관리자 API는 서버에서 Firebase token과 role을 재검증한다.

### 8.4 Supabase 접근 격리

백엔드가 service role key를 사용하는 경우:
- service role key는 서버 환경변수에만 저장한다.
- 클라이언트 번들에 service role key를 포함하지 않는다.
- RLS가 우회될 수 있으므로 API 레이어에서 권한을 강제한다.

클라이언트가 anon key로 Supabase에 직접 접근하는 경우:
- RLS를 먼저 설계하고 테스트한다.
- `profiles.role`, `firebase_uid`, 관리자 로그 등 민감 필드는 update 금지 정책을 둔다.
- 익명 사용자가 전체 테이블을 쓸 수 있는 정책을 만들지 않는다.

현재 계획에서는 백엔드 API 경유를 기본으로 한다.

### 8.5 세션, 쿠키, CSRF

1차 권장:
- 쿠키 세션보다 `Authorization: Bearer` 헤더 기반 API 호출을 사용한다.
- 이 구조에서는 일반적인 쿠키 CSRF 위험이 낮다.

쿠키 세션을 도입할 경우:
- HttpOnly
- Secure
- SameSite=Lax 또는 Strict
- CSRF token
- 명시적 logout/session revoke 정책을 추가한다.

### 8.6 rate limit과 abuse 방지

전환 전:
- 닉네임/IP 기반 rate limit

전환 후:
- `profiles.id + IP` 기준 rate limit
- 로그인 실패는 Firebase Auth 정책과 별도 IP rate limit을 함께 검토
- 댓글/답글/반응은 계정 ID 기준으로 제한
- 동일 모델 평가 재제출 제한은 `user_id + game_type + actual_model_name` 기준으로 제한

### 8.7 관리자 감사 로그

관리자 기능을 계정 기반으로 전환할 때 감사 로그를 설계한다.

필드 초안:
- `id`
- `actor_user_id`
- `actor_role`
- `action`
- `target_type`
- `target_id`
- `before`
- `after`
- `ip_address`
- `user_agent`
- `created_at`

1차에서 테이블만 만들고 UI는 2차로 미뤄도 된다.

### 8.8 개인정보와 보존

저장 최소화:
- email은 계정 식별과 복구에 필요한 경우에만 저장
- provider access token은 저장하지 않음
- IP 주소는 rate limit/운영 보안 목적에 필요한 범위로만 저장

문서 반영:
- 개인정보처리방침에 Firebase Auth, 소셜 로그인 provider, Supabase 저장 항목을 반영한다.
- 계정 삭제/데이터 연결 해제 정책을 별도로 정한다.

## 9. 리스크

### 리스크 1. 기존 닉네임 기능 제거로 인한 데이터 단절

대응:
- 닉네임 데이터 마이그레이션을 하지 않는다고 명시한다.
- 필요하면 기존 DB 백업을 별도로 보관한다.
- 새 계정 시스템은 새 평가/댓글/마이페이지 데이터부터 시작한다.

### 리스크 2. provider별 email 누락

대응:
- Firebase `uid`를 최우선 식별자로 사용
- `provider_user_id`를 별도로 저장할지 검토
- email 없는 계정도 프로필 생성 가능하게 설계
- display name 중복 허용

### 리스크 3. 관리자 권한 노출

대응:
- 프런트 버튼 숨김만으로 처리하지 않는다.
- 백엔드에서 세션과 role을 반드시 검증한다.
- 관리자 활동 로그를 2차에 추가한다.

### 리스크 4. 한 번에 너무 많은 provider 구현

대응:
- Google 완료 후 Kakao/Naver 순서로 확장
- provider별 설정 문서와 테스트 체크리스트를 남긴다.

### 리스크 5. Firebase Auth와 Supabase DB 매핑 복잡도

대응:
- `profiles.firebase_uid` unique 제약을 둔다.
- 모든 서비스 데이터는 직접 Firebase `uid`가 아니라 내부 `profiles.id`로 연결한다.
- 백엔드 공통 인증 미들웨어에서 `firebase_uid -> profiles.id` resolve를 한 번만 수행한다.
- 로컬 테스트용 mock user 정책을 별도로 둔다.

### 리스크 6. 현재 schema.sql의 RLS 예시 오해

대응:
- `anon full access` 정책은 운영 정책으로 사용하지 않는다고 명시한다.
- service role key 사용 시 API 레이어 권한 검증을 필수로 둔다.
- 클라이언트 Supabase 직접 접근이 필요해지면 RLS 문서를 별도로 작성한다.

### 리스크 7. Firebase Admin credential 유출

대응:
- private key는 환경변수/secret manager에만 저장한다.
- 저장소, 클라이언트 JS, 로그에 출력하지 않는다.
- 키 회전 절차를 문서화한다.

## 10. 진행 체크리스트

### 설계

- [ ] 현재 닉네임 의존성 정리
- [ ] `profiles` 스키마 확정
- [ ] role 정책 확정
- [ ] Firebase `uid`와 `profiles.id` 매핑 정책 확정
- [ ] 기존 닉네임 데이터 폐기/백업 정책 확정
- [ ] 관리자 UX 1차/2차 범위 확정
- [ ] Supabase key 선택 확정: publishable/secret vs legacy anon/service_role
- [ ] Supabase RLS 운영 정책 확정
- [ ] Firebase Admin credential 보관 정책 확정
- [ ] 개인정보처리방침 변경 항목 정리

### 구현 1차

- [ ] Firebase Auth 이메일 가입/로그인
- [ ] 프로필 생성
- [ ] 로그아웃/세션 유지
- [ ] Firebase ID token 백엔드 검증
- [ ] `firebase_uid -> profiles.id` resolve
- [ ] 마이페이지 `user_id` 연결
- [ ] 평가/댓글/반응 `user_id` 저장
- [ ] 관리자 role 기반 권한 전환

### 소셜 로그인

- [ ] Firebase 프로젝트 생성
- [ ] Firebase Spark 플랜 유지 확인
- [ ] Google provider 준비
- [ ] Firebase Auth Google 로그인 구현
- [ ] Kakao provider 준비
- [ ] Kakao 로그인 구현
- [ ] Naver provider 준비
- [ ] Naver 로그인 구현
- [ ] Discord/GitHub 우선순위 재검토
- [ ] Microsoft 제외 상태 유지 여부 재검토

### 검증

- [ ] 신규 가입 사용자 평가 제출
- [ ] 신규 가입 사용자 댓글 작성
- [ ] 기존 닉네임 로그인/API가 제거되었는지 확인
- [ ] 마이페이지 배지 계산
- [ ] 관리자 댓글 블라인드
- [ ] 로그아웃 후 보호 API 접근 차단
- [ ] Firebase Authorized domains 로컬/운영 검증
- [ ] provider별 callback 로컬/운영 검증

## 11. 구현 전 차단 조건

아래가 확정되기 전에는 코드 구현을 시작하지 않는다.

- [ ] Firebase Auth를 실제 1차 인증으로 사용할지 최종 확정
- [ ] Supabase Publishable/Secret 키 또는 Legacy anon/service_role 키 중 사용할 방식을 확정
- [ ] `profiles.id`와 `firebase_uid` 매핑 방식 확정
- [ ] 기존 `nickname NOT NULL`/외래키 제거 방식 확정
- [ ] 평가/반응 unique index 전환 방식 확정
- [ ] 최초 `SUPER_ADMIN_FIREBASE_UIDS` 값 확정
- [ ] 관리자 role 변경 권한자 결정
- [ ] Firebase Admin credential 보관 방식 확정
- [ ] 개인정보처리방침 개정 범위 확정

## 12. 다음 액션

1. 현행 닉네임 의존성 목록화
2. Firebase Auth Spark 적용 가능 범위 확인
3. Firebase ID token 백엔드 검증 방식 프로토타입
4. `profiles` migration 초안 작성
5. 이메일 로그인/회원가입 UI 설계
6. 관리자 role 전환 방식 확정
7. Firebase Auth Google 로그인 설정부터 시작
