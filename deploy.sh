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
  -p 5050:5050 \
  --env-file .env \
  --restart unless-stopped \
  zyotrabackend

echo "Deployment complete!"
docker logs --tail 50 zyotrabackend