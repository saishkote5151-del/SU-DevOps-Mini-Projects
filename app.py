from datetime import datetime, timedelta
import sqlite3

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS


app = Flask(__name__)
CORS(app)

DATABASE = "library.db"


def get_connection():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database():
    connection = get_connection()

    connection.execute("""
        CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Available'
        )
    """)

    connection.execute("""
        CREATE TABLE IF NOT EXISTS members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            role TEXT NOT NULL
        )
    """)

    connection.execute("""
        CREATE TABLE IF NOT EXISTS loans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book_id INTEGER NOT NULL,
            member_id INTEGER NOT NULL,
            issue_date TEXT NOT NULL,
            due_date TEXT NOT NULL,
            return_date TEXT,
            FOREIGN KEY (book_id) REFERENCES books(id),
            FOREIGN KEY (member_id) REFERENCES members(id)
        )
    """)

    book_count = connection.execute(
        "SELECT COUNT(*) FROM books"
    ).fetchone()[0]

    if book_count == 0:
        connection.executemany(
            "INSERT INTO books (title, author, status) VALUES (?, ?, ?)",
            [
                ("Deep Work", "Cal Newport", "Available"),
                ("Clean Code", "Robert C. Martin", "Available"),
                ("Atomic Habits", "James Clear", "On loan"),
                (
                    "The Design of Everyday Things",
                    "Don Norman",
                    "Available"
                )
            ]
        )

    connection.commit()
    connection.close()


@app.route("/")
def home():
    return send_from_directory(".", "index.html")


@app.route("/<path:filename>")
def frontend_files(filename):
    return send_from_directory(".", filename)


@app.route("/health")
def health():
    return jsonify({
        "status": "healthy",
        "service": "smart-library-management"
    })


@app.route("/api/books", methods=["GET"])
def get_books():
    connection = get_connection()

    books = connection.execute(
        "SELECT * FROM books ORDER BY id DESC"
    ).fetchall()

    connection.close()

    return jsonify([dict(book) for book in books])


@app.route("/api/books", methods=["POST"])
def add_book():
    data = request.get_json() or {}

    title = data.get("title", "").strip()
    author = data.get("author", "").strip()
    status = data.get("status", "Available").strip()

    if not title or not author:
        return jsonify({
            "error": "Book title and author are required"
        }), 400

    connection = get_connection()

    connection.execute(
        "INSERT INTO books (title, author, status) VALUES (?, ?, ?)",
        (title, author, status)
    )

    connection.commit()
    connection.close()

    return jsonify({
        "message": "Book added successfully"
    }), 201


@app.route("/api/members", methods=["GET"])
def get_members():
    connection = get_connection()

    members = connection.execute(
        "SELECT * FROM members ORDER BY id DESC"
    ).fetchall()

    connection.close()

    return jsonify([dict(member) for member in members])


@app.route("/api/members", methods=["POST"])
def add_member():
    data = request.get_json() or {}

    name = data.get("name", "").strip()
    role = data.get("role", "Student").strip()

    if not name:
        return jsonify({
            "error": "Member name is required"
        }), 400

    connection = get_connection()

    connection.execute(
        "INSERT INTO members (name, role) VALUES (?, ?)",
        (name, role)
    )

    connection.commit()
    connection.close()

    return jsonify({
        "message": "Member added successfully"
    }), 201


@app.route("/api/loans", methods=["GET"])
def get_loans():
    connection = get_connection()

    loans = connection.execute("""
        SELECT
            loans.id,
            loans.issue_date,
            loans.due_date,
            books.title AS book_title,
            books.author AS book_author,
            members.name AS member_name
        FROM loans
        JOIN books ON loans.book_id = books.id
        JOIN members ON loans.member_id = members.id
        WHERE loans.return_date IS NULL
        ORDER BY loans.id DESC
    """).fetchall()

    connection.close()

    return jsonify([dict(loan) for loan in loans])


@app.route("/api/loans", methods=["POST"])
def issue_book():
    data = request.get_json() or {}

    book_id = data.get("book_id")
    member_id = data.get("member_id")

    if not book_id or not member_id:
        return jsonify({
            "error": "Book and member are required"
        }), 400

    connection = get_connection()

    book = connection.execute(
        "SELECT * FROM books WHERE id = ?",
        (book_id,)
    ).fetchone()

    member = connection.execute(
        "SELECT * FROM members WHERE id = ?",
        (member_id,)
    ).fetchone()

    if not book or not member:
        connection.close()

        return jsonify({
            "error": "Book or member not found"
        }), 404

    if book["status"] != "Available":
        connection.close()

        return jsonify({
            "error": "This book is not available"
        }), 400

    issue_date = datetime.now().strftime("%Y-%m-%d")
    due_date = (
        datetime.now() + timedelta(days=14)
    ).strftime("%Y-%m-%d")

    connection.execute("""
        INSERT INTO loans (
            book_id,
            member_id,
            issue_date,
            due_date
        )
        VALUES (?, ?, ?, ?)
    """, (
        book_id,
        member_id,
        issue_date,
        due_date
    ))

    connection.execute(
        "UPDATE books SET status = 'On loan' WHERE id = ?",
        (book_id,)
    )

    connection.commit()
    connection.close()

    return jsonify({
        "message": "Book issued successfully",
        "due_date": due_date
    }), 201


@app.route("/api/loans/<int:loan_id>/return", methods=["PUT"])
def return_book(loan_id):
    connection = get_connection()

    loan = connection.execute("""
        SELECT * FROM loans
        WHERE id = ? AND return_date IS NULL
    """, (loan_id,)).fetchone()

    if not loan:
        connection.close()

        return jsonify({
            "error": "Active loan not found"
        }), 404

    connection.execute("""
        UPDATE loans
        SET return_date = ?
        WHERE id = ?
    """, (
        datetime.now().strftime("%Y-%m-%d"),
        loan_id
    ))

    connection.execute(
        "UPDATE books SET status = 'Available' WHERE id = ?",
        (loan["book_id"],)
    )

    connection.commit()
    connection.close()

    return jsonify({
        "message": "Book returned successfully"
    })


@app.route("/api/dashboard", methods=["GET"])
def get_dashboard():
    connection = get_connection()

    total_books = connection.execute(
        "SELECT COUNT(*) FROM books"
    ).fetchone()[0]

    total_members = connection.execute(
        "SELECT COUNT(*) FROM members"
    ).fetchone()[0]

    active_loans = connection.execute("""
        SELECT COUNT(*) FROM loans
        WHERE return_date IS NULL
    """).fetchone()[0]

    overdue_books = connection.execute("""
        SELECT COUNT(*) FROM loans
        WHERE return_date IS NULL
        AND due_date < date('now')
    """).fetchone()[0]

    connection.close()

    return jsonify({
        "total_books": total_books,
        "total_members": total_members,
        "active_loans": active_loans,
        "overdue_books": overdue_books
    })


if __name__ == "__main__":
    initialize_database()

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=False
  )
