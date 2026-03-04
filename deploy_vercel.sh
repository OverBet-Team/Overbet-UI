#!/bin/bash
set -e

echo "Deploying to Vercel and configuring automatic deployments..."

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "Vercel CLI not found. Installing..."
    npm i -g vercel
fi

# Link the project to Vercel
echo "Linking project to Vercel..."
vercel link --yes

# Connect the Vercel project to the GitHub repository to enable automatic active deployments on branch pushes
echo "Connecting Vercel to GitHub for automatic deployments..."
vercel git connect --yes

# Trigger the initial production deployment
echo "Deploying to production..."
vercel deploy --prod

echo "Vercel deployment setup complete."
