"""Enrollment routes - client intake and platform enrollment workflow."""

from flask import Blueprint, render_template, redirect, url_for, request, flash
from app import db
from app.models import Client, Enrollment
from app.platforms import get_all_platforms, get_platform
from app.username_engine import generate_usernames, filter_for_platform

enrollment_bp = Blueprint("enrollment", __name__)


@enrollment_bp.route("/new", methods=["GET", "POST"])
def new_client():
    """Step 1: Collect client information."""
    if request.method == "POST":
        client = Client(
            first_name=request.form.get("first_name", "").strip(),
            last_name=request.form.get("last_name", "").strip(),
            email=request.form.get("email", "").strip(),
            phone=request.form.get("phone", "").strip(),
            bio=request.form.get("bio", "").strip(),
            home_address=request.form.get("home_address", "").strip(),
            home_city=request.form.get("home_city", "").strip(),
            home_state=request.form.get("home_state", "").strip(),
            home_zip=request.form.get("home_zip", "").strip(),
            business_name=request.form.get("business_name", "").strip(),
            business_address=request.form.get("business_address", "").strip(),
            business_city=request.form.get("business_city", "").strip(),
            business_state=request.form.get("business_state", "").strip(),
            business_zip=request.form.get("business_zip", "").strip(),
        )
        db.session.add(client)
        db.session.commit()
        return redirect(url_for("enrollment.select_platforms", client_id=client.id))

    return render_template("new_client.html")


@enrollment_bp.route("/<int:client_id>/platforms", methods=["GET", "POST"])
def select_platforms(client_id):
    """Step 2: Select platforms and pick usernames."""
    client = Client.query.get_or_404(client_id)
    platforms = get_all_platforms()

    # Generate usernames for this client
    all_usernames = generate_usernames(
        first_name=client.first_name,
        last_name=client.last_name,
        business_name=client.business_name or "",
        city=client.home_city or client.business_city or "",
    )

    # Filter per platform
    platform_usernames = {}
    for key, plat in platforms.items():
        platform_usernames[key] = filter_for_platform(all_usernames, plat["username_rules"])

    if request.method == "POST":
        selected = request.form.getlist("platforms")
        for pkey in selected:
            username = request.form.get(f"username_{pkey}", "")
            enrollment = Enrollment(
                client_id=client.id,
                platform_key=pkey,
                chosen_username=username,
                status="pending",
            )
            db.session.add(enrollment)
        db.session.commit()
        return redirect(url_for("enrollment.enroll_dashboard", client_id=client.id))

    return render_template(
        "select_platforms.html",
        client=client,
        platforms=platforms,
        platform_usernames=platform_usernames,
    )


@enrollment_bp.route("/<int:client_id>/dashboard")
def enroll_dashboard(client_id):
    """Step 3: Enrollment dashboard - sign-up links and status tracking."""
    client = Client.query.get_or_404(client_id)
    enrollments = Enrollment.query.filter_by(client_id=client.id).all()
    platforms = get_all_platforms()

    enrollment_data = []
    for e in enrollments:
        plat = platforms.get(e.platform_key, {})
        enrollment_data.append({
            "enrollment": e,
            "platform": plat,
            "platform_key": e.platform_key,
        })

    return render_template(
        "enroll_dashboard.html",
        client=client,
        enrollment_data=enrollment_data,
    )


@enrollment_bp.route("/enrollment/<int:enrollment_id>/update", methods=["POST"])
def update_enrollment(enrollment_id):
    """Update enrollment status."""
    enrollment = Enrollment.query.get_or_404(enrollment_id)
    enrollment.status = request.form.get("status", enrollment.status)
    enrollment.profile_url = request.form.get("profile_url", enrollment.profile_url)
    enrollment.notes = request.form.get("notes", enrollment.notes)
    db.session.commit()
    return redirect(url_for("enrollment.enroll_dashboard", client_id=enrollment.client_id))


@enrollment_bp.route("/clients")
def client_list():
    """List all clients."""
    clients = Client.query.order_by(Client.created_at.desc()).all()
    return render_template("clients.html", clients=clients)


@enrollment_bp.route("/<int:client_id>/delete", methods=["POST"])
def delete_client(client_id):
    """Delete a client and their enrollments."""
    client = Client.query.get_or_404(client_id)
    Enrollment.query.filter_by(client_id=client.id).delete()
    db.session.delete(client)
    db.session.commit()
    flash("Client deleted.", "info")
    return redirect(url_for("enrollment.client_list"))
