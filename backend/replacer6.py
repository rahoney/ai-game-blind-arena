import os

replacements = {
    'Combat! Player ${playerDmg} 피해, Enemy dealt ${enemyDmg} damage.': 'Combat! Player took ${playerDmg} damage, Enemy dealt ${enemyDmg} damage.',
    'Recovery Item을 사용했다. Health ${prev} → ${state.player.hp}': 'Used Recovery Item. Health ${prev} → ${state.player.hp}',
}

d = 'backend/static/games/en/던전 탐색'
files = [f for f in os.listdir(d) if f.endswith('.html')]

for f in files:
    filepath = os.path.join(d, f)
    with open(filepath, 'r', encoding='utf-8') as file:
        content = file.read()
    
    for k, v in replacements.items():
        content = content.replace(k, v)
        
    with open(filepath, 'w', encoding='utf-8') as file:
        file.write(content)
        
print('Final cleanup done.')
