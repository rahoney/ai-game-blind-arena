import os
import glob
import random
import json
import unicodedata
from pathlib import Path

GAMES_DATA = {}
MODEL_NAME_MAP = {}
BASE_DIR = Path(__file__).resolve().parent
CATEGORY_METADATA = {
    "던전 탐색": {"translation_key": "cat_dungeon", "group": "strict", "order": 1},
    "강화된 벽돌깨기": {"translation_key": "cat_arkanoid", "group": "strict", "order": 2},
    "카드배틀": {"translation_key": "cat_card", "group": "strict", "order": 3},
    "1인칭 미니 FPS": {"translation_key": "cat_fps", "group": "advanced", "order": 4},
    "서바이벌 디펜스": {"translation_key": "cat_survival", "group": "advanced", "order": 5},
    "횡스크롤 액션": {"translation_key": "cat_side_scroll", "group": "advanced", "order": 6},
}

# Load model name mappings from external configuration file
try:
    with open(BASE_DIR / "models_config.json", "r", encoding="utf-8") as f:
        MODEL_NAME_MAP = json.load(f)
except Exception as e:
    print(f"Warning: Could not load models_config.json. Defaulting to empty map. Error: {e}")

def normalize_model_name(raw_name):
    # 확장자 제거
    base_name = raw_name.replace(".html", "")
    
    # Check if exact match exists in map
    if base_name in MODEL_NAME_MAP:
        return MODEL_NAME_MAP[base_name]
    
    # If not mapped, replace dashes with spaces and title case as a fallback for flexibility
    return base_name.replace("-", " ").title()

def normalize_category_name(raw_name):
    return unicodedata.normalize("NFC", raw_name.strip())

def initialize_games():
    global GAMES_DATA
    base_dir = BASE_DIR / "static" / "games"
    
    # 구조 변경: GAMES_DATA = { 'ko': { '던전 탐색': [...] }, 'en': { '던전 탐색': [...] } }
    GAMES_DATA = {'ko': {}, 'en': {}}
    
    for lang in ['ko', 'en']:
        lang_dir = base_dir / lang
        if not lang_dir.is_dir():
            continue
            
        temp_games = {}
        
        # 하위 디렉토리(게임 카테고리) 탐색
        for category in os.listdir(lang_dir):
            category_path = lang_dir / category
            if not category_path.is_dir():
                continue
                
            game_type = normalize_category_name(category)
            temp_games[game_type] = []
            
            # 카테고리 내의 html 파일 탐색
            files = glob.glob(str(category_path / "*.html"))
            for file_path in files:
                filename = os.path.basename(file_path)
                model_name = normalize_model_name(filename)
                
                temp_games[game_type].append({
                    "actual_model": model_name,
                    "filename": f"{lang}/{category}/{filename}" # 클라이언트에서 접근할 경로
                })
        
        # Assign blind IDs A, B, C... (Consistent across server restarts using a seed based on game_type)
        for game_type, models in temp_games.items():
            # Sort by actual model name so the blind IDs are deterministic for the same set of files
            models.sort(key=lambda x: x["actual_model"])
            random.Random(game_type).shuffle(models)
            
            blind_ids = [chr(i) for i in range(65, 65 + len(models))] # A, B, C, D...
            
            GAMES_DATA[lang][game_type] = []
            for i, model in enumerate(models):
                GAMES_DATA[lang][game_type].append({
                    "blind_id": blind_ids[i],
                    "actual_model": model["actual_model"],
                    "file": f"games/{model['filename']}" # API 응답용 경로
                })

initialize_games()


def get_category_meta(lang_games):
    categories = []
    for category in lang_games.keys():
        normalized_category = normalize_category_name(category)
        meta = CATEGORY_METADATA.get(normalized_category, {})
        categories.append({
            "name": normalized_category,
            "translation_key": meta.get("translation_key", normalized_category),
            "group": meta.get("group", "advanced"),
            "order": meta.get("order", 999),
        })

    categories.sort(key=lambda item: (item["order"], item["name"]))
    return categories
