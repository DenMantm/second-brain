# Production-only build - copies pre-built application
# Build locally first: npm run build
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies
COPY package.json ./
RUN npm install --omit=dev --prefer-offline && \
    npm cache clean --force

# Copy pre-built application
COPY dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3030

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3030/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "dist/main.js"]
