#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node tests/renewal-core.cjs
node tests/renewal-transport.cjs
node tests/renewal-manager.cjs
node tests/renewal-storage.cjs
node tests/helper-control.cjs
node tests/resume.cjs
node tests/controller-resume.cjs
for test in native/prototype/test-*.cjs; do node "$test"; done
mkdir -p build/tests
cc -std=c99 -Wall -Wextra -Werror native/prototype/filter.c native/prototype/test_filter.c -o build/tests/test-filter
build/tests/test-filter
for file in launcher/*.js native/app/*.js native/service/*.js renewal-service/*.js aerials-service/*.js; do node --check "$file"; done
node --test --test-timeout=40000 tests/aerials-cache.test.mjs

python3 -m unittest discover -s tests/setup
for test in tests/updates/*.cjs; do node "$test"; done
for file in updater-service/*.js updater-app/*.js; do node --check "$file"; done
cmp launcher/user-data.js updater-service/user-data.js
