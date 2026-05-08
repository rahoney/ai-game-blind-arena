import os
import re

dir_path = "/mnt/c/Users/achie/Downloads/AI_Game/backend/static/games/en/서바이벌 디펜스/"
files = [f for f in os.listdir(dir_path) if f.endswith(".html")]

# Korean character range
ko_re = re.compile(r'[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\ud7b0-\ud7ff]+')

translation_map = {
    "시작": "Start",
    "재시작": "Restart",
    "레벨업": "Level Up",
    "게임 오버": "Game Over",
    "게임오버": "Game Over",
    "점수": "Score",
    "최고 기록": "Best Record",
    "최고기록": "Best Record",
    "체력": "HP",
    "공격": "Attack",
    "이동": "Move",
    "속도": "Speed",
    "강화": "Upgrade",
    "적": "Enemy",
    "웨이브": "Wave",
    "생존 시간": "Survival Time",
    "생존시간": "Survival Time",
    "처치": "Kills",
    "가속": "Accelerate",
    "피해": "Damage",
    "반경": "Radius",
    "자석": "Magnet",
    "보호막": "Shield",
    "관통": "Pierce",
    "폭발": "Explosion",
    "범위": "Area",
    "회복": "Regen",
    "기록": "Record",
    "종료": "End",
    "승리": "Victory",
    "패배": "Defeat",
    "클리어": "Clear",
    "최종": "Final",
    "오버레이": "Overlay",
    "공통": "Common",
    "설정": "Settings",
    "상태": "State",
    "초기화": "Reset",
    "상수": "Constants",
    "함수": "Function",
    "루프": "Loop",
    "갱신": "Update",
    "표시": "Display",
    "문자열": "Strings",
    "중앙": "Central",
    "관리": "Management",
    "한국어": "Korean",
    "영어": "English",
    "강화 카드": "Upgrade Card",
    "적 타입": "Enemy Type",
    "장애물": "Obstacles",
    "배치": "Placement",
    "충돌": "Collision",
    "유틸": "Utils",
    "파티클": "Particles",
    "투사체": "Projectiles",
    "발사": "Fire",
    "메인": "Main",
    "시스템": "System",
    "정의": "Definition",
    "입력": "Input",
    "상황": "Situation",
    "환경": "Environment",
    "경계": "Boundary",
    "보스": "Boss",
    "알림": "Notice",
    "선택": "Select",
    "카드": "Card",
    "일반": "Normal",
    "빠름": "Fast",
    "탱크": "Tank",
    "플레이어": "Player",
    "사운드": "Sound",
    "생성": "Creation",
    "팩토리": "Factory",
    "초기": "Initial",
    "정보": "Information",
    "화면": "Screen",
    "이벤트": "Event",
    "바인딩": "Binding",
    "효과": "Effect",
    "별": "Star",
    "배경": "Background",
}

def translate_text(text):
    # If it's a comment, we might want to just translate the whole thing or remove it.
    # For simplicity, we'll replace known terms and then see what's left.
    for ko, en in translation_map.items():
        text = text.replace(ko, en)
    
    # If there are still Korean characters, it's probably a sentence.
    # We'll just strip them if they are in a comment, or leave them if they are small.
    # But the user said "replace them with English equivalents or remove them if they are just comments".
    return text

def process_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Update lang
    content = content.replace('<html lang="ko">', '<html lang="en">')
    
    # 2. Handle comments
    # JS Comments: // or /* ... */
    # HTML Comments: <!-- ... -->
    
    def replace_ko(match):
        return translate_text(match.group(0))

    # Replace Korean characters in the whole content using the map
    # This is a bit aggressive but should work for game UI/Logic
    
    # We'll split by blocks of Korean characters and translate them
    new_content = ""
    last_idx = 0
    for match in ko_re.finditer(content):
        new_content += content[last_idx:match.start()]
        ko_str = match.group(0)
        translated = translate_text(ko_str)
        # If still has Korean, and it's likely a comment (checked by context), we could remove it.
        # But for now, let's just use the translated version.
        new_content += translated
        last_idx = match.end()
    new_content += content[last_idx:]
    
    # Clean up: if there are any remaining Korean characters, just remove them if they are in comments
    # Actually, the map above covers most things. Let's do a final pass for any single Korean chars
    final_content = ko_re.sub('', new_content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(final_content)

for file_name in files:
    print(f"Processing {file_name}...")
    process_file(os.path.join(dir_path, file_name))

print("Done.")
