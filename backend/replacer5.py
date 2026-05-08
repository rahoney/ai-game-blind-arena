import os

replacements = {
    ' Score: ${kills} 킬, Turn: ${turn}': ' Score: ${kills} Kills, Turn: ${turn}',
    'Enemy 공격! (내 HP: ${player.hp}, Enemy HP: ${entity.hp})': 'Enemy attacked! (My HP: ${player.hp}, Enemy HP: ${entity.hp})',
    'Ate an apple and recovered Health! (현재 HP: ${player.hp})': 'Ate an apple and recovered Health! (Current HP: ${player.hp})',
    'Recovery Item 사용! HP ${actualHeal} 회복.': 'Used Recovery Item! Healed ${actualHeal} HP.',
    'Enemy이 ${enemyDmg} dealt damage.': 'Enemy dealt ${enemyDmg} damage.',
    'Player가 (${nx + 1}, ${ny + 1}) 위치로 이동했다.': 'Player moved to (${nx + 1}, ${ny + 1}).',
    'Enemy을 처치했다.': 'Defeated the enemy.',
    'Enemy을 처 치했다.': 'Defeated the enemy.',
    'Enemyrushed in! Player ${enemyDmg} 피해, Enemy ${playerDmg} 피해.': 'Enemy rushed in! Player took ${enemyDmg} damage, Enemy took ${playerDmg} damage.',
    '--- ${floor}층 ---': '--- Floor ${floor} ---',
    '⚔️ Enemy을 공격! -${PLAYER_DMG} (Enemy HP: ${Math.max(0, enemy.hp)})': '⚔️ Attacked Enemy! -${PLAYER_DMG} (Enemy HP: ${Math.max(0, enemy.hp)})',
    '👺 Enemy의 공격! -${ENEMY_DMG} HP (남은 HP: ${state.player.hp})': '👺 Enemy attacked! -${ENEMY_DMG} HP (Remaining HP: ${state.player.hp})',
    '- Enemy과 맞닿으면 서로 피해를 주는 전투가 발생합니다.': '- Combat occurs upon contact with Enemy.',
    '- Enemy이 살아 있어도 Exit에 도달하면 승리합니다.': '- Win by reaching the Exit even if Enemy is alive.',
    '- 아이템을 밟으면 Health을 회복합니다.': '- Step on items to recover Health.',
    '- 주변만 보이는 시야가 Enemy용됩니다.': '- Limited vision applied.',
    '8x8 Dungeon을 탐험해 Exit를 찾으세요.': 'Explore 8x8 Dungeon and find the Exit.',
    '8×8 Dungeon에서 Exit(🚪)를 찾아라. Enemy(👾)과 닿으면 전투가 발생한다. 주변만 보이는 Fog of War Enemy용.': 'Find Exit(🚪) in 8x8 Dungeon. Combat on contact with Enemy(👾). Fog of War applied.',
    'Wall에 막혀 이동할 수 없습니다.': 'Cannot move due to a Wall.',
    'Enemy과 전투! Player Health -2, Enemy Health -3': 'Combat with Enemy! Player Health -2, Enemy Health -3',
    'Recovery Item 획득! Health +4, +20pts': 'Acquired Recovery Item! Health +4, +20pts',
    '최대 도달 레벨: ${state.level}': 'Max Reached Level: ${state.level}',
    '처치됨': 'Defeated',
    'WASD / 방향키로 이동': 'WASD / Arrow keys to move',
    'WASD or 방향키로 이동 | Enemy과 전투 | 🚪 Exit 찾기': 'WASD or Arrow keys to move | Combat with Enemy | 🚪 Find Exit',
    'WASD or 방향키로 이동하세요.': 'Use WASD or Arrow keys to move.',
    'P: Player | E: Enemy | I: 회복 | O: Exit': 'P: Player | E: Enemy | I: Heal | O: Exit',
    'E: Enemy, I: Potion, O: 출구': 'E: Enemy, I: Potion, O: Exit',
    '이동: <strong>WASD</strong> or <strong>Arrow</strong>': 'Move: <strong>WASD</strong> or <strong>Arrow</strong>',
    '이동: ': 'Move: ',
    '결과 메시지': 'Result Message',
    '게임 방법': 'How to Play',
    '경로 생성 실패, 재시도': 'Path generation failed, retrying',
    '👹 Combat! You ${pdmg}, Enemy이 ${edmg} 피해': '👹 Combat! You took ${pdmg}, Enemy took ${edmg} damage',
    '👹 Enemy과 부딪히면 전투! 🍎 Healed!': '👹 Combat on collision with Enemy! 🍎 Healed!',
    '🧪 회복 Potion! HP +8': '🧪 Health Potion! HP +8'
}

d = 'backend/static/games/en/던전 탐색'
files = [f for f in os.listdir(d) if f.endswith('.html')]

# Sort keys by length descending
sorted_keys = sorted(replacements.keys(), key=len, reverse=True)

for f in files:
    filepath = os.path.join(d, f)
    with open(filepath, 'r', encoding='utf-8') as file:
        content = file.read()
    
    for k in sorted_keys:
        v = replacements[k]
        content = content.replace(k, v)
        
    with open(filepath, 'w', encoding='utf-8') as file:
        file.write(content)
        
print('Final replacements done.')
