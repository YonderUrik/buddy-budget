#!/bin/bash
IMAGE_TYPE=$1
VERSION=0.0.1

echo "Building bb_backend image. You have 5 seconds to stop the script"
sleep 5
docker build ./backend -f backend/Dockerfile -t bb_backend:$VERSION
docker image push bb_backend:$VERSION

