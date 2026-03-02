"""Encrypt/decrypt tokens at rest (refresh_token, access_token). Uses Fernet when ENCRYPTION_KEY is set.

Key rotation: set ENCRYPTION_KEY_PREVIOUS to the old key and ENCRYPTION_KEY to the new key.
Decrypt tries the current key first, then the previous key so existing tokens still work.
New tokens are encrypted only with the current key. After rotating, remove ENCRYPTION_KEY_PREVIOUS
once you no longer need to decrypt old data.
"""

from __future__ import annotations

from src.config import settings


def _fernet_current():
    if not getattr(settings, "ENCRYPTION_KEY", None) or not settings.ENCRYPTION_KEY:
        return None
    try:
        from cryptography.fernet import Fernet
        key = settings.ENCRYPTION_KEY
        return Fernet(key.encode() if isinstance(key, str) else key)
    except Exception:
        return None


def _fernet_previous():
    if not getattr(settings, "ENCRYPTION_KEY_PREVIOUS", None) or not settings.ENCRYPTION_KEY_PREVIOUS:
        return None
    try:
        from cryptography.fernet import Fernet
        key = settings.ENCRYPTION_KEY_PREVIOUS
        return Fernet(key.encode() if isinstance(key, str) else key)
    except Exception:
        return None


def encrypt_token(plain: str | None) -> str | None:
    """Encrypt a token for storage. Returns None if plain is None or encryption is disabled."""
    if plain is None:
        return None
    f = _fernet_current()
    if f is None:
        return plain
    try:
        return f.encrypt(plain.encode()).decode()
    except Exception:
        return plain


def decrypt_token(cipher: str | None) -> str | None:
    """Decrypt a stored token. Tries current key, then previous key (for rotation). Returns None if decryption fails."""
    if cipher is None:
        return None
    f_current = _fernet_current()
    if f_current is None:
        return cipher
    try:
        return f_current.decrypt(cipher.encode()).decode()
    except Exception:
        pass
    f_prev = _fernet_previous()
    if f_prev is not None:
        try:
            return f_prev.decrypt(cipher.encode()).decode()
        except Exception:
            pass
    return None
