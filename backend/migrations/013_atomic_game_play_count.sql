-- Migration 013: 게임 플레이 카운트 원자 증가
-- Date: 2026-06-23
--
-- 조회 후 갱신 방식에서 발생하는 동시 요청 유실을 방지한다.
-- 백엔드 service_role만 RPC를 실행할 수 있다.

CREATE OR REPLACE FUNCTION public.increment_game_play_count(
    p_game_type TEXT,
    p_actual_model_name TEXT
)
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
    INSERT INTO public.game_stats (game_type, actual_model_name, plays)
    VALUES (p_game_type, p_actual_model_name, 1)
    ON CONFLICT (game_type, actual_model_name)
    DO UPDATE SET plays = game_stats.plays + 1
    RETURNING plays;
$$;

REVOKE ALL ON FUNCTION public.increment_game_play_count(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_game_play_count(TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.increment_game_play_count(TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_game_play_count(TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
