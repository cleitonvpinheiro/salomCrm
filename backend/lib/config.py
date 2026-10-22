"""Runtime configuration checks that fail closed before production startup."""

import os
from urllib.parse import parse_qs, urlsplit


def validate_runtime_config(environ: dict[str, str] | None = None) -> None:
    values = os.environ if environ is None else environ
    app_env = values.get("APP_ENV", "development").strip().lower()
    if app_env not in {"development", "staging", "production"}:
        raise RuntimeError("APP_ENV must be development, staging, or production")
    if app_env != "production":
        return

    owner_email = values.get("PLATFORM_OWNER_EMAIL", "").strip()
    owner_password = values.get("PLATFORM_OWNER_PASSWORD", "")
    if not owner_email or len(owner_password) < 16:
        raise RuntimeError(
            "Production requires PLATFORM_OWNER_EMAIL and a "
            "PLATFORM_OWNER_PASSWORD of at least 16 characters"
        )

    if values.get("COOKIE_SECURE", "").strip().lower() != "true":
        raise RuntimeError("Production requires COOKIE_SECURE=true")

    origins = [
        origin.strip()
        for origin in values.get("CORS_ORIGINS", "").split(",")
        if origin.strip()
    ]
    if not origins or "*" in origins:
        raise RuntimeError("Production requires explicit CORS_ORIGINS")
    for origin in origins:
        parsed_origin = urlsplit(origin)
        if (
            parsed_origin.scheme != "https"
            or not parsed_origin.netloc
            or parsed_origin.path
            or parsed_origin.query
            or parsed_origin.fragment
            or parsed_origin.hostname in {"localhost", "127.0.0.1", "::1"}
        ):
            raise RuntimeError(
                "Production CORS_ORIGINS must contain HTTPS origins without paths"
            )

    mongo_url = values.get("MONGO_URL") or values.get("MONGODB_URI", "")
    parsed_mongo_url = urlsplit(mongo_url)
    mongo_options = parse_qs(parsed_mongo_url.query)
    tls_enabled = (
        parsed_mongo_url.scheme == "mongodb+srv"
        or mongo_options.get("tls", mongo_options.get("ssl", ["false"]))[-1].lower()
        == "true"
    )
    if parsed_mongo_url.scheme != "mongodb" and parsed_mongo_url.scheme != "mongodb+srv":
        raise RuntimeError("Production requires a valid MongoDB connection URI")
    if not tls_enabled:
        raise RuntimeError("Production MongoDB connections must use TLS")
    if parsed_mongo_url.hostname in {"localhost", "127.0.0.1", "::1"}:
        raise RuntimeError("Production MongoDB cannot use a loopback host")
    username = values.get("MONGODB_USERNAME", "")
    password = values.get("MONGODB_PASSWORD", "")
    if bool(username) != bool(password):
        raise RuntimeError(
            "Production MongoDB requires both MONGODB_USERNAME and "
            "MONGODB_PASSWORD when credentials are not in the URI"
        )
    if not parsed_mongo_url.username and not (username and password):
        raise RuntimeError("Production MongoDB requires authenticated access")

    if not values.get("DEFAULT_TENANT_SLUG", "").strip():
        raise RuntimeError("Production requires an explicit DEFAULT_TENANT_SLUG")

    smtp_host = values.get("SMTP_HOST", "").strip()
    smtp_from = values.get("SMTP_FROM_EMAIL", "").strip()
    public_app_url = values.get("PUBLIC_APP_URL", "").strip()
    if not smtp_host or not smtp_from or not public_app_url:
        raise RuntimeError(
            "Production requires SMTP_HOST, SMTP_FROM_EMAIL, and PUBLIC_APP_URL "
            "for password recovery"
        )
    smtp_port = values.get("SMTP_PORT", "587").strip()
    if not smtp_port.isdigit() or not 1 <= int(smtp_port) <= 65535:
        raise RuntimeError("SMTP_PORT must be a valid TCP port")
    if bool(values.get("SMTP_USERNAME")) != bool(values.get("SMTP_PASSWORD")):
        raise RuntimeError("SMTP_USERNAME and SMTP_PASSWORD must be set together")
    public_url = urlsplit(public_app_url)
    if (
        public_url.scheme != "https"
        or not public_url.netloc
        or public_url.path
        or public_url.query
        or public_url.fragment
    ):
        raise RuntimeError("Production PUBLIC_APP_URL must be an HTTPS origin")
