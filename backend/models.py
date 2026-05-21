from pydantic import BaseModel, Field, field_validator
from typing import List, Optional

class NicknameLogin(BaseModel):
    nickname: str = Field(min_length=1, max_length=20)

    @field_validator("nickname")
    @classmethod
    def strip_nickname(cls, value: str):
        return value.strip()


class ProfileDisplayNameUpdate(BaseModel):
    display_name: str = Field(min_length=1, max_length=20)

    @field_validator("display_name")
    @classmethod
    def strip_display_name(cls, value: str):
        return value.strip()


class ProfileIdentityUpdate(BaseModel):
    login_id: str = Field(min_length=4, max_length=30)
    real_name: str = Field(min_length=1, max_length=50)
    display_name: str = Field(min_length=1, max_length=20)
    email_verification_token: Optional[str] = Field(default=None, max_length=500)

    @field_validator("login_id", "real_name", "display_name", "email_verification_token", mode="before")
    @classmethod
    def strip_identity_fields(cls, value):
        return value.strip() if isinstance(value, str) else value


class SignupEmailVerificationRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)

    @field_validator("email", mode="before")
    @classmethod
    def strip_email(cls, value):
        return value.strip() if isinstance(value, str) else value


class SignupEmailVerificationConfirm(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    code: str = Field(min_length=6, max_length=6)

    @field_validator("email", "code", mode="before")
    @classmethod
    def strip_confirm_fields(cls, value):
        return value.strip() if isinstance(value, str) else value


class FindLoginIdRequest(BaseModel):
    real_name: str = Field(min_length=1, max_length=50)
    display_name: str = Field(min_length=1, max_length=20)
    email: str = Field(min_length=3, max_length=254)

    @field_validator("real_name", "display_name", "email", mode="before")
    @classmethod
    def strip_find_id_fields(cls, value):
        return value.strip() if isinstance(value, str) else value


class PasswordResetRequest(BaseModel):
    real_name: str = Field(min_length=1, max_length=50)
    login_id: str = Field(min_length=4, max_length=30)
    email: str = Field(min_length=3, max_length=254)

    @field_validator("real_name", "login_id", "email", mode="before")
    @classmethod
    def strip_password_reset_fields(cls, value):
        return value.strip() if isinstance(value, str) else value


class SendLoginIdEmailRequest(FindLoginIdRequest):
    pass


class SocialProvidersUpdate(BaseModel):
    providers: List[str] = Field(default_factory=list, max_length=20)

    @field_validator("providers")
    @classmethod
    def clean_providers(cls, value):
        return sorted({str(provider).strip() for provider in value if str(provider).strip()})

class Evaluation(BaseModel):
    nickname: str = Field(min_length=1, max_length=20)
    game_type: str = Field(min_length=1, max_length=100)
    blind_model_id: str = Field(min_length=1, max_length=10)
    score_control: int = Field(ge=1, le=10)
    score_structure: int = Field(ge=1, le=10)
    score_presentation: int = Field(ge=1, le=10)
    score_difficulty: int = Field(ge=1, le=10)
    score_fun: int = Field(ge=1, le=10)
    score_overall: int = Field(ge=1, le=10)
    comment: Optional[str] = Field(default=None, max_length=150)

    @field_validator("nickname", "game_type", "blind_model_id", mode="before")
    @classmethod
    def strip_required_strings(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("comment", mode="before")
    @classmethod
    def strip_comment(cls, value):
        return value.strip() if isinstance(value, str) else value

class PlayEvent(BaseModel):
    game_type: str = Field(min_length=1, max_length=100)
    blind_model_id: str = Field(min_length=1, max_length=10)
    nickname: Optional[str] = Field(default=None, max_length=20)

    @field_validator("game_type", "blind_model_id", "nickname", mode="before")
    @classmethod
    def strip_play_fields(cls, value):
        return value.strip() if isinstance(value, str) else value


class CommentReactionToggle(BaseModel):
    evaluation_id: str = Field(min_length=1, max_length=100)
    nickname: str = Field(min_length=1, max_length=20)
    reaction_type: str = Field(min_length=1, max_length=10)

    @field_validator("evaluation_id", "nickname", "reaction_type", mode="before")
    @classmethod
    def strip_reaction_fields(cls, value):
        return value.strip() if isinstance(value, str) else value


class CommentReplyCreate(BaseModel):
    evaluation_id: str = Field(min_length=1, max_length=100)
    nickname: str = Field(min_length=1, max_length=20)
    reply: str = Field(min_length=1, max_length=150)

    @field_validator("evaluation_id", "nickname", "reply", mode="before")
    @classmethod
    def strip_reply_fields(cls, value):
        return value.strip() if isinstance(value, str) else value


class AdminAuthRequest(BaseModel):
    nickname: str = Field(min_length=1, max_length=20)
    password: str = Field(min_length=1, max_length=200)

    @field_validator("nickname", "password", mode="before")
    @classmethod
    def strip_admin_auth_fields(cls, value):
        return value.strip() if isinstance(value, str) else value


class AdminBlindToggle(BaseModel):
    target_type: str = Field(min_length=1, max_length=20)
    target_id: str = Field(min_length=1, max_length=100)
    is_blinded: bool

    @field_validator("target_type", "target_id", mode="before")
    @classmethod
    def strip_blind_fields(cls, value):
        return value.strip() if isinstance(value, str) else value


class ProfileBadgeUpdate(BaseModel):
    nickname: str = Field(min_length=1, max_length=20)
    badge_key: str = Field(min_length=1, max_length=100)

    @field_validator("nickname", "badge_key", mode="before")
    @classmethod
    def strip_profile_badge_fields(cls, value):
        return value.strip() if isinstance(value, str) else value
