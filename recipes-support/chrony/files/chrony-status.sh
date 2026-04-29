#!/bin/sh

extract_tracking_field() {
    printf '%s\n' "$TRACKING_OUTPUT" | awk -v key="$1" '
        {
            separator = index($0, ":")
            if (separator == 0) {
                next
            }

            field = substr($0, 1, separator - 1)
            gsub(/[[:space:]]+$/, "", field)

            if (field == key) {
                value = substr($0, separator + 1)
                sub(/^[[:space:]]+/, "", value)
                print value
                exit
            }
        }
    '
}

extract_source_field() {
    printf '%s\n' "$SELECTED_LINE" | awk -v column="$1" '{ print $column }'
}

if ! command -v chronyc >/dev/null 2>&1; then
    printf 'sync_state=UNAVAILABLE\n'
    printf 'reason=chronyc_missing\n'
    exit 0
fi

TRACKING_OUTPUT="$(chronyc -n tracking 2>/dev/null || true)"
SOURCES_OUTPUT="$(chronyc -n sources 2>/dev/null || true)"

LEAP_STATUS="$(extract_tracking_field "Leap status")"
STRATUM="$(extract_tracking_field "Stratum")"
REFERENCE_ID="$(extract_tracking_field "Reference ID")"
REFERENCE_TIME_UTC="$(extract_tracking_field "Ref time (UTC)")"
SYSTEM_TIME="$(extract_tracking_field "System time")"
LAST_OFFSET="$(extract_tracking_field "Last offset")"
RMS_OFFSET="$(extract_tracking_field "RMS offset")"
UPDATE_INTERVAL="$(extract_tracking_field "Update interval")"

REFERENCE_SOURCE="$(printf '%s\n' "$REFERENCE_ID" | sed -n 's/.*(\(.*\)).*/\1/p')"
if [ -z "$REFERENCE_SOURCE" ]; then
    REFERENCE_SOURCE="$REFERENCE_ID"
fi

SELECTED_LINE="$(printf '%s\n' "$SOURCES_OUTPUT" | awk '/^[=^#][*+x~?-]/ && substr($1, 2, 1) == "*" { print; exit }')"
SELECTED_SOURCE="$(extract_source_field 2)"
SELECTED_STRATUM="$(extract_source_field 3)"
SELECTED_POLL="$(extract_source_field 4)"
SELECTED_REACH="$(extract_source_field 5)"
SELECTED_LASTRX="$(extract_source_field 6)"

ONLINE_SOURCES="$(printf '%s\n' "$SOURCES_OUTPUT" | awk '/^[=^#][*+x~?-]/ { count++ } END { print count + 0 }')"

SYNC_STATE="KO"
if [ "$LEAP_STATUS" = "Normal" ] && [ -n "$SELECTED_SOURCE" ]; then
    SYNC_STATE="OK"
fi

printf 'sync_state=%s\n' "$SYNC_STATE"
printf 'reference_source=%s\n' "$REFERENCE_SOURCE"
printf 'selected_source=%s\n' "$SELECTED_SOURCE"
printf 'selected_stratum=%s\n' "$SELECTED_STRATUM"
printf 'selected_poll=%s\n' "$SELECTED_POLL"
printf 'selected_reach=%s\n' "$SELECTED_REACH"
printf 'selected_lastrx=%s\n' "$SELECTED_LASTRX"
printf 'online_sources=%s\n' "$ONLINE_SOURCES"
printf 'tracking_stratum=%s\n' "$STRATUM"
printf 'reference_time_utc=%s\n' "$REFERENCE_TIME_UTC"
printf 'leap_status=%s\n' "$LEAP_STATUS"
printf 'system_time=%s\n' "$SYSTEM_TIME"
printf 'last_offset=%s\n' "$LAST_OFFSET"
printf 'rms_offset=%s\n' "$RMS_OFFSET"
printf 'update_interval=%s\n' "$UPDATE_INTERVAL"