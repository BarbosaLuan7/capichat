#!/bin/bash

# =============================================================================
# Script de Instalação de Ferramentas para Claude Code
# Execute com: bash ~/.claude/install-tools.sh
# =============================================================================

set -e

echo "🚀 Iniciando instalação de ferramentas..."
echo ""

# -----------------------------------------------------------------------------
# 1. HOMEBREW
# -----------------------------------------------------------------------------
if ! command -v brew &> /dev/null; then
    echo "📦 Instalando Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    # Adicionar ao PATH (Apple Silicon)
    if [[ -f /opt/homebrew/bin/brew ]]; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
    echo "✅ Homebrew instalado!"
else
    echo "✅ Homebrew já instalado"
fi

echo ""

# -----------------------------------------------------------------------------
# 2. GITHUB CLI
# -----------------------------------------------------------------------------
if ! command -v gh &> /dev/null; then
    echo "📦 Instalando GitHub CLI..."
    brew install gh
    echo "✅ GitHub CLI instalado!"
    echo ""
    echo "🔐 Autenticando no GitHub..."
    gh auth login
else
    echo "✅ GitHub CLI já instalado"
fi

echo ""

# -----------------------------------------------------------------------------
# 3. SUPABASE CLI
# -----------------------------------------------------------------------------
if ! command -v supabase &> /dev/null; then
    echo "📦 Instalando Supabase CLI..."
    brew install supabase/tap/supabase
    echo "✅ Supabase CLI instalado!"
else
    echo "✅ Supabase CLI já instalado"
fi

echo ""

# -----------------------------------------------------------------------------
# 4. UTILITÁRIOS DE TERMINAL
# -----------------------------------------------------------------------------
echo "📦 Instalando utilitários de terminal..."

# tree - visualizar estrutura de pastas
brew install tree 2>/dev/null || echo "  tree já instalado"

# fzf - fuzzy finder (busca interativa)
brew install fzf 2>/dev/null || echo "  fzf já instalado"

# fd - find mais rápido e amigável
brew install fd 2>/dev/null || echo "  fd já instalado"

# bat - cat com syntax highlighting
brew install bat 2>/dev/null || echo "  bat já instalado"

# htop - monitor de processos
brew install htop 2>/dev/null || echo "  htop já instalado"

# eza - ls moderno (substituto do exa)
brew install eza 2>/dev/null || echo "  eza já instalado"

# tldr - man pages simplificadas
brew install tldr 2>/dev/null || echo "  tldr já instalado"

# httpie - curl mais amigável
brew install httpie 2>/dev/null || echo "  httpie já instalado"

# jq já está instalado no seu sistema

echo "✅ Utilitários instalados!"
echo ""

# -----------------------------------------------------------------------------
# 5. DOCKER (opcional)
# -----------------------------------------------------------------------------
echo "🐳 Docker Desktop precisa ser instalado manualmente:"
echo "   https://www.docker.com/products/docker-desktop/"
echo ""

# -----------------------------------------------------------------------------
# RESUMO FINAL
# -----------------------------------------------------------------------------
echo "=============================================="
echo "🎉 Instalação concluída!"
echo "=============================================="
echo ""
echo "Ferramentas instaladas:"
echo "  - Homebrew (gerenciador de pacotes)"
echo "  - GitHub CLI (gh)"
echo "  - Supabase CLI"
echo "  - tree, fzf, fd, bat, htop, eza, tldr, httpie"
echo ""
echo "Próximos passos:"
echo "  1. Reinicie o terminal ou execute: source ~/.zshrc"
echo "  2. Autentique no Supabase: supabase login"
echo "  3. Verifique o GitHub: gh auth status"
echo ""
