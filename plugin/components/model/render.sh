#!/usr/bin/env bash
# model — current model display name. segment; reads CC_MODEL, returns via $REPLY.
render__model() {   # $1 = config JSON (unused)
  [ -n "$CC_MODEL" ] || return 0
  printf -v REPLY "${CYAN}%s${RESET}" "$CC_MODEL"
}
