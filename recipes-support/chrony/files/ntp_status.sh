#!/bin/sh

STATE_FILE="/run/ntp-sync.state"
TAG="ntp-monitor"

STATE="UNKNOWN"

while true; do

    # --- lecture chrony ---
    if chronyc tracking | grep -q "Leap status.*Normal" && \
       chronyc sources | grep -q '^\^\*'; then
        NEW_STATE="OK"
    else
        NEW_STATE="KO"
    fi

    # --- changement d’état uniquement ---
    if [ "$NEW_STATE" != "$STATE" ]; then
        logger -t $TAG "NTP state change: $STATE -> $NEW_STATE"

        STATE=$NEW_STATE
        echo "$STATE" > $STATE_FILE
    fi

    sleep 2
done