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
WORKDIR /app
RUN apk add --no-cache git python3 py3-pip build-base
RUN python3 -m venv /venv
ENV PATH="/venv/bin:$PATH"
RUN pip install semgrep

# Copy only necessary files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Expose microservice port
EXPOSE 3000

# Set environment variables (optional)
ENV NODE_ENV=production

# Start the NestJS microservice
CMD ["node", "dist/main.js"] 