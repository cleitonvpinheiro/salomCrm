#!/usr/bin/env bash
# Backup diario do MongoDB com retencao local e envio opcional para fora do servidor.
# Uso:   deploy/backup.sh
# Cron:  0 3 * * * /caminho/do/repo/deploy/backup.sh >> /var/log/atelier-backup.log 2>&1
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/deploy/production.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/atelier}"
KEEP_DAYS="${KEEP_DAYS:-14}"
# Opcional: remoto rclone (ex.: "oci:atelier-backups") para guardar uma copia fora da VM.
RCLONE_REMOTE="${RCLONE_REMOTE:-}"

# Le apenas as chaves necessarias; o arquivo nao e executado como shell.
MONGO_URL="$(grep -E '^MONGO_URL=' "$ENV_FILE" | head -n1 | cut -d= -f2-)"
DB_NAME="$(grep -E '^DB_NAME=' "$ENV_FILE" | head -n1 | cut -d= -f2-)"
[ -n "$MONGO_URL" ] && [ -n "$DB_NAME" ] || { echo "MONGO_URL/DB_NAME ausentes em $ENV_FILE" >&2; exit 1; }

mkdir -p "$BACKUP_DIR"
umask 077
FILE="$BACKUP_DIR/${DB_NAME}-$(date -u +%Y%m%dT%H%M%SZ).archive.gz"

docker run --rm mongo:7 mongodump --uri="$MONGO_URL" --db="$DB_NAME" --archive --gzip > "$FILE"
[ -s "$FILE" ] || { echo "Backup vazio; removendo $FILE" >&2; rm -f "$FILE"; exit 1; }
echo "Backup criado: $FILE ($(du -h "$FILE" | cut -f1))"

if [ -n "$RCLONE_REMOTE" ]; then
  rclone copy "$FILE" "$RCLONE_REMOTE"
  echo "Copia enviada para $RCLONE_REMOTE"
fi

find "$BACKUP_DIR" -name "${DB_NAME}-*.archive.gz" -mtime "+$KEEP_DAYS" -delete
