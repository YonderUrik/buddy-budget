#!/bin/sh
# Obtains and renews the staging certificate (certbot, Cloudflare DNS-01). The token stays in a file
# readable only inside this container, never in the command line or the logs.
set -eu
umask 077
printf 'dns_cloudflare_api_token = %s\n' "$CLOUDFLARE_DNS_API_TOKEN" > /tmp/cloudflare.ini
while :; do
  certbot certonly --non-interactive --agree-tos --email "$ACME_EMAIL" \
    --dns-cloudflare --dns-cloudflare-credentials /tmp/cloudflare.ini --dns-cloudflare-propagation-seconds 30 \
    --cert-name staging -d "$STAGING_DOMAIN" --keep-until-expiring \
    || echo "Certificate request failed; retrying in 12 hours."
  sleep 12h
done
