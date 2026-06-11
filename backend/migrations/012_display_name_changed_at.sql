-- Migration 012: display_name_changed_at 컬럼 추가
-- Date: 2026-06-10
--
-- 목적:
--   닉네임(display_name) 변경 기능의 30일 쿨다운 추적을 위해
--   마지막 변경 시각을 저장하는 컬럼을 profiles 테이블에 추가한다.
--
-- 쿨다운 계산 규칙:
--   - display_name_changed_at 이 NULL 이면 profiles.created_at 기준으로 30일 계산.
--   - 값이 있으면 display_name_changed_at 기준으로 30일 계산.
--
-- 적용 방법:
--   Supabase Dashboard -> SQL Editor -> New query 에 붙여넣고 실행.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS display_name_changed_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.profiles.display_name_changed_at IS
'마지막 display_name 변경 시각. NULL이면 created_at 기준으로 쿨다운 계산.';
