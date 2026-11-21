# Shared by the verify-canplan scripts. Every machine-specific value is looked up here,
# and each one can be overridden with an environment variable.
set -euo pipefail
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8   # CocoaPods fails without a UTF-8 locale

ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
APP="$ROOT/ts-native-canplan"
BUNDLE_ID=com.zectan.canplan
METRO_PORT="${CANPLAN_METRO_PORT:-8082}"   # 8082, so it never collides with a Metro on the default 8081
SIM_DERIVED="$APP/build-device/sim"        # build-device/ is git-ignored
PHONE_DERIVED="$APP/build-device"
EVIDENCE_DIR="$APP/build-device/evidence"
AGENT_DEVICE_VERSION=0.21.41

# The booted iPhone simulator, else the first available one. Override: CANPLAN_SIM_UDID.
sim_udid() {
  [[ -n "${CANPLAN_SIM_UDID:-}" ]] && { echo "$CANPLAN_SIM_UDID"; return; }
  xcrun simctl list devices available -j | node -e '
    let s = ""; process.stdin.on("data", (c) => (s += c)).on("end", () => {
      const all = Object.values(JSON.parse(s).devices).flat().filter((d) => d.name.startsWith("iPhone"));
      const d = all.find((x) => x.state === "Booted") ?? all[0];
      if (!d) { console.error("No iPhone simulator. Create one in Xcode > Devices."); process.exit(1); }
      console.log(d.udid);
    });'
}

# The first paired physical iPhone. Override: CANPLAN_PHONE_UDID.
phone_udid() {
  [[ -n "${CANPLAN_PHONE_UDID:-}" ]] && { echo "$CANPLAN_PHONE_UDID"; return; }
  local f; f="$(mktemp)"
  xcrun devicectl list devices --json-output "$f" >/dev/null 2>&1
  node -e '
    const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).result.devices.find((x) =>
      x.hardwareProperties?.reality === "physical" && x.hardwareProperties?.deviceType === "iPhone" &&
      x.connectionProperties?.pairingState === "paired");
    if (!d) { console.error("No paired iPhone. Connect and unlock it, and trust this Mac."); process.exit(1); }
    console.log(d.hardwareProperties.udid);' "$f"
  rm -f "$f"
}

# The Apple team of the first "Apple Development" signing identity. Override: CANPLAN_TEAM_ID.
team_id() {
  [[ -n "${CANPLAN_TEAM_ID:-}" ]] && { echo "$CANPLAN_TEAM_ID"; return; }
  local name
  name="$(security find-identity -v -p codesigning | sed -n 's/.*"\(Apple Development: [^"]*\)".*/\1/p' | head -1)"
  [[ -n "$name" ]] || { echo "No Apple Development signing identity. Sign in to Xcode with an Apple ID." >&2; return 1; }
  security find-certificate -c "$name" -p | openssl x509 -noout -subject | sed -n 's/.*OU *= *\([A-Z0-9]*\).*/\1/p'
}

# The checkout that holds the git-ignored demo/ data: the main worktree. Override: CANPLAN_DEMO_SOURCE.
demo_source() {
  [[ -n "${CANPLAN_DEMO_SOURCE:-}" ]] && { echo "$CANPLAN_DEMO_SOURCE"; return; }
  echo "$(git -C "$ROOT" worktree list --porcelain | sed -n '1s/^worktree //p')/ts-native-canplan/demo"
}
