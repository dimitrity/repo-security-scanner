# Use official Node.js 20 Alpine image
FROM node:20-alpine as builder

# Set working directory
WORKDIR /app
RUN apk add --no-cache git python3 py3-pip build-base
RUN python3 -m venv /venv
ENV PATH="/venv/bin:$PATH"
RUN pip install semgrep

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production=false

# Copy source code
COPY . .

# Build the app
RUN npm run build
RUN ls -la dist/

# Production image
FROM node:20-alpine as production

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Install required packages as root
RUN apk add --no-cache git python3 py3-pip build-base && \
    python3 -m venv /venv && \
    chown -R nestjs:nodejs /venv

# Set PATH for the virtual environment
ENV PATH="/venv/bin:$PATH"

# Install semgrep as root, then change ownership
RUN pip install semgrep && \
    chown -R nestjs:nodejs /venv

# Copy only necessary files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Change ownership of application files to non-root user
RUN chown -R nestjs:nodejs /app

# Expose microservice port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Switch to non-root user for security
USER nestjs

# Start the NestJS microservice
CMD ["node", "dist/main.js"] 