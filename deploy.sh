#!/bin/bash
OPERATION=$1

if [ "$OPERATION" = "stop" ]; then
	echo "Removing buddybudget stack... 5 seconds to stop"
	# sleep 5
	docker stack rm buddybudget
else
    docker stack deploy -c docker-compose.yml buddybudget
fi