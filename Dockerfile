# Use the official Node.js runtime as the base image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Create necessary directories and files
RUN mkdir -p /app/data && \
    touch /app/data/account.txt && \
    touch /app/data/live_data.json && \
    touch /app/data/scraping.log

# Expose the port the app runs on
EXPOSE 3000

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "const http = require('http'); \
  const options = { hostname: 'localhost', port: 3000, path: '/health', timeout: 5000 }; \
  const req = http.request(options, (res) => { \
    if (res.statusCode === 200) { console.log('Health check passed'); process.exit(0); } \
    else { console.log('Health check failed'); process.exit(1); } \
  }); \
  req.on('error', () => { console.log('Health check error'); process.exit(1); }); \
  req.end();"

# Set production environment
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]
