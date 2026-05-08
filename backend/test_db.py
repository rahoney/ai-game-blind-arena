import os
import asyncio
from main import supabase, GAMES_DATA

async def test_db():
    if not supabase:
        print("DB Not Connected (No Supabase URL/Key found in .env)")
        return
        
    print("Testing DB Connection...")
    try:
        # Test 1: Fetch games
        res = supabase.table('game_stats').select('*').limit(1).execute()
        print("Game Stats Select OK")
        
        # Test 2: Insert/Update play count (dummy data)
        try:
            supabase.table('game_stats').upsert({
                "game_type": "test_game",
                "actual_model_name": "test_model",
                "plays": 1
            }).execute()
            print("Game Stats Upsert OK")
        except Exception as e:
            print(f"Game Stats Upsert Failed: {e}")

        # Test 3: Insert/Upsert evaluation
        try:
            eval_data = {
                "nickname": "test_user",
                "game_type": "test_game",
                "actual_model_name": "test_model",
                "blind_model_id": "A",
                "score_control": 5,
                "score_structure": 5,
                "score_presentation": 5,
                "score_difficulty": 5,
                "score_fun": 5,
                "score_overall": 5,
                "total_score": 30,
                "comment": "Test comment"
            }
            supabase.table('evaluations').upsert(eval_data, on_conflict="nickname,game_type,actual_model_name").execute()
            print("Evaluations Upsert OK")
        except Exception as e:
            print(f"Evaluations Upsert Failed: {e}")

        # Test 4: Fetch Results
        res = supabase.table('evaluations').select('*').eq('game_type', 'test_game').execute()
        print(f"Evaluations Fetch OK: Found {len(res.data)} records.")

        # Cleanup dummy data
        supabase.table('evaluations').delete().eq('nickname', 'test_user').execute()
        supabase.table('game_stats').delete().eq('game_type', 'test_game').execute()
        print("Cleanup OK")

    except Exception as e:
        print(f"DB Test Failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_db())
