"""Main routes - dashboard and landing page."""

from flask import Blueprint, render_template
from app.models import Client, Enrollment

main_bp = Blueprint("main", __name__)


@main_bp.route("/")
def index():
    """Landing page / dashboard."""
    total_clients = Client.query.count()
    total_enrollments = Enrollment.query.count()
    completed = Enrollment.query.filter_by(status="completed").count()
    pending = Enrollment.query.filter_by(status="pending").count()
    in_progress = Enrollment.query.filter_by(status="in_progress").count()
    recent_clients = Client.query.order_by(Client.created_at.desc()).limit(10).all()

    return render_template(
        "dashboard.html",
        total_clients=total_clients,
        total_enrollments=total_enrollments,
        completed=completed,
        pending=pending,
        in_progress=in_progress,
        recent_clients=recent_clients,
    )
