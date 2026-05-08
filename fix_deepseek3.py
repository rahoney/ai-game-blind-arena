import re

file_path = "backend/static/games/en/서바이벌 디펜스/Deepseek-v3.2-Thinking.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace HTML elements
content = content.replace('<html lang="ko">', '<html lang="en">')
content = content.replace('<title>서바이벌 디펜스</title>', '<title>Survival Defense</title>')
content = content.replace('<h1>서바이벌 디펜스</h1>', '<h1>Survival Defense</h1>')
content = content.replace('<p>적들을 물리치고 최대한 오래 살아남으세요!</p>', '<p>Defeat enemies and survive as long as possible!</p>')
content = content.replace('<h2>서바이벌 디펜스</h2>', '<h2>Survival Defense</h2>')
content = content.replace('<p>당신은 끝없이 몰려오는 적들로부터 생존해야 합니다.<br>', '<p>You must survive against endless waves of enemies.<br>')
content = content.replace('경험치를 모아 레벨업하고 강화를 선택하여 더 오래 살아남으세요.<br>', 'Collect XP to level up and choose upgrades to survive longer.<br>')
content = content.replace('웨이브가 진행될수록 적들은 더 강력해집니다.</p>', 'Enemies become stronger as waves progress.</p>')
content = content.replace('<button id="startButton" class="btn">게임 시작</button>', '<button id="startButton" class="btn">Start Game</button>')
content = content.replace('<h3>조작법</h3>', '<h3>Controls</h3>')
content = content.replace('<span>이동</span>', '<span>Move</span>')
content = content.replace('<span>공격</span>', '<span>Attack</span>')
content = content.replace('<span>게임 일시정지</span>', '<span>Pause Game</span>')
content = content.replace('<span>게임 재시작</span>', '<span>Restart Game</span>')
content = content.replace('<h2>레벨 업!</h2>', '<h2>Level Up!</h2>')
content = content.replace('<p>강화를 선택하세요:</p>', '<p>Choose an upgrade:</p>')
content = content.replace('<h2>사망</h2>', '<h2>You Died</h2>')
content = content.replace('<p>당신은 적들에게 패배했습니다.</p>', '<p>You have been defeated by the enemies.</p>')
content = content.replace('<span>최종 웨이브</span>', '<span>Final Wave</span>')
content = content.replace('<span>처치한 적</span>', '<span>Enemies Killed</span>')
content = content.replace('<span>최대 레벨</span>', '<span>Max Level</span>')
content = content.replace('<span>최고 기록</span>', '<span>Best Record</span>')
content = content.replace('<button id="restartButton" class="btn">다시 시작하기</button>', '<button id="restartButton" class="btn">Restart Game</button>')
content = content.replace('<h2>승리!</h2>', '<h2>Victory!</h2>')
content = content.replace('<p>축하합니다! 15웨이브를 모두 클리어하셨습니다!</p>', '<p>Congratulations! You cleared all 15 waves!</p>')
content = content.replace('<span>획득 점수</span>', '<span>Score Obtained</span>')
content = content.replace('<button id="winRestartButton" class="btn">다시 시작하기</button>', '<button id="winRestartButton" class="btn">Play Again</button>')

content = content.replace('<div class="stat-title">체력</div>', '<div class="stat-title">HEALTH</div>')
content = content.replace('<div class="stat-title">웨이브</div>', '<div class="stat-title">WAVE</div>')
content = content.replace('<div class="stat-title">레벨</div>', '<div class="stat-title">LEVEL</div>')
content = content.replace('<div class="stat-title">처치 수</div>', '<div class="stat-title">KILLS</div>')
content = content.replace('<div class="stat-title">최고 기록</div>', '<div class="stat-title">BEST RECORD</div>')
content = content.replace('<div class="stat-title">점수</div>', '<div class="stat-title">SCORE</div>')

content = content.replace('<h3>능력치</h3>', '<h3>STATS</h3>')
content = content.replace('<span>공격력</span>', '<span>DAMAGE</span>')
content = content.replace('<span>공격 속도</span>', '<span>ATTACK SPEED</span>')
content = content.replace('<span>이동 속도</span>', '<span>MOVE SPEED</span>')
content = content.replace('<span>투사체 수</span>', '<span>PROJECTILES</span>')

content = content.replace('<h3>획득한 강화</h3>', '<h3>ACQUIRED UPGRADES</h3>')
content = content.replace('<div class="powerup-item">강화가 없습니다</div>', '<div class="powerup-item">No upgrades acquired</div>')
content = content.replace('<button id="pauseButton" class="btn" style="flex: 1; padding: 12px; font-size: 1rem;">일시정지</button>', '<button id="pauseButton" class="btn" style="flex: 1; padding: 12px; font-size: 1rem;">Pause</button>')
content = content.replace('<button id="restartButton2" class="btn" style="flex: 1; padding: 12px; font-size: 1rem; background: linear-gradient(90deg, #ff6b6b, #ff8e53);">재시작</button>', '<button id="restartButton2" class="btn" style="flex: 1; padding: 12px; font-size: 1rem; background: linear-gradient(90deg, #ff6b6b, #ff8e53);">Restart</button>')
content = content.replace('<p>탑다운 서바이벌 디펜스 게임 | WASD로 이동 | 자동 공격 | 레벨업 시 강화 선택</p>', '<p>Top-down Survival Defense Game | WASD to move | Auto Attack | Choose upgrade on level up</p>')

# JS Code replacements
content = content.replace('if (enemyType === "fast") typeText = "빠름";', 'if (enemyType === "fast") typeText = "Fast";')
content = content.replace('else if (enemyType === "tank") typeText = "강함";', 'else if (enemyType === "tank") typeText = "Tank";')
content = content.replace('if (enemy.type === "fast") typeText = "빠름";', 'if (enemy.type === "fast") typeText = "Fast";')
content = content.replace('else if (enemy.type === "tank") typeText = "강함";', 'else if (enemy.type === "tank") typeText = "Tank";')

content = content.replace('ctx.fillText(`다음 웨이브까지: ${waveTimeLeft.toFixed(1)}초`, 20, 30);', 'ctx.fillText(`Next wave in: ${waveTimeLeft.toFixed(1)}s`, 20, 30);')
content = content.replace('ctx.fillText("일시정지", canvas.width / 2, canvas.height / 2 - 50);', 'ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2 - 50);')
content = content.replace('ctx.fillText("P 키를 눌러 계속하기", canvas.width / 2, canvas.height / 2 + 20);', 'ctx.fillText("Press P to resume", canvas.width / 2, canvas.height / 2 + 20);')

# Now handle LANG_DATA specifically
# We will find the range of LANG_DATA and replace it carefully.
start_marker = 'const LANG_DATA = {'
end_marker = '};'

start_idx = content.find(start_marker)
if start_idx != -1:
    # Find the matching closing brace for this object.
    # Simplified: find the next '};' after start_idx
    end_idx = content.find(end_marker, start_idx) + 2
    
    new_lang_data = """const LANG_DATA = {
            "gameTitle": "Survival Defense",
            "startScreenTitle": "Survival Defense",
            "startScreenDescription": "You must survive against endless waves of enemies.\\nCollect XP to level up and choose upgrades to survive longer.\\nEnemies become stronger as waves progress.",
            "levelUpTitle": "Level Up!",
            "levelUpDescription": "Choose an upgrade:",
            "gameOverTitle": "You Died",
            "gameOverDescription": "You have been defeated by the enemies.",
            "winTitle": "Victory!",
            "winDescription": "Congratulations! You cleared all 15 waves!",
            
            "startButton": "Start Game",
            "restartButton": "Restart Game",
            "pauseButton": "Pause",
            "resumeButton": "Resume",
            
            "health": "Health",
            "wave": "Wave",
            "level": "Level",
            "kills": "Kills",
            "bestRecord": "Best Record",
            "score": "Score",
            "finalWave": "Final Wave",
            "finalKills": "Enemies Killed",
            "finalLevel": "Max Level",
            "highScore": "Best Record",
            "winKills": "Enemies Killed",
            "winLevel": "Max Level",
            "winScore": "Score Obtained",
            
            "damage": "Damage",
            "attackSpeed": "Attack Speed",
            "moveSpeed": "Move Speed",
            "projectileCount": "Projectiles",
            
            "upgrades": "Acquired Upgrades",
            "noUpgrades": "No upgrades acquired",
            
            "upgradeDamage": {
                "name": "Damage Boost",
                "description": "Increases player attack damage by 5."
            },
            "upgradeAttackSpeed": {
                "name": "Attack Speed",
                "description": "Increases attack speed by 20%."
            },
            "upgradeMoveSpeed": {
                "name": "Move Speed",
                "description": "Increases movement speed by 15%."
            },
            "upgradeMaxHealth": {
                "name": "Max Health",
                "description": "Increases maximum health by 25."
            },
            "upgradeProjectileCount": {
                "name": "Extra Projectile",
                "description": "Fires 1 additional projectile at the same time."
            },
            "upgradeHealthRegen": {
                "name": "Health Regen",
                "description": "Regenerates 1 HP per second."
            },
            "upgradeCriticalChance": {
                "name": "Critical Chance",
                "description": "15% chance to deal double damage on hit."
            },
            "upgradeAreaDamage": {
                "name": "Area Damage",
                "description": "Killing enemies deals damage to nearby enemies."
            },
            
            "enemyNormal": "Normal",
            "enemyFast": "Fast",
            "enemyTank": "Tank",
            
            "controls": "Controls",
            "move": "Move",
            "attack": "Attack",
            "pause": "Pause Game",
            "restartGame": "Restart Game"
        };"""
    
    content = content[:start_idx] + new_lang_data + content[end_idx:]

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
