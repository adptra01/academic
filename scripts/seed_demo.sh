#!/bin/bash
# Seed demo untuk beta: user demo + project + dataset + 2 analisis contoh.
# Idempoten: email sudah ada → login saja.
set -euo pipefail
B="${1:-http://localhost:8100}"
EMAIL="demo@kampus.ac.id"
PASS="Demo12345"

login() { curl -s -X POST "$B/api/v1/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}"; }
TOKEN=$(login | python3 -c "import json,sys; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || true)
if [ -z "$TOKEN" ]; then
  curl -s -X POST "$B/api/v1/auth/register" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"name\":\"Demo Beta\"}" > /dev/null
  TOKEN=$(login | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])")
fi
A() { curl -s -H "Authorization: Bearer $TOKEN" "$@"; }
PID=$(A "$B/api/v1/projects" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['id'] if d else '')")
if [ -z "$PID" ]; then
  PID=$(curl -s -X POST "$B/api/v1/projects" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"title":"Demo: Kualitas vs Kepuasan","research_type":"Skripsi"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
fi
cat > /tmp/opencode/demo.csv << 'CSV'
service_quality,satisfaction,gender
4,5,L
5,5,P
3,4,L
2,2,P
5,4,L
4,4,P
3,3,L
4,5,P
2,3,L
5,5,P
CSV
DSID=$(curl -s -X POST "$B/api/v1/projects/$PID/datasets/upload" -H "Authorization: Bearer $TOKEN" -F "file=@/tmp/opencode/demo.csv" | python3 -c "import json,sys; print(json.load(sys.stdin)['dataset']['id'])")
rm -f /tmp/opencode/demo.csv
for SPEC in 'pearson|x|service_quality|y|satisfaction' 'ttest_ind|column|satisfaction|group|gender'; do
  IFS='|' read -r M K1 V1 K2 V2 <<< "$SPEC"
  U=$(curl -s -X POST "$B/api/v1/analyses/run" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"project_id\":\"$PID\",\"dataset_id\":\"$DSID\",\"method\":\"$M\",\"variables\":{\"$K1\":\"$V1\",\"$K2\":\"$V2\"}}" | python3 -c "import json,sys; print(json.load(sys.stdin)['analysis_uid'])")
  echo "analysis: $U"
done
echo "demo OK — login $EMAIL / $PASS, project $PID"
