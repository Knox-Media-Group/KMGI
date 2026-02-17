"""
Social Media Platform Definitions
Each platform includes sign-up URL, username rules, and icon info.
"""

PLATFORMS = {
    "facebook": {
        "name": "Facebook",
        "icon": "fab fa-facebook",
        "color": "#1877f2",
        "signup_url": "https://www.facebook.com/r.php",
        "profile_url_template": "https://facebook.com/{username}",
        "username_rules": {
            "min_length": 5,
            "max_length": 50,
            "allowed_chars": r"^[a-z0-9.]+$",
            "no_dashes": True,
            "no_underscores": True,
        },
        "fields_needed": ["first_name", "last_name", "email", "phone"],
        "description": "World's largest social network. Great for personal and business pages.",
    },
    "instagram": {
        "name": "Instagram",
        "icon": "fab fa-instagram",
        "color": "#e4405f",
        "signup_url": "https://www.instagram.com/accounts/emailsignup/",
        "profile_url_template": "https://instagram.com/{username}",
        "username_rules": {
            "min_length": 1,
            "max_length": 30,
            "allowed_chars": r"^[a-z0-9._]+$",
            "no_dashes": True,
        },
        "fields_needed": ["first_name", "last_name", "email", "phone"],
        "description": "Photo and video sharing platform. Essential for visual branding.",
    },
    "twitter": {
        "name": "X (Twitter)",
        "icon": "fab fa-x-twitter",
        "color": "#000000",
        "signup_url": "https://x.com/i/flow/signup",
        "profile_url_template": "https://x.com/{username}",
        "username_rules": {
            "min_length": 4,
            "max_length": 15,
            "allowed_chars": r"^[a-z0-9_]+$",
            "no_dots": True,
            "no_dashes": True,
        },
        "fields_needed": ["first_name", "last_name", "email", "phone"],
        "description": "Microblogging platform. Key for news, networking, and brand voice.",
    },
    "linkedin": {
        "name": "LinkedIn",
        "icon": "fab fa-linkedin",
        "color": "#0a66c2",
        "signup_url": "https://www.linkedin.com/signup",
        "profile_url_template": "https://linkedin.com/in/{username}",
        "username_rules": {
            "min_length": 3,
            "max_length": 100,
            "allowed_chars": r"^[a-z0-9\-]+$",
            "no_dots": True,
            "no_underscores": True,
        },
        "fields_needed": ["first_name", "last_name", "email"],
        "description": "Professional networking. Must-have for B2B and career branding.",
    },
    "tiktok": {
        "name": "TikTok",
        "icon": "fab fa-tiktok",
        "color": "#000000",
        "signup_url": "https://www.tiktok.com/signup",
        "profile_url_template": "https://tiktok.com/@{username}",
        "username_rules": {
            "min_length": 2,
            "max_length": 24,
            "allowed_chars": r"^[a-z0-9._]+$",
            "no_dashes": True,
        },
        "fields_needed": ["first_name", "last_name", "email", "phone"],
        "description": "Short-form video platform. Massive reach for all demographics.",
    },
    "youtube": {
        "name": "YouTube",
        "icon": "fab fa-youtube",
        "color": "#ff0000",
        "signup_url": "https://www.youtube.com/create_channel",
        "profile_url_template": "https://youtube.com/@{username}",
        "username_rules": {
            "min_length": 3,
            "max_length": 30,
            "allowed_chars": r"^[a-z0-9._\-]+$",
        },
        "fields_needed": ["first_name", "last_name", "email"],
        "description": "Video platform. Essential for long-form content and tutorials.",
    },
    "pinterest": {
        "name": "Pinterest",
        "icon": "fab fa-pinterest",
        "color": "#bd081c",
        "signup_url": "https://www.pinterest.com/",
        "profile_url_template": "https://pinterest.com/{username}",
        "username_rules": {
            "min_length": 3,
            "max_length": 30,
            "allowed_chars": r"^[a-z0-9]+$",
            "no_dots": True,
            "no_dashes": True,
            "no_underscores": True,
        },
        "fields_needed": ["first_name", "last_name", "email"],
        "description": "Visual discovery engine. Great for products, design, and lifestyle.",
    },
    "threads": {
        "name": "Threads",
        "icon": "fab fa-threads",
        "color": "#000000",
        "signup_url": "https://www.threads.net/",
        "profile_url_template": "https://threads.net/@{username}",
        "username_rules": {
            "min_length": 1,
            "max_length": 30,
            "allowed_chars": r"^[a-z0-9._]+$",
            "no_dashes": True,
        },
        "fields_needed": ["first_name", "last_name", "email"],
        "description": "Meta's text-based conversation app. Linked to Instagram.",
    },
    "snapchat": {
        "name": "Snapchat",
        "icon": "fab fa-snapchat",
        "color": "#fffc00",
        "signup_url": "https://accounts.snapchat.com/accounts/v2/signup",
        "profile_url_template": "https://snapchat.com/add/{username}",
        "username_rules": {
            "min_length": 3,
            "max_length": 15,
            "allowed_chars": r"^[a-z0-9._\-]+$",
        },
        "fields_needed": ["first_name", "last_name", "email", "phone"],
        "description": "Ephemeral messaging with Stories. Popular with younger audiences.",
    },
    "github": {
        "name": "GitHub",
        "icon": "fab fa-github",
        "color": "#333333",
        "signup_url": "https://github.com/signup",
        "profile_url_template": "https://github.com/{username}",
        "username_rules": {
            "min_length": 1,
            "max_length": 39,
            "allowed_chars": r"^[a-z0-9\-]+$",
            "no_dots": True,
            "no_underscores": True,
        },
        "fields_needed": ["first_name", "last_name", "email"],
        "description": "Developer platform. Good for tech businesses and open source.",
    },
    "reddit": {
        "name": "Reddit",
        "icon": "fab fa-reddit",
        "color": "#ff4500",
        "signup_url": "https://www.reddit.com/register/",
        "profile_url_template": "https://reddit.com/user/{username}",
        "username_rules": {
            "min_length": 3,
            "max_length": 20,
            "allowed_chars": r"^[a-z0-9_\-]+$",
            "no_dots": True,
        },
        "fields_needed": ["email"],
        "description": "Community discussion platform. Great for niche engagement.",
    },
    "tumblr": {
        "name": "Tumblr",
        "icon": "fab fa-tumblr",
        "color": "#36465d",
        "signup_url": "https://www.tumblr.com/register",
        "profile_url_template": "https://{username}.tumblr.com",
        "username_rules": {
            "min_length": 1,
            "max_length": 32,
            "allowed_chars": r"^[a-z0-9\-]+$",
            "no_dots": True,
            "no_underscores": True,
        },
        "fields_needed": ["email"],
        "description": "Microblogging and social networking. Creative communities.",
    },
    "google_business": {
        "name": "Google Business",
        "icon": "fab fa-google",
        "color": "#4285f4",
        "signup_url": "https://business.google.com/create",
        "profile_url_template": "",
        "username_rules": {
            "min_length": 3,
            "max_length": 100,
            "allowed_chars": r"^[a-z0-9._ \-]+$",
        },
        "fields_needed": ["first_name", "last_name", "email", "phone", "business_address"],
        "description": "Essential for local SEO. Shows your business on Google Maps.",
    },
    "yelp": {
        "name": "Yelp",
        "icon": "fab fa-yelp",
        "color": "#d32323",
        "signup_url": "https://biz.yelp.com/signup_business/new",
        "profile_url_template": "",
        "username_rules": {
            "min_length": 3,
            "max_length": 50,
            "allowed_chars": r"^[a-z0-9._\-]+$",
        },
        "fields_needed": ["first_name", "last_name", "email", "phone", "business_address"],
        "description": "Business review platform. Critical for local businesses.",
    },
    "nextdoor": {
        "name": "Nextdoor",
        "icon": "fas fa-house-chimney",
        "color": "#8ed500",
        "signup_url": "https://nextdoor.com/join/",
        "profile_url_template": "",
        "username_rules": {
            "min_length": 2,
            "max_length": 50,
            "allowed_chars": r"^[a-z0-9._ \-]+$",
        },
        "fields_needed": ["first_name", "last_name", "email", "home_address"],
        "description": "Neighborhood social network. Great for local businesses.",
    },
    "bluesky": {
        "name": "Bluesky",
        "icon": "fas fa-cloud",
        "color": "#0085ff",
        "signup_url": "https://bsky.app/",
        "profile_url_template": "https://bsky.app/profile/{username}.bsky.social",
        "username_rules": {
            "min_length": 3,
            "max_length": 20,
            "allowed_chars": r"^[a-z0-9\-]+$",
            "no_dots": True,
            "no_underscores": True,
        },
        "fields_needed": ["first_name", "last_name", "email"],
        "description": "Decentralized social network. Growing alternative platform.",
    },
}


def get_platform(key):
    return PLATFORMS.get(key)


def get_all_platforms():
    return PLATFORMS


def get_platform_list():
    """Return platforms as a list with keys included."""
    return [{"key": k, **v} for k, v in PLATFORMS.items()]
