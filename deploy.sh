#!/bin/bash

echo "Pulling latest changes..."
git pull origin main

echo "Building Docker image..."
docker build -t zyotrabackend .

echo "Stopping old container..."
docker stop zyotrabackend 2>/dev/null || true
docker rm zyotrabackend 2>/dev/null || true

echo "Starting new container..."
docker run -d \
  --name zyotrabackend \
  --network host \
  --env-file .env \
  --restart unless-stopped \
  zyotrabackend

echo "Deployment complete!"
echo "Waiting for container to start..."
sleep 3
docker logs --tail 50 zyotrabackend