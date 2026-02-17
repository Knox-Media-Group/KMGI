"""
Username Generation Engine
Generates smart username variations from user profile data.
"""

import re
import itertools


def clean(text):
    """Remove non-alphanumeric chars and lowercase."""
    return re.sub(r"[^a-z0-9]", "", text.lower().strip())


def generate_usernames(first_name, last_name, business_name="", city="", **kwargs):
    """
    Generate a ranked list of username candidates.

    Returns list of dicts: [{"username": "...", "style": "..."}, ...]
    """
    first = clean(first_name)
    last = clean(last_name)
    biz = clean(business_name)
    loc = clean(city)

    if not first or not last:
        return []

    candidates = []

    def add(username, style):
        u = username.strip().lower()
        if u and len(u) >= 3 and u not in seen:
            seen.add(u)
            candidates.append({"username": u, "style": style})

    seen = set()

    # --- Core name combinations ---
    add(f"{first}{last}", "Full name")
    add(f"{first}.{last}", "First.Last")
    add(f"{first}_{last}", "First_Last")
    add(f"{first}-{last}", "First-Last")
    add(f"{last}{first}", "LastFirst")
    add(f"{first}{last[0]}", "First + Last initial")
    add(f"{first[0]}{last}", "First initial + Last")
    add(f"{first}{last[:3]}", "First + Last prefix")

    # --- With numbers ---
    for suffix in ["1", "01", "99", "2024", "2025", "2026"]:
        add(f"{first}{last}{suffix}", f"Full name + {suffix}")
    add(f"{first}{last}official", "Official tag")
    add(f"the{first}{last}", "The prefix")
    add(f"real{first}{last}", "Real prefix")
    add(f"its{first}{last}", "Its prefix")
    add(f"im{first}{last}", "Im prefix")

    # --- Business-based ---
    if biz:
        add(biz, "Business name")
        add(f"{biz}official", "Business official")
        add(f"{biz}hq", "Business HQ")
        add(f"the{biz}", "The + Business")
        add(f"{first}{biz}", "First + Business")
        add(f"{biz}{loc}", "Business + City")
        add(f"{first}at{biz}", "First at Business")
        add(f"{biz}.{loc}", "Business.City")
        add(f"{biz}_{loc}", "Business_City")

    # --- Location-based ---
    if loc:
        add(f"{first}{loc}", "First + City")
        add(f"{first}.{loc}", "First.City")
        add(f"{first}{last}{loc}", "FullName + City")
        add(f"{last}{loc}", "Last + City")

    # --- Professional ---
    add(f"{first}{last}pro", "Pro tag")
    add(f"{first}{last}biz", "Biz tag")
    add(f"{first}{last}media", "Media tag")
    add(f"{first}{last}digital", "Digital tag")

    # --- Creative abbreviations ---
    if len(first) >= 2 and len(last) >= 2:
        add(f"{first[:2]}{last[:2]}", "Abbreviation")
        add(f"{first[:3]}{last[:3]}", "Short form")

    # --- Initials ---
    initials = f"{first[0]}{last[0]}"
    add(f"{initials}{biz}" if biz else f"{initials}{loc}", "Initials + context")

    return candidates


def filter_for_platform(candidates, platform_rules):
    """
    Filter usernames based on platform-specific rules.

    platform_rules: dict with keys like:
        - min_length: int
        - max_length: int
        - allowed_chars: regex pattern string
        - no_dots: bool
        - no_dashes: bool
    """
    filtered = []
    min_len = platform_rules.get("min_length", 1)
    max_len = platform_rules.get("max_length", 30)
    no_dots = platform_rules.get("no_dots", False)
    no_dashes = platform_rules.get("no_dashes", False)
    no_underscores = platform_rules.get("no_underscores", False)
    allowed_pattern = platform_rules.get("allowed_chars", r"^[a-z0-9._\-]+$")

    for c in candidates:
        u = c["username"]
        if len(u) < min_len or len(u) > max_len:
            continue
        if no_dots and "." in u:
            continue
        if no_dashes and "-" in u:
            continue
        if no_underscores and "_" in u:
            continue
        if not re.match(allowed_pattern, u):
            continue
        filtered.append(c)

    return filtered
