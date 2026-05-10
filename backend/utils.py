from datetime import datetime, timezone
from pathlib import Path
import csv
import re
from collections import defaultdict
import base64
import hashlib
import hmac
import json
import os

ENGLISH_NICKNAME_RE = re.compile(r"^[A-Za-z]{6,14}$")
KOREAN_NICKNAME_RE = re.compile(r"^[가-힣]{3,8}$")
JAMO_RE = re.compile(r"[\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]")

DEFAULT_RESERVED_NICKNAME_TERMS = (
    "admin", "administrator", "moderator", "operator", "staff", "manager",
    "관리자", "운영자", "매니저", "스태프", "공식", "마스터",
)

DEFAULT_BANNED_NICKNAME_TERMS = (
    "fuck", "shit", "bitch", "sex", "porn", "penis", "vagina",
    "섹스", "야동", "보지", "자지", "씨발", "시발", "병신", "좆", "존나",
)

BASE_DIR = Path(__file__).resolve().parent
BLOCKLIST_CSV_PATH = BASE_DIR / "data" / "nickname_blocklist.csv"
ADMIN_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 12


def _load_nickname_blocklist():
    banned_terms = set(DEFAULT_BANNED_NICKNAME_TERMS)
    reserved_terms = set(DEFAULT_RESERVED_NICKNAME_TERMS)

    if BLOCKLIST_CSV_PATH.exists():
        with BLOCKLIST_CSV_PATH.open("r", encoding="utf-8-sig", newline="") as csv_file:
            reader = csv.reader(csv_file)
            next(reader, None)
            for row in reader:
                banned = row[0].strip() if len(row) > 0 and row[0] else ""
                reserved = row[1].strip() if len(row) > 1 and row[1] else ""
                if banned:
                    banned_terms.add(banned)
                if reserved:
                    reserved_terms.add(reserved)

    return tuple(sorted(reserved_terms)), tuple(sorted(banned_terms))


RESERVED_NICKNAME_TERMS, BANNED_NICKNAME_TERMS = _load_nickname_blocklist()

BADGE_STAGES = [
    {"key": "badge_egg", "min": 0, "max": 6, "next": 7},
    {"key": "badge_junior_owl", "min": 7, "max": 13, "next": 14},
    {"key": "badge_student_owl", "min": 14, "max": 27, "next": 28},
    {"key": "badge_apprentice_owl", "min": 28, "max": 41, "next": 42},
    {"key": "badge_senior_owl", "min": 42, "max": None, "next": None},
]

BADGE_DISPLAY_ORDER = [
    "badge_egg",
    "badge_junior_owl",
    "badge_student_owl",
    "badge_apprentice_owl",
    "badge_senior_owl",
    "badge_critic_owl",
    "badge_doctor_owl",
    "badge_professor_owl",
    "badge_goat_owl",
    "badge_gamer_owl",
    "badge_wizard_owl",
    "badge_soldier_owl",
    "badge_mario_owl",
    "badge_cardmaster_owl",
    "badge_spaceship_owl",
    "badge_board_owl",
]

CATEGORY_COMPLETION_BADGES = {
    "던전 탐색": "badge_wizard_owl",
    "1인칭 미니 FPS": "badge_soldier_owl",
    "횡스크롤 액션": "badge_mario_owl",
    "카드배틀": "badge_cardmaster_owl",
    "서바이벌 디펜스": "badge_spaceship_owl",
    "강화된 벽돌깨기": "badge_board_owl",
}


def validate_nickname(nickname: str):
    nickname = (nickname or "").strip()
    if not nickname:
        return False, "nickname_required"

    lowered = nickname.casefold()
    if any(term in lowered for term in RESERVED_NICKNAME_TERMS if term.isascii()):
        return False, "nickname_reserved"
    if any(term in nickname for term in RESERVED_NICKNAME_TERMS if not term.isascii()):
        return False, "nickname_reserved"

    if any(term in lowered for term in BANNED_NICKNAME_TERMS if term.isascii()):
        return False, "nickname_banned"
    if any(term in nickname for term in BANNED_NICKNAME_TERMS if not term.isascii()):
        return False, "nickname_banned"

    if JAMO_RE.search(nickname):
        return False, "nickname_jamo_only"

    if ENGLISH_NICKNAME_RE.fullmatch(nickname) or KOREAN_NICKNAME_RE.fullmatch(nickname):
        return True, None

    return False, "nickname_format"


def get_effective_english_letter_count(text: str):
    count = 0
    previous = None
    streak = 0
    for char in text:
        if not char.isascii() or not char.isalpha():
            continue
        lowered = char.lower()
        if lowered == previous:
            streak += 1
        else:
            previous = lowered
            streak = 1
        if streak <= 2:
            count += 1
    return count


def validate_comment_text(comment: str | None):
    text = (comment or "").strip()
    if not text:
        return False, "comment_required"

    lowered = text.casefold()
    if any(term in lowered for term in BANNED_NICKNAME_TERMS if term.isascii()):
        return False, "comment_banned"
    if any(term in text for term in BANNED_NICKNAME_TERMS if not term.isascii()):
        return False, "comment_banned"

    complete_hangul_count = len(re.findall(r"[가-힣]", text))
    effective_english_count = get_effective_english_letter_count(text)

    if complete_hangul_count >= 3 or effective_english_count >= 4:
        return True, None

    return False, "comment_too_short"


def get_badge_info(unique_eval_model_count: int):
    count = max(0, unique_eval_model_count or 0)
    for index, stage in enumerate(BADGE_STAGES):
        stage_max = stage["max"]
        if stage_max is None or count <= stage_max:
            current_floor = stage["min"]
            next_threshold = stage["next"]
            progress_in_stage = count - current_floor
            stage_span = (next_threshold - current_floor) if next_threshold is not None else None
            return {
                "stage_index": index,
                "stage_key": stage["key"],
                "current_count": count,
                "current_floor": current_floor,
                "next_threshold": next_threshold,
                "progress_in_stage": progress_in_stage,
                "stage_span": stage_span,
                "is_max_stage": next_threshold is None,
            }

    return {
        "stage_index": len(BADGE_STAGES) - 1,
        "stage_key": BADGE_STAGES[-1]["key"],
        "current_count": count,
        "current_floor": BADGE_STAGES[-1]["min"],
        "next_threshold": None,
        "progress_in_stage": 0,
        "stage_span": None,
        "is_max_stage": True,
    }


def build_model_catalog(games_data):
    catalog = {}
    for lang_games in (games_data or {}).values():
        for game_type, models in lang_games.items():
            catalog.setdefault(game_type, set())
            for model in models:
                catalog[game_type].add(model["actual_model"])
    return catalog


def get_unlocked_badge_keys(eval_rows, view_rows, games_data):
    eval_rows = eval_rows or []
    view_rows = view_rows or []
    unlocked = {"badge_egg"}

    unique_models = {(row["game_type"], row["actual_model_name"]) for row in eval_rows}
    unique_eval_count = len(unique_models)
    total_views = len(view_rows)
    catalog = build_model_catalog(games_data)
    total_model_count = sum(len(models) for models in catalog.values())

    stage_badge = get_badge_info(unique_eval_count)["stage_key"]
    for stage in BADGE_STAGES:
        if BADGE_DISPLAY_ORDER.index(stage["key"]) <= BADGE_DISPLAY_ORDER.index(stage_badge):
            unlocked.add(stage["key"])

    if total_views >= 100:
        unlocked.add("badge_gamer_owl")

    evals_by_game = defaultdict(set)
    for row in eval_rows:
        evals_by_game[row["game_type"]].add(row["actual_model_name"])

    completed_categories = 0
    for game_type, model_names in catalog.items():
        if len(evals_by_game.get(game_type, set())) >= len(model_names) and len(model_names) > 0:
            completed_categories += 1
            badge_key = CATEGORY_COMPLETION_BADGES.get(game_type)
            if badge_key:
                unlocked.add(badge_key)

    if completed_categories >= 3:
        unlocked.add("badge_critic_owl")
    if completed_categories >= 4:
        unlocked.add("badge_doctor_owl")
    if completed_categories >= 5:
        unlocked.add("badge_professor_owl")
    if total_model_count > 0 and unique_eval_count >= total_model_count:
        unlocked.add("badge_goat_owl")

    return [key for key in BADGE_DISPLAY_ORDER if key in unlocked]


def resolve_profile_badge_key(saved_profile_badge_key: str | None, unlocked_badge_keys):
    unlocked_badge_keys = unlocked_badge_keys or ["badge_egg"]
    if saved_profile_badge_key and saved_profile_badge_key in unlocked_badge_keys:
        return saved_profile_badge_key
    return unlocked_badge_keys[-1]


def build_user_badge_lookup(target_nicknames, eval_rows, view_rows, games_data, saved_profile_badges=None):
    saved_profile_badges = saved_profile_badges or {}
    target_nicknames = target_nicknames or []
    eval_map = defaultdict(list)
    view_map = defaultdict(list)

    for row in eval_rows or []:
        eval_map[row["nickname"]].append(row)
    for row in view_rows or []:
        view_map[row["nickname"]].append(row)

    result = {}
    for nickname in target_nicknames:
        unlocked_badge_keys = get_unlocked_badge_keys(eval_map.get(nickname, []), view_map.get(nickname, []), games_data)
        result[nickname] = {
            "unlocked_badge_keys": unlocked_badge_keys,
            "profile_badge_key": resolve_profile_badge_key(saved_profile_badges.get(nickname), unlocked_badge_keys),
        }
    return result


def check_memory_rate_limit(store, key: str, window_seconds: int, max_requests: int):
    now = datetime.now(timezone.utc).timestamp()
    timestamps = [ts for ts in store[key] if now - ts < window_seconds]
    if len(timestamps) >= max_requests:
        oldest = min(timestamps)
        wait_time = int(window_seconds - (now - oldest))
        store[key] = timestamps
        return False, max(wait_time, 1)

    timestamps.append(now)
    store[key] = timestamps
    return True, 0


def make_rate_limit_store():
    return defaultdict(list)


def _parse_rate_limit_timestamp(row):
    if isinstance(row, (int, float)):
        return datetime.fromtimestamp(row, tz=timezone.utc)
    for key in ("updated_at", "created_at", "viewed_at"):
        value = row.get(key)
        if not value:
            continue
        return datetime.fromisoformat(value.replace('Z', '+00:00'))
    return None


def check_comment_submission_rate_limit(evaluations, cooldown_seconds: int = 10):
    if not evaluations:
        return True, 0

    latest_row = max(
        evaluations,
        key=lambda row: _parse_rate_limit_timestamp(row) or datetime.fromtimestamp(0, tz=timezone.utc),
    )
    latest_ts = _parse_rate_limit_timestamp(latest_row)
    if latest_ts is None:
        return True, 0

    diff_seconds = (datetime.now(timezone.utc) - latest_ts).total_seconds()
    if diff_seconds < cooldown_seconds:
        return False, max(int(cooldown_seconds - diff_seconds), 1)

    return True, 0


def check_same_model_comment_rate_limit(timestamps):
    parsed_times = [
        _parse_rate_limit_timestamp(value)
        for value in (timestamps or [])
    ]
    parsed_times = [ts for ts in parsed_times if ts is not None]
    submission_count = len(parsed_times)
    if submission_count <= 1:
        return True, 0

    wait_times = {
        2: 60,
        3: 600,
        4: 1800,
        5: 3600,
    }
    required_wait = wait_times.get(submission_count, 36000)
    latest_ts = max(parsed_times)
    diff_seconds = (datetime.now(timezone.utc) - latest_ts).total_seconds()
    if diff_seconds < required_wait:
        return False, max(int(required_wait - diff_seconds), 1)
    return True, 0


def check_reply_submission_rate_limit(replies, cooldown_seconds: int = 10, window_seconds: int = 60 * 60 * 20, max_replies: int = 50):
    if not replies:
        return True, 0, None

    parsed_times = [
        _parse_rate_limit_timestamp(row)
        for row in replies
    ]
    parsed_times = [ts for ts in parsed_times if ts is not None]
    if not parsed_times:
        return True, 0, None

    now = datetime.now(timezone.utc)
    latest_ts = max(parsed_times)
    diff_seconds = (now - latest_ts).total_seconds()
    if diff_seconds < cooldown_seconds:
        return False, max(int(cooldown_seconds - diff_seconds), 1), "cooldown"

    recent_replies = [ts for ts in parsed_times if (now - ts).total_seconds() < window_seconds]
    if len(recent_replies) >= max_replies:
        oldest_recent = min(recent_replies)
        wait_time = int(window_seconds - (now - oldest_recent).total_seconds())
        return False, max(wait_time, 1), "quota"

    return True, 0, None


def summarize_mypage_data(nickname: str, eval_rows, view_rows, games_data, saved_profile_badge_key: str | None = None):
    eval_rows = eval_rows or []
    view_rows = view_rows or []

    eval_counts = {}
    unique_models = set()
    for row in eval_rows:
        game_type = row['game_type']
        eval_counts[game_type] = eval_counts.get(game_type, 0) + 1
        unique_models.add((game_type, row['actual_model_name']))

    game_view_counts = {}
    model_view_counts = {}
    for row in view_rows:
        game_type = row['game_type']
        model_name = row['actual_model_name']
        game_view_counts[game_type] = game_view_counts.get(game_type, 0) + 1
        model_key = (game_type, model_name)
        model_view_counts[model_key] = model_view_counts.get(model_key, 0) + 1

    top_game_type = None
    if game_view_counts:
        top_game_type = max(game_view_counts.items(), key=lambda item: (item[1], item[0]))

    top_models = sorted(
        model_view_counts.items(),
        key=lambda item: (-item[1], item[0][0], item[0][1])
    )[:5]

    def find_blind_model_id(game_type: str, actual_model_name: str):
        target_name = (actual_model_name or "").strip()
        if not target_name:
            return None

        def matches(model):
            return (
                (model.get('name') or '').strip() == target_name
                or (model.get('actual_model') or '').strip() == target_name
            )

        for language_games in games_data.values():
            for game_key, models in language_games.items():
                if game_key != game_type:
                    continue
                for model in models:
                    if matches(model):
                        return model.get('blind_id')

        for language_games in games_data.values():
            for models in language_games.values():
                for model in models:
                    if matches(model):
                        return model.get('blind_id')
        return None

    unlocked_badge_keys = get_unlocked_badge_keys(eval_rows, view_rows, games_data)
    profile_badge_key = resolve_profile_badge_key(saved_profile_badge_key, unlocked_badge_keys)

    return {
        "nickname": nickname,
        "badge": {
            **get_badge_info(len(unique_models)),
            "stage_key": profile_badge_key,
        },
        "profile_badge_key": profile_badge_key,
        "unlocked_badge_keys": unlocked_badge_keys,
        "unlocked_badge_count": len(unlocked_badge_keys),
        "unique_eval_model_count": len(unique_models),
        "evaluations_by_game_type": [
            {"game_type": game_type, "count": count}
            for game_type, count in sorted(eval_counts.items(), key=lambda item: item[0])
        ],
        "top_game_type": {
            "game_type": top_game_type[0],
            "views": top_game_type[1],
        } if top_game_type else None,
        "top_models": [
            {
                "game_type": game_type,
                "blind_model_id": find_blind_model_id(game_type, actual_model_name),
                "actual_model_name": actual_model_name,
                "views": views,
            }
            for (game_type, actual_model_name), views in top_models
        ],
    }


def resolve_comment_reaction(existing_reaction: str | None, requested_reaction: str):
    if existing_reaction == requested_reaction:
        return {"action": "delete", "current_reaction": None}
    if existing_reaction in ("like", "dislike"):
        return {"action": "update", "current_reaction": requested_reaction}
    return {"action": "insert", "current_reaction": requested_reaction}


def get_admin_nicknames():
    raw = os.environ.get("ADMIN_NICKNAMES", "")
    if not raw and not os.environ.get("SUPABASE_URL") and not os.environ.get("SUPABASE_KEY"):
        raw = "winamp"
    return tuple(nickname.strip() for nickname in raw.split(",") if nickname.strip())


def is_admin_nickname(nickname: str):
    nickname = (nickname or "").strip()
    return nickname in get_admin_nicknames()


def get_admin_password():
    password = os.environ.get("ADMIN_PASSWORD", "")
    if not password and not os.environ.get("SUPABASE_URL") and not os.environ.get("SUPABASE_KEY"):
        return "pppp"
    return password


def _get_admin_token_secret():
    return (
        os.environ.get("ADMIN_SESSION_SECRET")
        or os.environ.get("ADMIN_PASSWORD")
        or "development-admin-secret"
    )


def issue_admin_token(nickname: str):
    if not get_admin_password():
        raise ValueError("Admin password is not configured")
    payload = {
        "nickname": nickname,
        "issued_at": int(datetime.now(timezone.utc).timestamp()),
    }
    payload_bytes = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    payload_token = base64.urlsafe_b64encode(payload_bytes).decode("ascii").rstrip("=")
    signature = hmac.new(
        _get_admin_token_secret().encode("utf-8"),
        payload_token.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{payload_token}.{signature}"


def verify_admin_token(token: str | None):
    if not get_admin_password():
        return None
    if not token or "." not in token:
        return None

    payload_token, signature = token.rsplit(".", 1)
    expected_signature = hmac.new(
        _get_admin_token_secret().encode("utf-8"),
        payload_token.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(signature, expected_signature):
        return None

    padding = "=" * (-len(payload_token) % 4)
    try:
        payload_bytes = base64.urlsafe_b64decode((payload_token + padding).encode("ascii"))
        payload = json.loads(payload_bytes.decode("utf-8"))
    except Exception:
        return None

    nickname = payload.get("nickname")
    issued_at = int(payload.get("issued_at", 0))
    now_ts = int(datetime.now(timezone.utc).timestamp())

    if not nickname or not is_admin_nickname(nickname):
        return None
    if now_ts - issued_at > ADMIN_TOKEN_MAX_AGE_SECONDS:
        return None

    return {
        "nickname": nickname,
        "issued_at": issued_at,
    }

def check_submission_rate_limit(evaluations):
    return check_comment_submission_rate_limit(evaluations)
