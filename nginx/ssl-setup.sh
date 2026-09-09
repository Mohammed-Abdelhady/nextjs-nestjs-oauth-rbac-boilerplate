#!/bin/bash

# SSL Certificate Setup Script for Nginx
# This script helps set up SSL certificates for the nginx reverse proxy

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="${1:-}"
EMAIL="${2:-}"
CERT_TYPE="${3:-letsencrypt}"

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if domain is provided
if [ -z "$DOMAIN" ]; then
    print_error "Domain name is required!"
    echo "Usage: ./ssl-setup.sh <domain> <email> [letsencrypt|self-signed]"
    echo "Example: ./ssl-setup.sh example.com admin@example.com letsencrypt"
    exit 1
fi

# Check if email is provided for Let's Encrypt
if [ "$CERT_TYPE" = "letsencrypt" ] && [ -z "$EMAIL" ]; then
    print_error "Email is required for Let's Encrypt certificates!"
    echo "Usage: ./ssl-setup.sh <domain> <email> [letsencrypt|self-signed]"
    echo "Example: ./ssl-setup.sh example.com admin@example.com letsencrypt"
    exit 1
fi

# Create SSL directory
print_info "Creating SSL directory..."
mkdir -p ssl

# Option 1: Let's Encrypt
if [ "$CERT_TYPE" = "letsencrypt" ]; then
    print_info "Setting up Let's Encrypt SSL certificates for $DOMAIN..."
    
    # Check if docker-compose is available
    if ! command -v docker-compose &> /dev/null; then
        print_error "docker-compose is not installed!"
        exit 1
    fi
    
    # Start services without nginx (to avoid SSL errors)
    print_info "Starting services (without nginx)..."
    docker-compose -f ../docker-compose.prod.yml up -d mongodb backend frontend
    
    # Wait for services to be ready
    print_info "Waiting for services to be ready..."
    sleep 10
    
    # Obtain certificates
    print_info "Obtaining SSL certificates from Let's Encrypt..."
    docker-compose -f ../docker-compose.prod.yml run --rm certbot certonly \
        --webroot \
        --webroot-path /var/www/certbot \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        -d "$DOMAIN" \
        -d "www.$DOMAIN" || {
        print_error "Failed to obtain certificates!"
        exit 1
    }
    
    # Copy certificates to ssl directory
    print_info "Copying certificates to ssl directory..."
    docker cp authboiler-certbot-prod:/etc/letsencrypt/live/$DOMAIN/fullchain.pem ssl/
    docker cp authboiler-certbot-prod:/etc/letsencrypt/live/$DOMAIN/privkey.pem ssl/
    docker cp authboiler-certbot-prod:/etc/letsencrypt/live/$DOMAIN/chain.pem ssl/
    
    # Set proper permissions
    chmod 644 ssl/*.pem
    chmod 600 ssl/privkey.pem
    
    print_info "Certificates obtained successfully!"
    print_info "Starting nginx..."
    docker-compose -f ../docker-compose.prod.yml up -d nginx
    
    print_info "SSL setup completed successfully!"
    print_info "Your site should now be accessible at https://$DOMAIN"

# Option 2: Self-Signed (Development Only)
elif [ "$CERT_TYPE" = "self-signed" ]; then
    print_warning "Setting up self-signed certificates (DEVELOPMENT ONLY)..."
    print_warning "Do NOT use self-signed certificates in production!"
    
    # Generate self-signed certificate
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ssl/privkey.pem \
        -out ssl/fullchain.pem \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN" || {
        print_error "Failed to generate self-signed certificate!"
        exit 1
    }
    
    # Create chain.pem (copy of fullchain.pem for self-signed)
    cp ssl/fullchain.pem ssl/chain.pem
    
    # Set proper permissions
    chmod 644 ssl/*.pem
    chmod 600 ssl/privkey.pem
    
    print_info "Self-signed certificates generated successfully!"
    print_warning "Remember: Self-signed certificates will show security warnings in browsers!"

else
    print_error "Invalid certificate type: $CERT_TYPE"
    echo "Valid options: letsencrypt, self-signed"
    exit 1
fi

# Update nginx.conf with domain
print_info "Updating nginx.conf with domain: $DOMAIN"
if [ -f "nginx.conf" ]; then
    # Backup original config
    cp nginx.conf nginx.conf.backup
    
    # Replace server_name
    sed -i.tmp "s/server_name _;/server_name $DOMAIN www.$DOMAIN;/" nginx.conf
    rm -f nginx.conf.tmp
    
    print_info "nginx.conf updated successfully!"
    print_info "Original config backed up to nginx.conf.backup"
else
    print_warning "nginx.conf not found. Please update server_name manually."
fi

print_info "Setup completed!"
print_info "Next steps:"
print_info "1. Review the nginx configuration: cat nginx.conf"
print_info "2. Start all services: docker-compose -f ../docker-compose.prod.yml up -d"
print_info "3. Check logs: docker-compose -f ../docker-compose.prod.yml logs -f nginx"
