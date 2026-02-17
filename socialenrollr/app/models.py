"""Database models for SocialEnrollr."""

from datetime import datetime
from app import db, login_manager
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


class User(UserMixin, db.Model):
    """Admin/reseller user accounts."""

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    company_name = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    clients = db.relationship("Client", backref="owner", lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class Client(db.Model):
    """Client profiles - people being enrolled on social media."""

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)

    # Personal info
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    phone = db.Column(db.String(30))
    bio = db.Column(db.Text)

    # Addresses
    home_address = db.Column(db.String(300))
    home_city = db.Column(db.String(100))
    home_state = db.Column(db.String(50))
    home_zip = db.Column(db.String(20))

    business_name = db.Column(db.String(200))
    business_address = db.Column(db.String(300))
    business_city = db.Column(db.String(100))
    business_state = db.Column(db.String(50))
    business_zip = db.Column(db.String(20))

    # Meta
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    enrollments = db.relationship("Enrollment", backref="client", lazy=True)

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    def to_dict(self):
        return {
            "id": self.id,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "email": self.email,
            "phone": self.phone,
            "bio": self.bio,
            "home_address": self.home_address,
            "home_city": self.home_city,
            "home_state": self.home_state,
            "home_zip": self.home_zip,
            "business_name": self.business_name,
            "business_address": self.business_address,
            "business_city": self.business_city,
            "business_state": self.business_state,
            "business_zip": self.business_zip,
            "full_name": self.full_name,
        }


class Enrollment(db.Model):
    """Tracks enrollment status for each platform per client."""

    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey("client.id"), nullable=False)

    platform_key = db.Column(db.String(50), nullable=False)
    chosen_username = db.Column(db.String(100))
    profile_url = db.Column(db.String(500))
    status = db.Column(db.String(20), default="pending")  # pending, in_progress, completed, failed
    notes = db.Column(db.Text)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "client_id": self.client_id,
            "platform_key": self.platform_key,
            "chosen_username": self.chosen_username,
            "profile_url": self.profile_url,
            "status": self.status,
            "notes": self.notes,
        }
