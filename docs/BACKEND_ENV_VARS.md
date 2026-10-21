# Backend Environment Variables

The following environment variables must be added to your mission-specific `.env` files (e.g., `configs/missions/m20/m20.sops.env`) to enable the backend server deployment:

## Required Variables

### Backend Docker Image Configuration
```bash
# The name of the backend Docker image
ASTRIA_API_DOCKER_IMAGE_NAME="astria_backend"
```

### Backend Server Port
```bash
# Port for the backend server (default: 3001)
ASTRIA_API_PORT=3001
```

### CSSO Authentication Credentials
```bash
# Application account username for CSSO authentication
# This is used by the backend to authenticate and gather mosaics
ASTRIA_APP_ACCOUNT_USER="your_app_account_username"

# Application account password for CSSO authentication
# IMPORTANT: This should be encrypted or stored in a secure secrets manager
ASTRIA_APP_ACCOUNT_PASS="your_app_account_password"
```

## Example Configuration

Add these lines to your mission-specific env file:

```bash
# Backend Configuration
ASTRIA_API_DOCKER_IMAGE_NAME="astria_backend"
ASTRIA_API_PORT=3001
ASTRIA_APP_ACCOUNT_USER="astria_app_user"
ASTRIA_APP_ACCOUNT_PASS="secure_password_here"
```

## Security Notes

⚠️ **IMPORTANT**: The `ASTRIA_APP_ACCOUNT_PASS` variable contains sensitive credentials and should:
- Never be committed to version control in plain text
- Be encrypted using tools like SOPS (Mozilla's Secrets OPerationS)
- Be injected at runtime from a secure secrets manager in production
- Have appropriate access controls in your deployment environment

## Optional Variables

The backend will use defaults from the application's generated config JSON if these are not set:
- `NODE_ENV` - Set to `production` by default in docker-compose.yml
- `PORT` - Defaults to 3001 if not specified
- `ASTRIA_MISSION_CONFIG_NAME` - Name of the config file to load at runtime (default: `config`). The server reads `public/configs/<name>.json` on startup. Can be specified with or without the `.json` extension.

## Testing Locally

For local development, you can test the backend without Docker:
```bash
export APP_ACCOUNT_USER="your_username"
export APP_ACCOUNT_PASS="your_password"
npm run server
```
