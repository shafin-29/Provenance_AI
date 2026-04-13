# Use Python 3.11 as the base image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV PORT 8080

# Install system dependencies and Node.js (for Prisma)
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy dependency files
COPY requirements.txt package.json ./

# Install Python and Node dependencies
RUN pip install --no-cache-dir -r requirements.txt
RUN npm install

# Copy application code
COPY . .

# Generate Prisma client (Python)
RUN npx prisma generate

# Expose the port
EXPOSE 8080

# Start command
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
