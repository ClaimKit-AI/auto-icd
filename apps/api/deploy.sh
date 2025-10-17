#!/bin/bash
# ICD-10-CM Diagnosis Assistant - Deployment Script
# This script handles deployment to production or development environments
#
# Usage:
#   ./deploy.sh prod     # Deploy to production
#   ./deploy.sh dev      # Deploy to development
#   ./deploy.sh check    # Check current status

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

# Check if .env file exists
check_env_file() {
    if [ ! -f .env ]; then
        print_error ".env file not found!"
        print_info "Creating .env from env.example..."
        
        if [ -f env.example ]; then
            cp env.example .env
            print_warning "Please edit .env and add your actual credentials"
            print_info "Required variables: DATABASE_URL, OPENAI_API_KEY"
            exit 1
        else
            print_error "env.example file not found!"
            exit 1
        fi
    fi
    
    # Check if required environment variables are set
    source .env
    
    if [ -z "$DATABASE_URL" ]; then
        print_error "DATABASE_URL not set in .env file!"
        exit 1
    fi
    
    if [ -z "$OPENAI_API_KEY" ]; then
        print_warning "OPENAI_API_KEY not set in .env file (required for AI search)"
    fi
    
    print_success ".env file found and validated"
}

# Check if PM2 is installed
check_pm2() {
    if ! command -v pm2 &> /dev/null; then
        print_error "PM2 is not installed!"
        print_info "Installing PM2 globally..."
        npm install -g pm2
        print_success "PM2 installed successfully"
    else
        print_success "PM2 is installed"
    fi
}

# Check if node_modules exists
check_dependencies() {
    if [ ! -d "node_modules" ]; then
        print_warning "node_modules not found. Installing dependencies..."
        npm install
        print_success "Dependencies installed"
    else
        print_success "Dependencies are installed"
    fi
}

# Deploy to production
deploy_production() {
    print_header "Deploying to PRODUCTION"
    
    # Stop and remove existing process
    print_info "Stopping existing processes..."
    pm2 stop icd-api 2>/dev/null || true
    pm2 delete icd-api 2>/dev/null || true
    
    # Start the application
    print_info "Starting API server in production mode..."
    pm2 start ecosystem.config.js --env production
    
    # Save PM2 process list
    pm2 save
    
    # Setup PM2 startup script (only needs to be done once)
    print_info "Setting up PM2 to start on boot..."
    pm2 startup systemd -u $USER --hp $HOME | grep -v 'PM2' | bash || true
    
    print_success "Production deployment complete!"
}

# Deploy to development
deploy_development() {
    print_header "Deploying to DEVELOPMENT"
    
    # Stop and remove existing process
    print_info "Stopping existing processes..."
    pm2 stop icd-api 2>/dev/null || true
    pm2 delete icd-api 2>/dev/null || true
    
    # Start the application
    print_info "Starting API server in development mode..."
    pm2 start ecosystem.config.js --env development
    
    # Save PM2 process list
    pm2 save
    
    print_success "Development deployment complete!"
}

# Check status
check_status() {
    print_header "Current Status"
    
    print_info "PM2 Processes:"
    pm2 list
    
    echo ""
    print_info "Testing API Health:"
    
    # Wait a moment for the server to be ready
    sleep 2
    
    # Test health endpoint
    if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        print_success "API is responding"
        
        # Check database connection
        DB_STATUS=$(curl -s http://localhost:3000/api/health | grep -o '"connected":[^,]*' | cut -d':' -f2)
        if [ "$DB_STATUS" = "true" ]; then
            print_success "Database is connected"
        else
            print_error "Database connection failed"
        fi
    else
        print_error "API is not responding"
    fi
    
    echo ""
    print_info "Recent Logs:"
    pm2 logs icd-api --lines 10 --nostream
}

# Main script
main() {
    print_header "ICD API Deployment Script"
    
    # Get deployment environment
    ENV=${1:-prod}
    
    case $ENV in
        prod|production)
            print_info "Environment: PRODUCTION"
            check_env_file
            check_pm2
            check_dependencies
            deploy_production
            check_status
            
            print_header "Deployment Summary"
            print_success "API is running in production mode"
            print_info "View logs: npm run pm2:logs"
            print_info "Restart: npm run pm2:restart"
            print_info "Stop: npm run pm2:stop"
            ;;
            
        dev|development)
            print_info "Environment: DEVELOPMENT"
            check_env_file
            check_pm2
            check_dependencies
            deploy_development
            check_status
            
            print_header "Deployment Summary"
            print_success "API is running in development mode"
            print_info "View logs: npm run pm2:logs"
            print_info "Restart: npm run pm2:restart"
            print_info "Stop: npm run pm2:stop"
            ;;
            
        check|status)
            check_status
            ;;
            
        *)
            print_error "Invalid environment: $ENV"
            print_info "Usage: ./deploy.sh [prod|dev|check]"
            print_info "  prod  - Deploy to production"
            print_info "  dev   - Deploy to development"
            print_info "  check - Check current status"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"

