-- Migration 011: RLS 정책 명시화 및 접근 권한 회수
-- Date: 2026-06-10
--
-- 배경:
--   Supabase 보안 검사에서 다음 이슈가 발견됨.
--   - CRITICAL: game_stats, evaluations 테이블 RLS 미활성화
--   - WARN: 전체 테이블이 GraphQL anon/authenticated 경로로 노출
--   - INFO: RLS 활성화됐으나 정책 없는 테이블 7개
--
-- 원칙:
--   이 프로젝트의 모든 DB 접근은 FastAPI 백엔드가 service_role key로 처리한다.
--   service_role은 RLS를 우회하므로 백엔드 동작에 영향 없다.
--   anon / authenticated 역할의 직접 접근은 허용하지 않는다.
--
-- 적용 방법:
--   Supabase Dashboard -> SQL Editor -> New query 에 붙여넣고 실행.
--   pg_graphql extension은 Dashboard -> Database -> Extensions 에서 별도 비활성화.


-- ----------------------------------------------------------
-- 1. CRITICAL: RLS 활성화 (미적용 테이블)
-- ----------------------------------------------------------

ALTER TABLE public.game_stats  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------
-- 2. anon 역할 접근 권한 전체 회수
-- ----------------------------------------------------------

REVOKE ALL ON public.profiles                   FROM anon;
REVOKE ALL ON public.auth_provider_accounts     FROM anon;
REVOKE ALL ON public.evaluations                FROM anon;
REVOKE ALL ON public.game_stats                 FROM anon;
REVOKE ALL ON public.user_views                 FROM anon;
REVOKE ALL ON public.comment_reactions          FROM anon;
REVOKE ALL ON public.comment_replies            FROM anon;
REVOKE ALL ON public.account_recovery_attempts  FROM anon;
REVOKE ALL ON public.signup_email_verifications FROM anon;


-- ----------------------------------------------------------
-- 3. authenticated 역할 접근 권한 전체 회수
-- ----------------------------------------------------------

REVOKE ALL ON public.profiles                   FROM authenticated;
REVOKE ALL ON public.auth_provider_accounts     FROM authenticated;
REVOKE ALL ON public.evaluations                FROM authenticated;
REVOKE ALL ON public.game_stats                 FROM authenticated;
REVOKE ALL ON public.user_views                 FROM authenticated;
REVOKE ALL ON public.comment_reactions          FROM authenticated;
REVOKE ALL ON public.comment_replies            FROM authenticated;
REVOKE ALL ON public.account_recovery_attempts  FROM authenticated;
REVOKE ALL ON public.signup_email_verifications FROM authenticated;


-- ----------------------------------------------------------
-- 4. 명시적 RESTRICTIVE 정책 추가
--    RLS enabled + no policy 는 이미 deny-all 이지만,
--    의도를 명확히 하고 INFO 경고를 해소하기 위해 명시적으로 추가.
-- ----------------------------------------------------------

-- profiles
CREATE POLICY "deny_all_anon"          ON public.profiles AS RESTRICTIVE FOR ALL TO anon          USING (false);
CREATE POLICY "deny_all_authenticated" ON public.profiles AS RESTRICTIVE FOR ALL TO authenticated  USING (false);

-- auth_provider_accounts
CREATE POLICY "deny_all_anon"          ON public.auth_provider_accounts AS RESTRICTIVE FOR ALL TO anon          USING (false);
CREATE POLICY "deny_all_authenticated" ON public.auth_provider_accounts AS RESTRICTIVE FOR ALL TO authenticated  USING (false);

-- evaluations
CREATE POLICY "deny_all_anon"          ON public.evaluations AS RESTRICTIVE FOR ALL TO anon          USING (false);
CREATE POLICY "deny_all_authenticated" ON public.evaluations AS RESTRICTIVE FOR ALL TO authenticated  USING (false);

-- game_stats
CREATE POLICY "deny_all_anon"          ON public.game_stats AS RESTRICTIVE FOR ALL TO anon          USING (false);
CREATE POLICY "deny_all_authenticated" ON public.game_stats AS RESTRICTIVE FOR ALL TO authenticated  USING (false);

-- user_views
CREATE POLICY "deny_all_anon"          ON public.user_views AS RESTRICTIVE FOR ALL TO anon          USING (false);
CREATE POLICY "deny_all_authenticated" ON public.user_views AS RESTRICTIVE FOR ALL TO authenticated  USING (false);

-- comment_reactions
CREATE POLICY "deny_all_anon"          ON public.comment_reactions AS RESTRICTIVE FOR ALL TO anon          USING (false);
CREATE POLICY "deny_all_authenticated" ON public.comment_reactions AS RESTRICTIVE FOR ALL TO authenticated  USING (false);

-- comment_replies
CREATE POLICY "deny_all_anon"          ON public.comment_replies AS RESTRICTIVE FOR ALL TO anon          USING (false);
CREATE POLICY "deny_all_authenticated" ON public.comment_replies AS RESTRICTIVE FOR ALL TO authenticated  USING (false);

-- account_recovery_attempts
CREATE POLICY "deny_all_anon"          ON public.account_recovery_attempts AS RESTRICTIVE FOR ALL TO anon          USING (false);
CREATE POLICY "deny_all_authenticated" ON public.account_recovery_attempts AS RESTRICTIVE FOR ALL TO authenticated  USING (false);

-- signup_email_verifications
CREATE POLICY "deny_all_anon"          ON public.signup_email_verifications AS RESTRICTIVE FOR ALL TO anon          USING (false);
CREATE POLICY "deny_all_authenticated" ON public.signup_email_verifications AS RESTRICTIVE FOR ALL TO authenticated  USING (false);
