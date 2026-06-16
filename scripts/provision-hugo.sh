#!/usr/bin/env bash
set -Eeuo pipefail

# Installs/updates Hugo Extended into ~/.local/bin and makes it usable immediately
# when this script is sourced:
#
#   source ./scripts/provision-hugo.sh
#
# Optional:
#   HUGO_VERSION=0.163.2 source ./scripts/provision-hugo.sh

INSTALL_DIR="${HUGO_INSTALL_DIR:-$HOME/.local/bin}"
TMP_DIR="$(mktemp -d)"
SHELL_RC="${HOME}/.bashrc"
PATH_LINE='export PATH="$HOME/.local/bin:$PATH"'

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

die() {
  echo "Error: $*" >&2
  return 1 2>/dev/null || exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "'$1' is required but not installed."
}

need_cmd curl
need_cmd tar
need_cmd sed
need_cmd awk

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$OS" in
  linux) HUGO_OS="linux" ;;
  darwin) HUGO_OS="darwin" ;;
  *) die "unsupported OS: $OS" ;;
esac

case "$ARCH" in
  x86_64|amd64) HUGO_ARCH="amd64" ;;
  aarch64|arm64) HUGO_ARCH="arm64" ;;
  *) die "unsupported architecture: $ARCH" ;;
esac

if [ -z "${HUGO_VERSION:-}" ]; then
  echo "Finding latest Hugo release..."
  LATEST_URL="$(curl -Ls -o /dev/null -w '%{url_effective}' https://github.com/gohugoio/hugo/releases/latest)"
  HUGO_VERSION="$(printf '%s\n' "$LATEST_URL" | sed 's#.*/tag/v##')"
fi

HUGO_VERSION="${HUGO_VERSION#v}"

ASSET="hugo_extended_${HUGO_VERSION}_${HUGO_OS}-${HUGO_ARCH}.tar.gz"
URL="https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/${ASSET}"

mkdir -p "$INSTALL_DIR"

echo "Installing Hugo Extended v${HUGO_VERSION}"
echo "Target: ${INSTALL_DIR}/hugo"

CURRENT=""
if [ -x "${INSTALL_DIR}/hugo" ]; then
  CURRENT="$("${INSTALL_DIR}/hugo" version | awk '{print $2}' | sed 's/^v//; s/-.*//')"
fi

if [ "$CURRENT" = "$HUGO_VERSION" ]; then
  echo "Hugo Extended v${HUGO_VERSION} is already installed."
else
  curl -fL "$URL" -o "${TMP_DIR}/${ASSET}"
  tar -xzf "${TMP_DIR}/${ASSET}" -C "$TMP_DIR" hugo
  mv "${TMP_DIR}/hugo" "${INSTALL_DIR}/hugo"
  chmod +x "${INSTALL_DIR}/hugo"
fi

# Persist for future shells.
if [ -f "$SHELL_RC" ]; then
  if ! grep -Fxq "$PATH_LINE" "$SHELL_RC"; then
    printf '\n%s\n' "$PATH_LINE" >> "$SHELL_RC"
    echo "Added ~/.local/bin to PATH in $SHELL_RC"
  fi
else
  printf '%s\n' "$PATH_LINE" > "$SHELL_RC"
  echo "Created $SHELL_RC and added ~/.local/bin to PATH"
fi

# Make Hugo available immediately if this script was sourced.
case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *) export PATH="$INSTALL_DIR:$PATH" ;;
esac

# Clear Bash's cached path to the old /usr/bin/hugo.
hash -r 2>/dev/null || true

echo
echo "Active Hugo:"
command -v hugo
hugo version

echo
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  echo "Installed successfully, but this script was executed normally."
  echo "To make this terminal use the new Hugo immediately, run:"
  echo
  echo "  source ./scripts/provision-hugo.sh"
  echo
else
  echo "Ready. This terminal is now using the new Hugo."
fi