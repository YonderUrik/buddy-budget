#!/bin/sh
set -eu
if [ "${1:-}" = call ]; then
  exec wget -q -O /dev/null --header "Authorization: Bearer $CRON_SECRET" "http://app:3000/api/cron/$2"
fi
# Keep the secret out of the crontab and crond's command log.
call() { echo "sh /scheduler.sh call $1"; }
{
  echo "30 6,17,22 * * * $(call market-prices)"
  echo "50 6,17,23 * * * $(call net-worth-snapshot)"
  echo "30 3 * * * $(call account-deletion)"
  echo "30 7 * * * $(call notifications)"
  echo "0 2 * * * $(call public-demo)"
} > /etc/crontabs/root
# No live bank jobs or inactive-account cleanup in staging.
exec crond -f -l 8
