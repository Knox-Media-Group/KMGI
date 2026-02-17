import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """White-label configuration - all customizable via .env"""

    # App
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:///socialenrollr.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Branding
    APP_NAME = os.getenv("APP_NAME", "SocialEnrollr")
    APP_TAGLINE = os.getenv("APP_TAGLINE", "Smart Social Media Enrollment Platform")
    APP_LOGO_URL = os.getenv("APP_LOGO_URL", "")
    APP_FAVICON_URL = os.getenv("APP_FAVICON_URL", "")

    # Colors
    PRIMARY_COLOR = os.getenv("PRIMARY_COLOR", "#2563eb")
    SECONDARY_COLOR = os.getenv("SECONDARY_COLOR", "#7c3aed")
    ACCENT_COLOR = os.getenv("ACCENT_COLOR", "#06b6d4")
    BACKGROUND_COLOR = os.getenv("BACKGROUND_COLOR", "#f8fafc")
    TEXT_COLOR = os.getenv("TEXT_COLOR", "#1e293b")

    # Company
    COMPANY_NAME = os.getenv("COMPANY_NAME", "Your Company")
    COMPANY_WEBSITE = os.getenv("COMPANY_WEBSITE", "")
    SUPPORT_EMAIL = os.getenv("SUPPORT_EMAIL", "")
    COMPANY_PHONE = os.getenv("COMPANY_PHONE", "")

    @classmethod
    def branding(cls):
        return {
            "app_name": cls.APP_NAME,
            "app_tagline": cls.APP_TAGLINE,
            "app_logo_url": cls.APP_LOGO_URL,
            "app_favicon_url": cls.APP_FAVICON_URL,
            "primary_color": cls.PRIMARY_COLOR,
            "secondary_color": cls.SECONDARY_COLOR,
            "accent_color": cls.ACCENT_COLOR,
            "background_color": cls.BACKGROUND_COLOR,
            "text_color": cls.TEXT_COLOR,
            "company_name": cls.COMPANY_NAME,
            "company_website": cls.COMPANY_WEBSITE,
            "support_email": cls.SUPPORT_EMAIL,
            "company_phone": cls.COMPANY_PHONE,
        }
