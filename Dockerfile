# See https://www.nextjs.org/docs/pages/building-your-application/deploying/docker
# Dockerfile for Next.js application

# 1. Builder Stage: Install dependencies and build the application
FROM node:18-alpine AS builder
# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install dependencies
# Use --production flag if you don't need devDependencies for the build
RUN npm install

# Copy the rest of the application source code
COPY . .

# Build the Next.js application
RUN npm run build

# 2. Runner Stage: Create the final, lean image
FROM node:18-alpine AS runner
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

# Create a non-root user for security purposes
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built assets from the builder stage
# This includes the .next folder, public folder, and package.json for running the server
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# The Next.js server doesn't need the full node_modules, but this setup is simpler.
# For a more optimized image, you could copy only the production dependencies.

# Change ownership of the working directory to the non-root user
USER nextjs

# Expose the port the app will run on
EXPOSE 3000

# Set the default command to start the Next.js server
CMD ["npm", "start"]
