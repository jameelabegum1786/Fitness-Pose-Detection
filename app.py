"""
Flask Web Application for Fitness Pose Detection & Real-Time Form Correction.
Provides REST APIs for authentication, time-based greetings, and workout logging,
along with serving the responsive web UI.
"""
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_cors import CORS
import datetime
import os
import sqlite3
import random
from models import get_db_connection, hash_password, init_db

app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.urandom(24).hex()
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
CORS(app)

@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

# Pre-defined motivational fitness quotes
FITNESS_QUOTES = [
    "Form is everything: accurate movement builds real strength.",
    "Your only limit is you. Perfect every single repetition!",
    "Small daily improvements over time lead to stunning results.",
    "Focus on quality over quantity — control the movement.",
    "Breathe, align, and conquer your fitness goals today.",
    "Consistency is what transforms average into excellence.",
    "Check your posture, ignite your energy, and push forward!"
]

def get_time_greeting():
    """Generates greeting and contextual emoji based on current local hour."""
    now = datetime.datetime.now()
    hour = now.hour
    
    if 5 <= hour < 12:
        greeting = "Good morning"
        icon = "🌅"
        subtext = "Start your day with energy and perfect form!"
    elif 12 <= hour < 17:
        greeting = "Good afternoon"
        icon = "☀️"
        subtext = "Recharge your day with a high-energy workout session."
    elif 17 <= hour < 22:
        greeting = "Good evening"
        icon = "🌆"
        subtext = "Unwind, de-stress, and power through your evening routine."
    else:
        greeting = "Good night / Late Session"
        icon = "🌙"
        subtext = "Night owl grind! Stay focused and stay safe."

    formatted_time = now.strftime("%I:%M:%S %p")
    formatted_date = now.strftime("%A, %B %d, %Y")
    
    return {
        "greeting": greeting,
        "icon": icon,
        "subtext": subtext,
        "time": formatted_time,
        "date": formatted_date,
        "hour": hour,
        "quote": random.choice(FITNESS_QUOTES)
    }

@app.route('/')
def index():
    """Render the main fitness application UI (requires login first)."""
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    return render_template('index.html')

@app.route('/login')
def login_page():
    """Render the dedicated login and registration UI (always accessible first)."""
    return render_template('login.html')

@app.route('/api/time-greeting', methods=['GET'])
def api_time_greeting():
    """Endpoint returning live greeting, formatted time, and motivational message."""
    return jsonify(get_time_greeting())

@app.route('/api/auth/register', methods=['POST'])
def api_register():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')
    full_name = data.get('full_name', '').strip() or username
    fitness_goal = data.get('fitness_goal', 'General Fitness')
    fitness_level = data.get('fitness_level', 'Beginner')

    if not username or not email or not password:
        return jsonify({"success": False, "error": "Username, email, and password are required."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        pwd_hash = hash_password(password)
        cursor.execute('''
            INSERT INTO users (username, email, password_hash, full_name, fitness_goal, fitness_level, streak_days)
            VALUES (?, ?, ?, ?, ?, ?, 1)
        ''', (username, email, pwd_hash, full_name, fitness_goal, fitness_level))
        conn.commit()
        user_id = cursor.lastrowid
        user = {
            "id": user_id,
            "username": username,
            "email": email,
            "full_name": full_name,
            "fitness_goal": fitness_goal,
            "fitness_level": fitness_level,
            "streak_days": 1
        }
        session['user_id'] = user_id
        return jsonify({"success": True, "user": user, "message": f"Welcome aboard, {full_name}!"})
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "error": "Username or email already exists."}), 409
    finally:
        conn.close()

@app.route('/api/auth/login', methods=['POST'])
def api_login():
    data = request.get_json() or {}
    username_or_email = data.get('username_or_email', '').strip()
    password = data.get('password', '')

    if not username_or_email or not password:
        return jsonify({"success": False, "error": "Please provide your login credentials."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    pwd_hash = hash_password(password)
    
    cursor.execute('''
        SELECT id, username, email, full_name, fitness_goal, fitness_level, streak_days
        FROM users
        WHERE (username = ? OR email = ?) AND password_hash = ?
    ''', (username_or_email, username_or_email, pwd_hash))
    user_row = cursor.fetchone()

    if not user_row:
        conn.close()
        return jsonify({"success": False, "error": "Invalid username/email or password."}), 401

    user = dict(user_row)
    # Update last login time
    cursor.execute('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', (user['id'],))
    conn.commit()
    conn.close()

    session['user_id'] = user['id']
    return jsonify({"success": True, "user": user, "message": f"Welcome back, {user['full_name']}!"})

@app.route('/api/auth/guest', methods=['POST'])
def api_guest_login():
    """Quick 1-click guest login for instant test & demo."""
    guest_user = {
        "id": 9999,
        "username": "guest_athlete",
        "email": "guest@fitpose.ai",
        "full_name": "Champion Athlete",
        "fitness_goal": "Posture & Form Mastery",
        "fitness_level": "Intermediate",
        "streak_days": 3,
        "is_guest": True
    }
    session['user_id'] = 9999
    return jsonify({"success": True, "user": guest_user, "message": "Logged in as Guest Athlete!"})

@app.route('/api/auth/logout', methods=['POST', 'GET'])
def api_logout():
    session.clear()
    if request.method == 'GET':
        return redirect(url_for('login_page'))
    return jsonify({"success": True, "message": "Logged out successfully."})

@app.route('/api/user/profile', methods=['GET'])
def api_user_profile():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"success": False, "error": "Not authenticated"}), 401

    conn = get_db_connection()
    cursor = conn.cursor()

    if user_id == 9999:
        cursor.execute('''
            SELECT 
                COUNT(*) as total_workouts,
                COALESCE(SUM(total_reps), 0) as total_reps,
                COALESCE(SUM(calories_burned), 0) as total_calories,
                COALESCE(AVG(accuracy_score), 0) as avg_accuracy
            FROM workout_sessions WHERE user_id = 9999
        ''')
        stats = cursor.fetchone()
        conn.close()

        total_w = stats['total_workouts'] if stats else 0
        return jsonify({
            "success": True,
            "user": {
                "id": 9999,
                "username": "guest_athlete",
                "email": "guest@fitpose.ai",
                "full_name": "Champion Athlete",
                "fitness_goal": "Posture & Form Mastery",
                "fitness_level": "Intermediate",
                "streak_days": 1 if total_w > 0 else 0,
                "is_guest": True
            },
            "stats": {
                "total_workouts": total_w,
                "total_reps": stats['total_reps'] if stats else 0,
                "total_calories": round(stats['total_calories'], 1) if stats else 0.0,
                "avg_accuracy": round(stats['avg_accuracy'], 1) if stats else 0.0
            }
        })

    cursor.execute('''
        SELECT id, username, email, full_name, fitness_goal, fitness_level, streak_days
        FROM users WHERE id = ?
    ''', (user_id,))
    user = cursor.fetchone()

    # Real workout totals for this specific user
    cursor.execute('''
        SELECT 
            COUNT(*) as total_workouts,
            COALESCE(SUM(total_reps), 0) as total_reps,
            COALESCE(SUM(calories_burned), 0) as total_calories,
            COALESCE(AVG(CASE WHEN total_reps > 0 OR exercise_type = 'plank' THEN accuracy_score ELSE NULL END), 0) as avg_accuracy
        FROM workout_sessions WHERE user_id = ?
    ''', (user_id,))
    stats = cursor.fetchone()
    conn.close()

    total_w = stats['total_workouts'] if stats else 0
    avg_acc = round(stats['avg_accuracy'], 1) if (stats and total_w > 0) else 0.0

    if user:
        user_dict = dict(user)
        # If user has not completed any workouts, streak is 0
        if total_w == 0:
            user_dict['streak_days'] = 0
    else:
        user_dict = {
            "id": user_id,
            "username": "athlete",
            "full_name": "Athlete",
            "fitness_goal": "General Fitness",
            "fitness_level": "Intermediate",
            "streak_days": 0
        }

    return jsonify({
        "success": True,
        "user": user_dict,
        "stats": {
            "total_workouts": total_w,
            "total_reps": stats['total_reps'] if stats else 0,
            "total_calories": round(stats['total_calories'], 1) if stats else 0.0,
            "avg_accuracy": avg_acc
        }
    })

@app.route('/api/workouts/save', methods=['POST'])
def api_save_workout():
    data = request.get_json() or {}
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"success": False, "error": "Not authenticated"}), 401

    exercise_type = data.get('exercise_type', 'squats')
    total_reps = int(data.get('total_reps', 0))
    accuracy_score = float(data.get('accuracy_score', 0.0))
    calories_burned = float(data.get('calories_burned', 0.0))
    duration_seconds = int(data.get('duration_seconds', 0))
    incorrect_form_count = int(data.get('incorrect_form_count', 0))
    notes = data.get('notes', '')

    if total_reps <= 0 and exercise_type != 'plank':
        return jsonify({"success": False, "error": "Cannot save workout with 0 completed repetitions."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO workout_sessions 
        (user_id, exercise_type, total_reps, accuracy_score, calories_burned, duration_seconds, incorrect_form_count, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (user_id, exercise_type, total_reps, accuracy_score, calories_burned, duration_seconds, incorrect_form_count, notes))

    # If valid reps done, increment streak
    if total_reps > 0 and user_id != 9999:
        cursor.execute('''
            UPDATE users 
            SET streak_days = CASE WHEN streak_days = 0 THEN 1 ELSE streak_days + 1 END,
                last_login = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (user_id,))

    conn.commit()
    session_id = cursor.lastrowid
    conn.close()

    return jsonify({
        "success": True,
        "session_id": session_id,
        "message": "Workout session logged successfully!"
    })

@app.route('/api/workouts/history', methods=['GET'])
def api_workout_history():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"success": True, "history": []})

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, exercise_type, total_reps, accuracy_score, calories_burned, duration_seconds, incorrect_form_count, notes, created_at
        FROM workout_sessions
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 20
    ''', (user_id,))
    rows = cursor.fetchall()
    conn.close()

    history = [dict(row) for row in rows]
    return jsonify({"success": True, "history": history})

import sys
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

if __name__ == '__main__':
    init_db()
    # Run the server on port 5000
    print("=" * 60)
    print("Fitness Pose Detection App Server starting...")
    print("Login Page: http://127.0.0.1:5000/login")
    print("Main App:   http://127.0.0.1:5000/")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5000, debug=False)

