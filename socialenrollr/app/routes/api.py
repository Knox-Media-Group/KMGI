"""JSON API routes for username generation and platform data."""

from flask import Blueprint, request, jsonify
from app.username_engine import generate_usernames, filter_for_platform
from app.platforms import get_all_platforms, get_platform_list

api_bp = Blueprint("api", __name__)


@api_bp.route("/platforms")
def list_platforms():
    """Get all supported platforms."""
    return jsonify(get_platform_list())


@api_bp.route("/generate-usernames", methods=["POST"])
def api_generate_usernames():
    """Generate username suggestions from user data."""
    data = request.get_json() or {}
    first = data.get("first_name", "")
    last = data.get("last_name", "")
    business = data.get("business_name", "")
    city = data.get("city", "")

    if not first or not last:
        return jsonify({"error": "first_name and last_name are required"}), 400

    usernames = generate_usernames(first, last, business, city)

    # Optionally filter for a specific platform
    platform_key = data.get("platform")
    if platform_key:
        plat = get_all_platforms().get(platform_key)
        if plat:
            usernames = filter_for_platform(usernames, plat["username_rules"])

    return jsonify({"usernames": usernames, "count": len(usernames)})


@api_bp.route("/health")
def health():
    return jsonify({"status": "ok", "service": "SocialEnrollr API"})
