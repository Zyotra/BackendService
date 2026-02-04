# Use official Bun image as base
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies into a temp directory for caching
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock* /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# Install production dependencies only
RUN mkdir -p /temp/prod
COPY package.json bun.lock* /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# Build stage
FROM base AS build
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# Build the application
RUN bun build src/index.ts --outdir dist --target=bun

# Production stage
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5050

# Expose port 5050
EXPOSE 5050

# Run the app
USER bun
CMD ["bun", "run", "dist/index.js"]
