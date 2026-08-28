# GitHub Setup Script for CHO Appointment System
# Run this script after creating your GitHub repository manually

Write-Host "CHO Appointment System - GitHub Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Ask for GitHub username
$githubUsername = Read-Host "Enter your GitHub username"
if ([string]::IsNullOrWhiteSpace($githubUsername)) {
    Write-Host "Error: GitHub username is required" -ForegroundColor Red
    exit 1
}

# Ask for repository name (default: cho-appointment-system)
$repoName = Read-Host "Enter repository name (default: cho-appointment-system)"
if ([string]::IsNullOrWhiteSpace($repoName)) {
    $repoName = "cho-appointment-system"
}

# Construct GitHub URL
$githubUrl = "https://github.com/$githubUsername/$repoName.git"

Write-Host ""
Write-Host "Setting up git remote..." -ForegroundColor Yellow
git remote add origin $githubUrl

Write-Host "Renaming branch to main..." -ForegroundColor Yellow
git branch -M main

Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
git push -u origin main

Write-Host ""
Write-Host "✅ Successfully pushed to GitHub!" -ForegroundColor Green
Write-Host "Repository URL: $githubUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Visit $githubUrl to verify the repository" -ForegroundColor White
Write-Host "2. Follow the deployment guide in DEPLOYMENT.md for Vercel setup" -ForegroundColor White
Write-Host ""