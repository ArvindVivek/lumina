#!/bin/bash
# Download VALORANT Assets
# Run this script to download agent icons and map images from valorant-api.com

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ASSETS_DIR="$PROJECT_DIR/public/valorant"

echo "Downloading VALORANT assets to $ASSETS_DIR..."

# Create directories
mkdir -p "$ASSETS_DIR/agents"
mkdir -p "$ASSETS_DIR/maps"
mkdir -p "$ASSETS_DIR/teams"

# Download function
download_agent() {
  local name=$1
  local uuid=$2
  local output="$ASSETS_DIR/agents/$name.png"
  if [ ! -f "$output" ]; then
    echo "  Downloading $name..."
    curl -s -o "$output" "https://media.valorant-api.com/agents/$uuid/displayicon.png" || true
  else
    echo "  Skipping $name (exists)"
  fi
}

download_map() {
  local name=$1
  local uuid=$2
  local output="$ASSETS_DIR/maps/$name.png"
  if [ ! -f "$output" ]; then
    echo "  Downloading $name..."
    curl -s -o "$output" "https://media.valorant-api.com/maps/$uuid/listviewicon.png" || true
  else
    echo "  Skipping $name (exists)"
  fi
}

echo "Downloading agent icons..."
download_agent "jett" "add6443a-41bd-e414-f6ad-e58d267f4e95"
download_agent "reyna" "a3bfb853-43b2-7238-a4f1-ad90e9e46bcc"
download_agent "raze" "f94c3b30-42be-e959-889c-5aa313dba261"
download_agent "phoenix" "eb93336a-449b-9c1b-0a54-a891f7921d69"
download_agent "yoru" "7f94d92c-4234-0a36-9646-3a87eb8b5c89"
download_agent "neon" "bb2a4828-46eb-8cd1-e765-15848195d751"
download_agent "iso" "0e38b510-41a8-5780-5e8f-568b2a4f2d6c"
download_agent "sova" "320b2a48-4d9b-a075-30f1-1f93a9b638fa"
download_agent "breach" "5f8d3a7f-467b-97f3-062c-13acf203c006"
download_agent "skye" "6f2a04ca-43e0-be17-7f36-b3908627744d"
download_agent "fade" "dade69b4-4f5a-8528-247b-219e5a1facd6"
download_agent "gekko" "e370fa57-4757-3604-3648-499e1f642d3f"
download_agent "kayo" "601dbbe7-43ce-be57-2a40-4abd24953621"
download_agent "omen" "8e253930-4c05-31dd-1b6c-968525494517"
download_agent "brimstone" "9f0d8ba9-4140-b941-57d3-a7ad57c6b417"
download_agent "viper" "707eab51-4836-f488-046a-cda6bf494e43"
download_agent "astra" "41fb69c1-4189-7b37-f117-bcaf1e96f1bf"
download_agent "harbor" "95b78ed7-4637-86d9-7e41-71ba8c293152"
download_agent "clove" "1dbf2edd-4729-0984-3115-daa5eed44993"
download_agent "sage" "569fdd95-4d10-43ab-ca70-79becc718b46"
download_agent "cypher" "117ed9e3-49f3-6512-3ccf-0cada7e3823b"
download_agent "killjoy" "1e58de9c-4950-5125-93e9-a0aee9f98746"
download_agent "chamber" "22697a3d-45bf-8dd7-4fec-84a9e28c69d7"
download_agent "deadlock" "cc8b64c8-4b25-4ff9-6e7f-37b4da43d235"
download_agent "vyse" "efba5359-4016-a1e5-7626-b1ae76895940"
download_agent "tejo" "4c3488b8-44fe-3f53-a8e6-a9837fa3e1d7"

echo "Downloading map images..."
download_map "ascent" "7eaecc1b-4337-bbf6-6ab9-04b8f06b3319"
download_map "bind" "2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba"
download_map "haven" "2bee0dc9-4ffe-519b-1cbd-7fbe763a6047"
download_map "split" "d960549e-485c-e861-8d71-aa9d1aed12a2"
download_map "icebox" "e2ad5c54-4114-a870-9641-8ea21279579a"
download_map "breeze" "2fb9a4fd-47b8-4e7d-a969-74b4046ebd53"
download_map "fracture" "b529448b-4d60-346e-e89e-00a4c527a405"
download_map "pearl" "fd267378-4d1d-484f-ff52-77821ed10dc2"
download_map "lotus" "2fe4ed3a-450a-948b-6d6b-e89a78e680a9"
download_map "sunset" "92584fbe-486a-b1b2-9faa-39b0f486b498"
download_map "abyss" "224b0a95-48b9-f703-1bd8-67aca101a61f"

echo ""
echo "Asset download complete!"
echo "Agent icons: $(ls -1 "$ASSETS_DIR/agents" 2>/dev/null | wc -l | tr -d ' ')"
echo "Map images: $(ls -1 "$ASSETS_DIR/maps" 2>/dev/null | wc -l | tr -d ' ')"
echo ""
echo "Note: Team logos need to be sourced manually from official team pages."
