"""
Database models and helpers for Fitness Pose Detection application.
Uses SQLite for zero-configuration, robust persistence.
"""
import sqlite3
import os
import hashlib
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fitness_app.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            fitness_goal TEXT DEFAULT 'General Fitness',
            fitness_level TEXT DEFAULT 'Beginner',
            streak_days INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Workout Sessions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS workout_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            exercise_type TEXT NOT NULL,
            total_reps INTEGER DEFAULT 0,
            accuracy_score REAL DEFAULT 0.0,
            calories_burned REAL DEFAULT 0.0,
            duration_seconds INTEGER DEFAULT 0,
            incorrect_form_count INTEGER DEFAULT 0,
            notes TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Create a default demo user if not present
    cursor.execute('SELECT * FROM users WHERE username = ?', ('alex_fit',))
    if not cursor.fetchone():
        demo_pwd_hash = hash_password('fitness123')
        cursor.execute('''
            INSERT INTO users (username, email, password_hash, full_name, fitness_goal, fitness_level, streak_days)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', ('alex_fit', 'alex@fitpose.ai', demo_pwd_hash, 'Alex Rivera', 'Muscle Building & Form', 'Intermediate', 5))
        
        # Add sample past workout session for demonstration
        user_id = cursor.lastrowid
        cursor.execute('''
            INSERT INTO workout_sessions (user_id, exercise_type, total_reps, accuracy_score, calories_burned, duration_seconds, incorrect_form_count, notes)
            VALUES 
            (?, 'squats', 25, 92.4, 48.5, 300, 2, 'Great knee depth! Keep chest upright.'),
            (?, 'pushups', 18, 88.0, 32.0, 210, 4, 'Watch hip alignment on rep 12.'),
            (?, 'bicep_curls', 30, 96.0, 42.0, 270, 1, 'Perfect elbow stability!')
        ''', (user_id, user_id, user_id))

    # Ensure guest athlete exists
    cursor.execute('SELECT * FROM users WHERE id = 9999')
    if not cursor.fetchone():
        cursor.execute('''
            INSERT OR IGNORE INTO users (id, username, email, password_hash, full_name, fitness_goal, fitness_level, streak_days)
            VALUES (9999, 'guest_athlete', 'guest@fitpose.ai', 'guest_demo_hash', 'Champion Athlete', 'Posture & Form Mastery', 'Intermediate', 1)
        ''')
    
    conn.commit()
    conn.close()
    print("Database initialized successfully at:", DB_PATH)

if __name__ == '__main__':
    init_db()
