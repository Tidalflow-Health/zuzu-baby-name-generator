#!/bin/bash

# Script to deploy the Vercel API with environment variables
# Replace YOUR_OPENAI_API_KEY with your actual API key before running

# Ensure we're in the right directory
cd "$(dirname "$0")"

# Deploy with environment variables
echo "Deploying Vercel API with environment variables..."
vercel deploy --prod --env OPENAI_API_KEY=YOUR_OPENAI_API_KEY

echo "Deployment complete!" 