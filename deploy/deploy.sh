#!/usr/bin/env bash
# Atualiza a produção para um commit da main e, se a versão nova não ficar
# saudável, volta à anterior. Roda no servidor, como o usuário dono do clone:
#
#   deploy/deploy.sh          # o commit mais recente da main do GitHub
#   deploy/deploy.sh <sha>    # um commit específico (precisa estar na main)
#
# A pipeline (.github/workflows/deploy.yml) chega aqui por SSH, com uma chave
# que só consegue rodar este script; o commit vem em SSH_ORIGINAL_COMMAND.
#
# Passos: backup do banco, build das imagens, subida esperando os healthchecks.
# Se algo falhar, voltam o código e as imagens anteriores. O banco não volta
# sozinho (migrations só andam para frente): o backup de antes fica em ~/backups.
set -euo pipefail

REPO_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$REPO_DIR"

COMPOSE=(docker compose -f docker-compose.prod.yml)
# Serviços com imagem construída aqui; mysql e caddy usam imagens prontas.
BUILT_SERVICES=(api web migrate)
BACKUP_DIR=${DEPLOY_BACKUP_DIR:-$HOME/backups}
KEEP_BACKUPS=${DEPLOY_KEEP_BACKUPS:-10}
WAIT_TIMEOUT=${DEPLOY_WAIT_TIMEOUT:-300}

log() { printf '[deploy %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
die() {
  log "ERRO: $*" >&2
  exit 1
}

project_name() {
  "${COMPOSE[@]}" config | awk '$1 == "name:" { print $2; exit }'
}

is_healthy() {
  local id
  id=$("${COMPOSE[@]}" ps -q "$1")
  [[ -n $id && $(docker inspect -f '{{.State.Health.Status}}' "$id" 2>/dev/null) == healthy ]]
}

backup_database() {
  if [[ -z $("${COMPOSE[@]}" ps -q --status running mysql) ]]; then
    log "MySQL parado (primeiro deploy?): sem backup"
    return
  fi

  mkdir -p "$BACKUP_DIR"
  local file
  file="$BACKUP_DIR/pre-deploy-$(date -u +%Y%m%dT%H%M%SZ)-${1:0:7}.sql.gz"

  log "backup do banco: $file"
  # shellcheck disable=SC2016 # as variáveis são do container do MySQL
  if ! (umask 077 && "${COMPOSE[@]}" exec -T mysql sh -c \
    'MYSQL_PWD=$MYSQL_ROOT_PASSWORD mysqldump -uroot --single-transaction --routines "$MYSQL_DATABASE"' |
    gzip >"$file.partial"); then
    rm -f "$file.partial"
    die "o backup falhou; nada foi alterado"
  fi
  mv "$file.partial" "$file"

  # Só os backups deste script (os do cron têm outro nome e outra limpeza). O
  # nome começa pela data, então a ordem alfabética é a cronológica.
  printf '%s\n' "$BACKUP_DIR"/pre-deploy-*.sql.gz | sort -r |
    tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f --
  BACKUP_FILE=$file
}

# Etapa 1: confere o pedido, faz o backup, guarda as imagens em uso e troca o
# código. Termina com exec na versão nova deste script, que faz a etapa 2.
prepare() {
  local target=${SSH_ORIGINAL_COMMAND-${1:-}}

  [[ -z $target || $target =~ ^[0-9a-f]{40}$ ]] ||
    die "argumento inválido: passe o SHA completo de um commit da main, ou nada"

  # Um deploy por vez (a pipeline e alguém rodando à mão, por exemplo).
  exec 9>"$REPO_DIR/.git/deploy.lock"
  if ! flock -n 9; then
    log "outro deploy em andamento; esperando ele terminar"
    flock -w 1800 9 || die "o outro deploy não terminou em 30 minutos"
  fi

  git diff --quiet HEAD -- ||
    die "há alterações locais em arquivos versionados (veja git status); nada foi alterado"
  "${COMPOSE[@]}" config --quiet || die "o compose recusou a configuração (confira o .env)"

  git fetch --quiet origin main
  target=${target:-$(git rev-parse origin/main)}
  if ! git cat-file -e "$target^{commit}" 2>/dev/null ||
    ! git merge-base --is-ancestor "$target" origin/main; then
    die "o commit ${target:0:12} não está na main do GitHub"
  fi

  local current
  current=$(git rev-parse HEAD)

  # Dois merges seguidos podem ter o CI terminando fora de ordem: não volta
  # para um commit mais antigo sem pedido explícito.
  if [[ $target != "$current" && -z ${DEPLOY_ALLOW_OLDER:-} ]] &&
    git merge-base --is-ancestor "$target" "$current"; then
    log "o servidor já está em ${current:0:7}, mais novo que ${target:0:7}; nada a fazer"
    exit 0
  fi

  log "de ${current:0:7} para ${target:0:7}"

  BACKUP_FILE=""
  backup_database "$current"

  # Só guarda as imagens em uso como "previous" se estão saudáveis: depois de
  # um deploy que falhou, a versão boa é a que já está lá.
  local project can_rollback=no
  project=$(project_name)
  if is_healthy api && is_healthy web; then
    can_rollback=yes
    for service in "${BUILT_SERVICES[@]}"; do
      docker tag "$project-$service:latest" "$project-$service:previous"
    done
  elif docker image inspect "$project-api:previous" >/dev/null 2>&1; then
    can_rollback=yes
    log "a versão em uso não está saudável; a volta, se precisar, usa as imagens 'previous' que já existem"
  fi

  git checkout --quiet -B main "$target"

  exec env DEPLOY_STAGE=release DEPLOY_FROM="$current" DEPLOY_TO="$target" \
    DEPLOY_CAN_ROLLBACK="$can_rollback" DEPLOY_BACKUP_FILE="$BACKUP_FILE" \
    "$REPO_DIR/deploy/deploy.sh"
}

# Etapa 2: build e subida da versão nova; se não ficar saudável, volta.
release() {
  log "build das imagens"
  if "${COMPOSE[@]}" build --pull &&
    log "subindo (até ${WAIT_TIMEOUT}s para os healthchecks)" &&
    "${COMPOSE[@]}" up -d --wait --wait-timeout "$WAIT_TIMEOUT"; then
    # Imagens sem nome que sobraram dos builds anteriores, só deste projeto.
    docker image prune -f --filter "label=com.docker.compose.project=$(project_name)" >/dev/null || true
    log "pronto: produção em ${DEPLOY_TO:0:7}"
    exit 0
  fi

  log "a versão nova não subiu saudável"
  "${COMPOSE[@]}" ps -a || true
  "${COMPOSE[@]}" logs --no-color --tail=40 migrate api web || true
  rollback
}

rollback() {
  git checkout --quiet -B main "$DEPLOY_FROM"

  if [[ $DEPLOY_CAN_ROLLBACK != yes ]]; then
    die "não há imagens anteriores para voltar (primeiro deploy?); o código voltou para ${DEPLOY_FROM:0:7}"
  fi

  local project
  project=$(project_name)
  for service in "${BUILT_SERVICES[@]}"; do
    docker tag "$project-$service:previous" "$project-$service:latest"
  done

  log "voltando para ${DEPLOY_FROM:0:7}"
  if "${COMPOSE[@]}" up -d --no-build --wait --wait-timeout "$WAIT_TIMEOUT"; then
    log "a versão anterior (${DEPLOY_FROM:0:7}) está no ar"
  else
    log "a versão anterior também não ficou saudável: veja docker compose ps e os logs"
  fi

  if [[ -n $DEPLOY_BACKUP_FILE ]]; then
    log "se a versão nova aplicou migration, ela continua no banco; o backup de antes do deploy é $DEPLOY_BACKUP_FILE"
  fi
  die "deploy de ${DEPLOY_TO:0:7} falhou"
}

if [[ ${DEPLOY_STAGE:-} == release ]]; then
  release
else
  prepare "$@"
fi
