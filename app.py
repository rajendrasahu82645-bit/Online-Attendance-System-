import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
from database import create_tables
from datetime import datetime

# Set the static folder to the 'fontant' directory
app = Flask(__name__, static_folder='../fontant', static_url_path='')
CORS(app)  # Enable CORS for all routes

DATABASE = "attendance.db"

# Initialize DB
create_tables()

# -----------------------
# Serve Frontend
# -----------------------
@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')


def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


# -----------------------
# Add Student
# -----------------------
@app.route('/add_student', methods=['POST'])
@app.route('/students', methods=['POST']) # Added alias for consistency with frontend
def add_student():
    data = request.get_json()

    name = data.get("name")
    roll_number = data.get("roll_number") or data.get("roll") # Handle both naming conventions
    department = data.get("department", "General") # Default to General if missing

    if not name or not roll_number:
        return jsonify({"error": "Name and roll number are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "INSERT INTO students (name, roll_number, department) VALUES (?, ?, ?)",
            (name, roll_number, department)
        )
        conn.commit()
        return jsonify({"message": "Student added successfully"}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "Roll number already exists"}), 400
    finally:
        conn.close()


# -----------------------
# Mark Attendance
# -----------------------
@app.route('/mark_attendance', methods=['POST'])
@app.route('/attendance', methods=['POST']) # Added alias for consistency with frontend
def mark_attendance():
    data = request.get_json()

    roll_number = data.get("roll_number") or data.get("roll")
    student_id = data.get("student_id") or data.get("student")
    date = data.get("date") or datetime.now().strftime("%Y-%m-%d")
    status = data.get("status")

    if not (roll_number or student_id) or not status:
        return jsonify({"error": "Missing required fields"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    if student_id:
        cursor.execute("SELECT id FROM students WHERE id = ?", (student_id,))
    else:
        cursor.execute("SELECT id FROM students WHERE roll_number = ?", (roll_number,))
    
    student = cursor.fetchone()

    if not student:
        return jsonify({"error": "Student not found"}), 404

    cursor.execute(
        "INSERT INTO attendance (student_id, date, status) VALUES (?, ?, ?)",
        (student["id"], date, status)
    )
    conn.commit()
    conn.close()

    return jsonify({"message": "Attendance marked successfully"}), 201


# -----------------------
# Get All Students
# -----------------------
@app.route('/students', methods=['GET'])
def get_students():
    conn = get_db_connection()
    students = conn.execute("SELECT * FROM students").fetchall()
    conn.close()

    return jsonify([dict(student) for student in students])


# -----------------------
# Get Attendance Report
# -----------------------
@app.route('/attendance', methods=['GET'])
def get_attendance():
    conn = get_db_connection()
    records = conn.execute("""
        SELECT students.name, students.roll_number, attendance.date, attendance.status
        FROM attendance
        JOIN students ON attendance.student_id = students.id
    """).fetchall()
    conn.close()

    return jsonify([dict(record) for record in records])


if __name__ == "__main__":
    app.run(debug=True, port=5000)
