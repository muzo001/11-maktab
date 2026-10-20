#!/bin/sh
cd "$(dirname "$0")"
[ -d node_modules ] || npm install || exit 1
printf "Admin parolini kiriting: "; read -r ADMIN_PASSWORD
[ -f .secret ] || head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n' > .secret
export ADMIN_PASSWORD SECRET="$(cat .secret)"
node server.js
