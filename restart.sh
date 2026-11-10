#!/usr/bin/env bash
# Nightwatch - restart = stop + start.
cd "$(dirname "$0")"
./stop.sh
./start.sh