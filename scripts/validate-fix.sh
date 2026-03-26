#!/bin/bash
# Pre-deploy validation script

set -e

echo "🔍 Running pre-deploy checks..."

cd /home/ethan/.openclaw/workspace/automation-lab

# 1. TypeScript compilation
echo "📦 Building project..."
npm run build > /tmp/build.log 2>&1 || {
  echo "❌ Build failed!"
  tail -20 /tmp/build.log
  exit 1
}

echo "✅ Build successful"

# 2. Check for changes
if [[ -z $(git status --porcelain) ]]; then
  echo "⚠️  No changes detected"
  exit 1
fi

echo "✅ Changes detected"

# 3. Check for common issues
if grep -rn "console\.log" app/ --include="*.tsx" --include="*.ts" | grep -v "// console.log"; then
  echo "⚠️  Warning: console.log statements found (non-commented)"
fi

echo "✅ Validation passed"
