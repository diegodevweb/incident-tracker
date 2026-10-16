#!/usr/bin/env bash
# Prepara este servidor para o deploy automático (.github/workflows/deploy.yml).
# Rode uma vez, como o usuário dono do clone (o mesmo que roda docker compose),
# com o endereço que o GitHub vai usar para chegar aqui:
#
#   deploy/setup-auto-deploy.sh <domínio ou IP> [porta do SSH]
#
# Cria uma chave SSH só para o deploy e a autoriza com command= e restrict:
# quem tiver essa chave só consegue rodar deploy/deploy.sh (sem shell, sem
# túnel). Rodar de novo troca a chave. No fim mostra os valores para cadastrar
# no GitHub; a chave privada não fica gravada no servidor.
set -euo pipefail

MARKER=incident-tracker-deploy

host=${1:?Uso: deploy/setup-auto-deploy.sh <domínio ou IP do servidor> [porta do SSH]}
port=${2:-22}
script=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deploy.sh

die() {
  echo "ERRO: $*" >&2
  exit 1
}

[[ $host =~ ^[A-Za-z0-9.:-]+$ ]] || die "endereço inválido: $host"
[[ $port =~ ^[0-9]+$ ]] || die "porta inválida: $port"
# O caminho vai entre aspas no authorized_keys.
[[ $script =~ ^[A-Za-z0-9/._-]+$ ]] || die "mova o clone para um caminho sem espaços nem símbolos: $script"
[[ $(id -u) != 0 ]] || die "rode como o usuário dono do clone, não como root"
docker info >/dev/null 2>&1 || die "este usuário precisa rodar docker sem sudo (grupo docker)"
git -C "$(dirname "$script")" remote get-url origin >/dev/null || die "o clone precisa do remoto origin"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

ssh-keygen -q -t ed25519 -N '' -C "$MARKER" -f "$tmp/key"

install -d -m 700 "$HOME/.ssh"
touch "$HOME/.ssh/authorized_keys"
chmod 600 "$HOME/.ssh/authorized_keys"
{
  grep -v " $MARKER\$" "$HOME/.ssh/authorized_keys" || true
  printf 'command="%s",restrict %s\n' "$script" "$(cat "$tmp/key.pub")"
} >"$tmp/authorized_keys"
cat "$tmp/authorized_keys" >"$HOME/.ssh/authorized_keys"

# Chaves do próprio servidor, lidas daqui: o GitHub confere que fala com esta
# máquina sem confiar na primeira conexão.
if [[ $port == 22 ]]; then
  host_pattern=$host
else
  host_pattern="[$host]:$port"
fi
known_hosts=$(for pub in /etc/ssh/ssh_host_*_key.pub; do
  read -r type key _ <"$pub"
  printf '%s %s %s\n' "$host_pattern" "$type" "$key"
done)
[[ -n $known_hosts ]] || die "nenhuma chave em /etc/ssh/ssh_host_*_key.pub"

cat <<EOF

Chave de deploy autorizada para $(id -un): ela só roda $script.

Cadastre no GitHub, em Settings > Environments > production > Environment
secrets (crie o ambiente "production" se ele ainda não existir):

--- DEPLOY_HOST ----------------------------------------------------------
$(id -un)@$host
EOF
if [[ $port != 22 ]]; then
  printf -- '--- DEPLOY_PORT ----------------------------------------------------------\n%s\n' "$port"
fi
cat <<EOF
--- DEPLOY_KNOWN_HOSTS ---------------------------------------------------
$known_hosts
--- DEPLOY_SSH_KEY (inclua as linhas BEGIN e END) ------------------------
$(cat "$tmp/key")
--------------------------------------------------------------------------

Depois de cadastrar, limpe o terminal (clear). Para testar sem esperar um
merge: GitHub > Actions > Deploy > Run workflow.
EOF
