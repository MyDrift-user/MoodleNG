FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build:prod

FROM node:20-alpine

# Install PostgreSQL client and other dependencies
RUN apk add --no-cache postgresql-client

WORKDIR /app

# Copy built app - correct path for Angular output
COPY --from=build /app/dist/moodle-ng/browser /app/dist

# Copy server files
COPY server /app/server

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Create upload directory
RUN mkdir -p /app/server/uploads

EXPOSE 80

# Start Node.js server
CMD ["node", "server/index.js"]
