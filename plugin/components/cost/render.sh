#!/usr/bin/env bash
# cost — session cost in USD. segment; reads CC_COST, returns via $REPLY.
render__cost() {   # $1 = config JSON (unused)
  case "$CC_COST" in ""|"0"|"-") return 0;; esac
  printf -v REPLY "${VAL}\$%.2f${RESET}" "$CC_COST"
}
