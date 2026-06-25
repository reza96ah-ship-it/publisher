from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: str


class StoreUpsertRequest(BaseModel):
    name: str
    category: str = ""
    phone: str = ""
    description: str = ""
    default_hashtags: str = ""
    caption_footer: str = ""
    timezone: str = "Asia/Tehran"


class StoreResponse(BaseModel):
    id: int
    name: str
    category: str
    phone: str
    description: str
    default_hashtags: str
    caption_footer: str
    timezone: str
    is_active: bool


class RubikaSettingsRequest(BaseModel):
    bot_token: str
    chat_id: str


class RubikaAccountResponse(BaseModel):
    id: int
    chat_id: str
    bot_token_masked: str
    bot_name: str
    status: str
    last_error: str
    is_active: bool


class RubikaTestResponse(BaseModel):
    ok: bool
    status: str
    bot_name: str = ""
    error: str = ""


class PostRequest(BaseModel):
    title: str
    caption: str = ""
    hashtags: str = ""
    platform: str = "rubika"


class PostResponse(BaseModel):
    id: int
    store_id: int
    title: str
    caption: str
    hashtags: str
    platform: str
    status: str


class MediaResponse(BaseModel):
    id: int
    store_id: int
    post_id: int | None
    original_filename: str
    stored_filename: str
    content_type: str
    size_bytes: int
    url: str


class AttachMediaRequest(BaseModel):
    post_id: int | None = None
