# Use Node.js 22 Alpine for smaller image size
FROM node:22-alpine

# Install Python, pip, and curl for the quantum AI components and health checks
RUN apk add --no-cache python3 py3-pip gcc g++ make curl

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY requirements.txt ./

# Install Node.js dependencies
RUN npm ci --only=production

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/health/live || exit 1

# Start the application
CMD ["npm", "start"]