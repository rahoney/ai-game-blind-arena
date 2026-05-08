import re

file_path = "backend/static/games/en/서바이벌 디펜스/ChatGPT_5.4-Thinking_Standard.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace lang attribute
content = content.replace('<html lang="ko">', '<html lang="en">')
content = content.replace('const LANG = "ko";', 'const LANG = "en";')
content = content.replace('.localeCompare(b.name, "ko")', '.localeCompare(b.name, "en")')

# The translation data
new_lang_data = """  const LANG_DATA = {
    en: {
      gameTitle: "Core Guardian: Top-down Survival Defense",
      uiTitle: "Battlefield Info",
      startTitle: "Core Guardian",
      startDesc:
`Defend the central core and survive until the end.
The player attacks automatically, gaining XP upon defeating enemies.
Upon leveling up, choose 1 of 3 upgrades to complete your build.`,
      startFoot: "Single HTML File · Auto Fire · Roguelike Upgrades · High Score Saved",
      startButton: "Start Game",
      howButton: "Controls",
      restartButton: "Restart",
      backButton: "Back to Title",
      victoryTitle: "Victory",
      defeatTitle: "Defeat",
      victoryDesc: "You have defended against all waves. The core is safe.",
      defeatPlayer: "Player has fallen. Regroup and return to the battlefield.",
      defeatCore: "The core has been destroyed. The defense line collapsed.",
      levelTitle: "Level Up",
      levelDesc: "Choose 1 of 3 upgrades.",
      levelFoot: "The game is paused while choosing an upgrade.",
      labelWave: "Current Wave",
      labelLevel: "Current Level",
      labelKills: "Kills",
      labelBest: "Best Record",
      labelPlayerHp: "Player HP",
      labelCoreHp: "Core HP",
      labelXp: "XP",
      labelStatus: "Status",
      labelUpgrades: "Acquired Upgrades",
      labelControls: "Controls",
      statusPreparing: "Waiting",
      statusWave: "Wave",
      statusEnemies: "Enemies",
      statusLevelUp: "Choosing Upgrade",
      statusWin: "Operation Successful",
      statusLose: "Operation Failed",
      controlsText:
`Move: WASD or Arrows
Attack: Auto Fire
Goal: Stop incoming enemies and defend the central core
Tip: Guide enemies away to reduce core damage, and select upgrades wisely.`,
      badgeMove: "Move",
      badgeAutoFire: "Auto Fire",
      badgeRoguelike: "Level Up Upgrades",
      badgeRecord: "Best Record Saved",
      miniGoal: "Goal",
      miniGoalValue: "Survive 10 Waves",
      miniDanger: "Defeat Condition",
      miniDangerValue: "Player or Core Destroyed",
      miniGrowth: "Growth",
      miniGrowthValue: "XP · Level Up · Upgrades",
      miniRecord: "Record",
      miniRecordValue: "Highest Kills Saved",
      endWave: "Reached Wave",
      endLevel: "Final Level",
      endKills: "Final Kills",
      endBest: "Saved Best Record",
      noUpgrades: "No upgrades acquired yet.",
      coreName: "Core",
      playerName: "Player",
      enemyChaser: "Chaser",
      enemyRunner: "Sprinter",
      enemyTank: "Brute",
      enemyShooter: "Marksman",
      waveStart: (n) => `Wave ${n} Started`,
      waveClear: (n) => `Wave ${n} Defended`,
      chooseUpgrade: "Choose an upgrade",
      recordText: (n) => `${n} Kills`,
      scoreText: (n) => `${n}`,
      upgradeTag: "Upgrade",
      upgradePicked: (name, lv) => `${name} Lv.${lv}`,
      up_fire_rate_name: "Rapid Fire",
      up_fire_rate_desc: "Decreases firing interval, increasing auto fire speed.",
      up_damage_name: "High Power Rounds",
      up_damage_desc: "Increases bullet damage.",
      up_move_name: "Mobility Boost",
      up_move_desc: "Increases movement speed.",
      up_multishot_name: "Scatter Shot",
      up_multishot_desc: "Fires additional bullets at once.",
      up_pierce_name: "Piercing Rounds",
      up_pierce_desc: "Increases the number of times bullets pierce enemies.",
      up_magnet_name: "Magnetic Field",
      up_magnet_desc: "Increases XP orb pickup range.",
      up_regen_name: "Self Repair",
      up_regen_desc: "Periodically restores player health.",
      up_core_regen_name: "Core Repair",
      up_core_regen_desc: "Periodically restores core health.",
      up_bullet_speed_name: "Bullet Speed",
      up_bullet_speed_desc: "Increases bullet speed for better accuracy.",
      up_crit_name: "Precision Strike",
      up_crit_desc: "Adds a small chance to deal massive critical damage.",
      up_shield_name: "Impact Mitigation",
      up_shield_desc: "Reduces damage taken by the player.",
      up_range_name: "Extended Range",
      up_range_desc: "Auto-aims at enemies from a greater distance.",
      choicePick: "Select",
      bestPrefix: "Best",
      levelPrefix: "Lv",
      wavePrefix: "W",
    }
  };"""

# Replace the specific block of LANG_DATA
pattern = re.compile(r'  const LANG_DATA = \{\s*ko: \{.*?\n    \}\s*\};\n', re.DOTALL)
content = pattern.sub(new_lang_data + '\n', content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
