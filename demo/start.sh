#!/bin/zsh
# A fresh Alpha with the two sample modules and made-up rows, for trying the platform.
#   demo/start.sh [port]        (default 4790; the window is built first if it is not)
set -e
HERE=${0:A:h}
ROOT=${HERE:h}
PORT=${1:-4790}
HOME_DIR=$HERE/homes/$PORT
export PATH=$HOME/.nvm/versions/node/v26.12.1/bin:$PATH

[ -f $ROOT/window/dist/index.html ] || (cd $ROOT && pnpm --filter @alpha/window build)
rm -rf $HOME_DIR && mkdir -p $HOME_DIR
(cd $ROOT/core && ALPHA_HOME=$HOME_DIR ALPHA_PORT=$PORT nohup node src/main.ts > $HOME_DIR/core.log 2>&1 &)
for i in {1..60}; do curl -sf http://127.0.0.1:$PORT/api/health > /dev/null && break; sleep 0.5; done
token=$(cat $HOME_DIR/token)
for kit in deal-sourcing case-desk; do
  curl -sf -X POST -H "x-alpha-token: $token" -H 'content-type: application/json' \
    -d "{\"folder\":\"$HERE/modules/$kit\"}" http://127.0.0.1:$PORT/api/kits > /dev/null
done
node $HERE/seed.js http://127.0.0.1:$PORT $token
echo "Open http://localhost:$PORT/?t=$token"
echo "Stop it: kill \$(lsof -ti tcp:$PORT -sTCP:LISTEN)"
