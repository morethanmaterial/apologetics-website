#!/usr/bin/env sh
set -eu

# Installs or updates Hugo Extended into ~/.local/bin.
# Usage:
#   sh install-hugo.sh
#   HUGO_VERSION=0.153.2 sh install-hugo.sh

INSTALL_DIR="${HOME}/.local/bin"
TMP_DIR="$(mktemp -d)"
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: '$1' is required but not installed."
    exit 1
  fi
}

need_cmd curl
need_cmd tar

case "$OS" in
  linux)
    HUGO_OS="linux"
    ;;
  darwin)
    HUGO_OS="darwin"
    ;;
  *)
    echo "Error: unsupported OS: $OS"
    exit 1
    ;;
esac

case "$ARCH" in
  x86_64|amd64)
    HUGO_ARCH="amd64"
    ;;
  aarch64|arm64)
    HUGO_ARCH="arm64"
    ;;
  *)
    echo "Error: unsupported architecture: $ARCH"
    exit 1
    ;;
esac

if [ -z "${HUGO_VERSION:-}" ]; then
  echo "Finding latest Hugo release..."
  LATEST_URL="$(curl -Ls -o /dev/null -w '%{url_effective}' https://github.com/gohugoio/hugo/releases/latest)"
  HUGO_VERSION="$(printf '%s\n' "$LATEST_URL" | sed 's#.*/tag/v##')"
fi

HUGO_VERSION="${HUGO_VERSION#v}"

ASSET="hugo_extended_${HUGO_VERSION}_${HUGO_OS}-${HUGO_ARCH}.tar.gz"
URL="https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/${ASSET}"

echo "Installing Hugo Extended v${HUGO_VERSION}"
echo "Target: ${INSTALL_DIR}/hugo"
echo "Asset:  ${ASSET}"

mkdir -p "$INSTALL_DIR"

if [ -x "${INSTALL_DIR}/hugo" ]; then
  CURRENT="$("${INSTALL_DIR}/hugo" version | awk '{print $2}' | sed 's/^v//')"
  if [ "$CURRENT" = "$HUGO_VERSION" ]; then
    echo "Hugo Extended v${HUGO_VERSION} is already installed at ${INSTALL_DIR}/hugo"
  else
    echo "Updating Hugo from v${CURRENT} to v${HUGO_VERSION}"
    curl -fL "$URL" -o "${TMP_DIR}/${ASSET}"
    tar -xzf "${TMP_DIR}/${ASSET}" -C "$TMP_DIR" hugo
    mv "${TMP_DIR}/hugo" "${INSTALL_DIR}/hugo"
    chmod +x "${INSTALL_DIR}/hugo"
  fi
else
  curl -fL "$URL" -o "${TMP_DIR}/${ASSET}"
  tar -xzf "${TMP_DIR}/${ASSET}" -C "$TMP_DIR" hugo
  mv "${TMP_DIR}/hugo" "${INSTALL_DIR}/hugo"
  chmod +x "${INSTALL_DIR}/hugo"
fi

# Ensure ~/.local/bin is first in PATH for future shells.
SHELL_RC="${HOME}/.bashrc"
PATH_LINE='export PATH="$HOME/.local/bin:$PATH"'

if [ -f "$SHELL_RC" ]; then
  if ! grep -Fxq "$PATH_LINE" "$SHELL_RC"; then
    printf '\n%s\n' "$PATH_LINE" >> "$SHELL_RC"
    echo "Added ~/.local/bin to PATH in $SHELL_RC"
  fi
else
  printf '%s\n' "$PATH_LINE" > "$SHELL_RC"
  echo "Created $SHELL_RC and added ~/.local/bin to PATH"
fi

echo
echo "Installed version:"
"${INSTALL_DIR}/hugo" version

echo
echo "To use it in this current terminal, run:"
echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
echo
echo "Then verify with:"
echo "  which hugo"
echo "  hugo version"