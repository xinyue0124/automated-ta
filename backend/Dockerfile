FROM node:20-slim

WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Install dependencies
RUN npm install

COPY . .

EXPOSE 3001

CMD ["npm", "run", "dev"]

