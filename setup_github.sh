#!/bin/bash
set -e

echo "Setting up GitHub repository and CI..."

# Initialize git if not already initialized
git init
git add .
git commit -m "Initial commit" || true

# Create GitHub repo (requires GitHub CLI 'gh')
gh repo create overbet --private --source=. --remote=origin --push || echo "GitHub repo might already exist"

# Create GitHub Actions workflow directory
mkdir -p .github/workflows

# Create CI workflow file
cat << 'EOF' > .github/workflows/test.yml
name: CI Pipeline

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm prisma generate || true
      - run: pnpm lint || true
      - run: pnpm test
EOF

git add .github/workflows/test.yml
git commit -m "ci: add GitHub Actions test workflow" || true
git push -u origin main

echo "GitHub setup complete with CI pipeline."
