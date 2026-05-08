import re

file_path = "backend/static/games/en/서바이벌 디펜스/META-Muse-Spark.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

translations = {
    '<!-- 시작 화면 -->': '<!-- Start Screen -->',
    '<!-- 레벨업 -->': '<!-- Level Up -->',
    '<!-- 게임오버 -->': '<!-- Game Over -->',
    '// UI 텍스트 초기화': '// UI Text Initialization',
    '// ==================== 게임 코어 ====================': '// ==================== Game Core ====================',
    '// 오디오': '// Audio',
    '// 강화 정의': '// Upgrade Definitions',
    '// 장애물 생성 (20개)': '// Create obstacles (20)',
    '// 웨이브별 적 타입': '// Enemy types per wave',
    '// 슈터': '// Shooter',
    '// 탱크': '// Tank',
    '// 대셔': '// Dasher',
    '// 체이서': '// Chaser',
    '// else 슬라임': '// else Slime',
    '// 슬라임': '// Slime',
    '// 플레이어 이동': '// Player movement',
    '// 장애물 충돌': '// Obstacle collision',
    '// 적 스폰': '// Spawn enemy',
    '// 웨이브 진행': '// Wave progress',
    '// 자동 공격': '// Auto attack',
    '// 총알 업데이트': '// Bullet update',
    '// 적 충돌': '// Enemy collision',
    '// 적 업데이트': '// Enemy update',
    '// 슈터 공격': '// Shooter attack',
    '// 플레이어 충돌': '// Player collision',
    '// 적끼리 분리': '// Separate enemies',
    '// 경험치 젬': '// XP gems',
    '// 파티클': '// Particles',
    '// 승리 조건 (20웨이브 또는 10분)': '// Win condition (20 waves or 10 minutes)',
    '// 배경 그리드': '// Background grid',
    '// 장애물': '// Obstacles',
    '// 경험치': '// XP',
    '// 총알': '// Bullets',
    '// 적': '// Enemies',
    '// 체력바': '// Health bar',
    '// 플레이어': '// Player',
    '// 게임 루프': '// Game loop',
    '// 입력': '// Input',
    '// 버튼': '// Buttons'
}

for ko, en in translations.items():
    content = content.replace(ko, en)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
