#!/usr/bin/env bash
# Nightwatch — restart = stop + start.
exec "$(cd "$(dirname "$0")" && pwd)/stop.sh"
exec "$(cd "$(dirname "$0")" && pwd)/start.sh"