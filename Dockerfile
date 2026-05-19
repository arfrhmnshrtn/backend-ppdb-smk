# Gunakan node versi terbaru
FROM node:22-alpine

# Working directory
WORKDIR /app

# Copy package
COPY package*.json ./

# Install dependency
RUN npm install

# Copy semua file
COPY . .

# Generate prisma
RUN npx prisma generate

# Build nestjs
RUN npm run build

# Expose port
EXPOSE 3001

# Jalankan aplikasi
CMD ["node", "dist/main"]