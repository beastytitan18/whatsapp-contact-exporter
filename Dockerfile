FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies for node-gyp and canvas (if needed)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Create volume mount points for auth and output
RUN mkdir -p /app/auth_info /app/output

# Set environment variables
ENV NODE_ENV=production

# Run the application
CMD ["node", "dist/index.js"]
