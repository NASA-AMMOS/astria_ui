# Developer Guide

This guide covers setup, development workflow, and technical details for Astria contributors.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 20+** and **npm 10+** (recommend using [nvm](https://github.com/nvm-sh/nvm))
- **Docker Desktop** (for backend services)
- **mkcert** (for local HTTPS certificates)
- **Git**
- **~500MB disk space** for dependencies
- **Modern web browser** (Chrome or Firefox recommended)

## Quick Setup

```bash
# Clone the repository
git clone https://github.jpl.nasa.gov/MIPL/astria.git
cd astria

# Use correct Node version (if using nvm)
nvm use

# Install dependencies
npm install

# Create SSL certificates
mkdir -p .cert
mkcert -install
mkcert -key-file ./.cert/key.pem -cert-file ./.cert/cert.pem 'localhost'

# Start development server
./.dev/start.sh

# Open browser to https://localhost:3000
```

**Note:** The `.cert` directory is gitignored and should not be committed.

## Verify Installation

After starting the server, you should see:

```
VITE v5.x.x  ready in XXX ms

➜  Local:   https://localhost:3000/
➜  Network: use --host to expose
```

Open `https://localhost:3000` in your browser and click through the self-signed certificate warning.

## Mission Configuration Setup

Astria uses a flexible configuration system to support multiple missions and deployment environments. Mission-specific configurations are stored in **separate external repositories** and symlinked into this repository, as they may contain sensitive deployment information.

### Understanding the Configuration System

1. **Base Configuration**: `configs/config.common.json` (in this repo) - Contains common settings used by all instances
2. **Mission Configs**: External repositories symlinked to `configs/missions/[MISSION_NAME]/` - Mission-specific overrides
3. **Environment Files**: `.env` files that specify which configs to merge together

### Option A: Using Default Configuration (No Mission Access)

The default setup is covered in the [Getting Started Guide](GETTING_STARTED.md). This section focuses on mission-specific configurations.

### Option B: Using Mission Configuration (JPL/Mission Teams)

If you have access to mission configurations:

**1. Clone or locate your mission config repository**

Obtain the repository URL from your mission lead. Example missions might include:
- M2020 (Mars 2020 Perseverance)
- MSL (Mars Science Laboratory/Curiosity)
- Other planetary missions

**2. Create the missions directory and symlink your config**

```shell
# Create missions directory if it doesn't exist
mkdir -p configs/missions

# Symlink your mission config repo
ln -s /path/to/your/mission-configs configs/missions/m2020
```

Your directory structure should look like:
```
configs/
├── config.common.json          # Base config (in this repo)
├── default.env                 # Default env file (in this repo)
└── missions/                   # Directory for mission configs
    └── m2020/                  # Symlinked external repo
        ├── dev.env             # Development environment
        ├── prod.env            # Production environment
        ├── config.base.json    # Mission base config
        └── config.venue.json   # Venue-specific config
```

**3. Start with your mission configuration**

```shell
# Start with mission dev environment
./.dev/start.sh -e ./configs/missions/m2020/dev.env
```

### Environment File Format

A typical `.env` file contains:

```shell
# Override the default version string displayed in the application (default is pulled from package.json)
ASTRIA_APP_VERSION=v2.0-m2020

# Comma-separated list of paths to config files to merge together
# ${ASTRIA_ENV_DIR} is automatically set to the directory containing this .env file
# Paths can be relative to ${ASTRIA_ENV_DIR} or absolute
ASTRIA_CONFIG_BUILD_SRC_PATHS="${ASTRIA_ENV_DIR}/config.base.json,${ASTRIA_ENV_DIR}/config.venue.json"

# Set to true to run the Node.js backend server via Docker (optional)
ASTRIA_RUN_DOCKER_CONTAINERS=false

# Path to additional docker-compose file for backend services (optional)
ASTRIA_EXTRA_DOCKER_COMPOSE="${ASTRIA_ENV_DIR}/docker-compose.backend.yml"

# Server ports (used in dev and as Docker build arg)
ASTRIA_UI_PORT=3000               # Frontend port (Vite dev server or Docker container)
ASTRIA_API_PORT=3001              # Backend API port

# Public URL path - used as build argument for Docker images
ASTRIA_PUBLIC_URL_PATH="/"
```

### Configuration Merging

The build process merges configs in this order:
1. `configs/config.common.json` (implicit base, always included)
2. Files listed in `ASTRIA_CONFIG_BUILD_SRC_PATHS` (left to right, later values override earlier)

The final merged configuration is written to `src/constants/config.json` and used by the application.

## Starting Development Server

### With Mission Config

```shell
# Start with mission-specific configuration
./.dev/start.sh -e ./configs/missions/m2020/dev.env
```

### What the Start Script Does

1. Loads environment variables from the specified `.env` file (or `configs/default.env` by default)
2. Builds `src/constants/config.json` by merging configuration files
3. Creates symlinks to mission-specific public assets (if applicable)
4. Optionally starts Docker containers for backend services (if `ASTRIA_RUN_DOCKER_CONTAINERS=true`)
5. Starts the Vite development server with hot module replacement

### Accessing the Application

1. Navigate to `https://localhost:3000` (or the port specified in `ASTRIA_UI_PORT`)
2. Click through browser security warnings (self-signed certificate)
3. The application will automatically reload when you make code changes

**Recommended**: Use Chrome or Firefox for development (best debugging tools).

## Stopping Development Server

```shell
# 1. Stop Vite dev server
# Press Ctrl+C in the terminal running start.sh

# 2. Clean up symlinks and Docker containers
./.dev/stop.sh

# OR if using mission config with Docker containers:
./.dev/stop.sh -e ./configs/missions/m2020/dev.env
```

## Development Workflow

### Making Code Changes

1. **Frontend changes** (React components, Redux actions, CSS):
   - Edit files in `src/`
   - Vite will automatically reload the page
   - Check browser console for errors

2. **Backend changes** (`server.js`):
   - Stop the dev server (Ctrl+C)
   - Restart with `./.dev/start.sh -e /path/to/.env`

3. **Configuration changes**:
   - Edit config JSON files
   - Rebuild config in another terminal: `./.dev/start.sh --config-only -e /path/to/.env`
   - Or just restart the server with `./.dev/start.sh -e /path/to/.env`

### Code Formatting

Astria uses Prettier for code formatting:

```shell
# Format all files
npm run format-all

# Format runs automatically on git commit via husky
```

### Linting

```shell
# Run ESLint
npm run lint
```

### Running Tests

```shell
# Run test suite (if configured)
npm test
```

## Production Deployment

Astria can be deployed in production mode using Docker containers. Production mode is controlled by setting `ASTRIA_PRODUCTION=true` in your environment file.

### Prerequisites for Production

- Docker and Docker Compose installed
- Production environment configuration file (e.g., `prod.env`) with `ASTRIA_PRODUCTION=true`
- Optional: Additional docker-compose file specified in `ASTRIA_EXTRA_DOCKER_COMPOSE`

### Deploy Production Environment

```shell
# Deploy with production config
./.dev/start.sh -e ./configs/missions/m2020/prod.env

# This will:
# 1. Build the merged configuration
# 2. Create necessary symlinks
# 3. Build Docker images (frontend and backend)
# 4. Start containers in detached mode
```

The same command works for both dev and production - the env file determines the mode.

### Managing Production Deployment

```shell
# View logs
docker compose -f docker/docker-compose.yml logs -f

# View logs for specific service
docker compose -f docker/docker-compose.yml logs -f astria

# Stop production services
./.dev/stop.sh -e ./configs/missions/m2020/prod.env

# Restart production services
./.dev/stop.sh -e ./configs/missions/m2020/prod.env
./.dev/start.sh -e ./configs/missions/m2020/prod.env

# Check container health status
docker compose -f docker/docker-compose.yml ps

# Scale backend for increased load
docker compose -f docker/docker-compose.yml up -d --scale astria-backend=3
```

### Health Check Endpoint

The backend provides a health check endpoint at `/api/health` that returns container status without authentication:

```json
{
  "status": "healthy",
  "uptime": 12345.67,
  "memory": { "rss": 123456789, "heapTotal": 98765432, "heapUsed": 87654321 },
  "timestamp": 1234567890123,
  "environment": "production",
  "mosaicGathering": {
    "enabled": true,
    "isGathering": false,
    "lastGatherTime": 1234567890000,
    "cachedMosaicsCount": 42
  }
}
```

Docker uses this endpoint for automated health checks every 30 seconds. Load balancers and monitoring systems can also query this endpoint.

### Production Environment Variables

Your production `.env` file should specify:

```shell
# Enable production mode (required for production deployment)
ASTRIA_PRODUCTION=true

# Required: Config files to merge
ASTRIA_CONFIG_BUILD_SRC_PATHS="${ASTRIA_ENV_DIR}/config.base.json,${ASTRIA_ENV_DIR}/config.prod.json"

# Optional: Additional docker-compose file for backend services
ASTRIA_EXTRA_DOCKER_COMPOSE="${ASTRIA_ENV_DIR}/docker-compose.backend.yml"

# Docker image names (optional, defaults shown)
ASTRIA_FRONTEND_DOCKER_IMAGE_NAME=astria_ui
ASTRIA_API_DOCKER_IMAGE_NAME=astria_api

# Build-time configuration (baked into Docker images)
# These are passed as build arguments and cannot be changed after image is built
ASTRIA_UI_PORT=3000                    # Frontend port (default: 3000)
ASTRIA_API_PORT=3001                   # Backend API port (default: 3001)
ASTRIA_PUBLIC_URL_PATH=/               # Base URL path for deployment (default: /)

# Runtime environment variables (for backend only)
ASTRIA_APP_ACCOUNT_USER=your_user      # Backend authentication user (if required)
ASTRIA_APP_ACCOUNT_PASS=your_pass      # Backend authentication password (if required)
```

**Development vs Production:** The key difference is that development env files omit `ASTRIA_PRODUCTION` (or set it to `false`), while production env files set `ASTRIA_PRODUCTION=true`.

**Build Arguments vs Runtime Variables:**
- **Build arguments** (`ASTRIA_UI_PORT`, `ASTRIA_API_PORT`, `ASTRIA_PUBLIC_URL_PATH`) are baked into the Docker images at build time and make images portable
- **Runtime variables** (`ASTRIA_APP_ACCOUNT_USER`, `ASTRIA_APP_ACCOUNT_PASS`) are passed to containers when they start and can vary per deployment

### Build Docker Images (Without Deploying)

To build Docker images for deployment elsewhere without starting containers:

```shell
# Build all Docker images defined in docker-compose.yml
./.dev/build-image.sh -e ./configs/missions/m2020/prod.env

# Images will be built and tagged according to your env file
# Ready to push to a registry or deploy to another environment
```

### Build Static Assets (Without Docker)

If you need to build static assets without Docker:

```shell
# Build optimized production bundle
npm run build

# Output: build/ directory with static assets
```

## Configuration

Astria uses a flexible configuration system that merges multiple JSON files at build time. The application reads from `src/constants/config.json`, which is generated by merging:

1. `configs/config.common.json` (base configuration)
2. Mission-specific configs specified in `ASTRIA_CONFIG_BUILD_SRC_PATHS`

**Quick Reference:**

```shell
# Build config only (useful for debugging)
./.dev/start.sh --config-only -e ./configs/missions/m2020/dev.env

# Start server (automatically builds config first)
./.dev/start.sh -e ./configs/missions/m2020/dev.env
```

For detailed information about the configuration system, environment variables, and creating mission configs, see [Configuration Guide](CONFIGURATION.md).

## Directory Structure

```
.
├── .dev/                       # Development scripts
│   ├── build-config.js         # Config builder script
│   ├── build-image.sh          # Docker image build script
│   ├── build.sh                # Production build script
│   ├── start.sh                # Development server start script
│   └── stop.sh                 # Development server stop script
├── .github/                    # GitHub templates and workflows
├── .vscode/                    # VSCode workspace settings
├── configs/                    # Configuration files
│   ├── missions/               # Mission-specific configs (gitignored, symlinked)
│   ├── config.common.json      # Base configuration
│   ├── config.js               # Config loader/merger
│   └── default.env             # Default environment variables
├── docker/                     # Docker deployment files
│   ├── Dockerfile              # Frontend container image
│   ├── Dockerfile.api          # Backend API container image
│   ├── docker-compose.yml      # Production compose file
│   └── docker-compose.dev.yml  # Development compose file
├── docs/                       # Documentation
│   ├── CONFIGURATION.md        # Configuration system guide
│   ├── CONTRIBUTING.md         # Contribution guidelines
│   └── DEVELOPER.md            # This file
├── public/                     # Static assets served at runtime
│   └── astria_assets/          # ASTRIA-specific assets
├── server/                     # Server-rendered pages
├── src/                        # Application source code
│   ├── actions/                # Redux action creators
│   ├── components/             # React components
│   │   ├── activeProduct/      # Active product viewer
│   │   ├── common/             # Shared components
│   │   └── productSearch/      # Search interface
│   ├── constants/              # Constants and config
│   │   ├── api.js              # API endpoints
│   │   └── config.json         # Generated config (build artifact)
│   ├── containers/             # Redux-connected containers
│   ├── externals/              # External libraries (custom OpenSeadragon)
│   ├── reducers/               # Redux reducers
│   ├── utils/                  # Utility functions
│   ├── main.jsx                # Application entry point
│   └── urlParamMiddleware.js   # Redux middleware for URL params
├── package.json                # npm dependencies and scripts
├── server.js                   # Express backend server
└── vite.config.js              # Vite build tool configuration
```

## Code Editor

The recommended editor is [VS Code](https://code.visualstudio.com/) with these extensions:

1. [Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
2. [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
3. [EditorConfig for VS Code](https://marketplace.visualstudio.com/items?itemName=EditorConfig.EditorConfig)
4. [Path Intellisense](https://marketplace.visualstudio.com/items?itemName=christian-kohler.path-intellisense)

## Common Development Tasks

### Adding a New Redux Action

1. Create action type in appropriate file in `src/actions/`
2. Add action creator function
3. Import and use in components via `useDispatch()` or `mapDispatchToProps`
4. Handle action in reducer (`src/reducers/`)

### Creating a New React Component

1. Create component file in `src/components/[category]/`
2. Use functional components with hooks (preferred)
3. Import necessary Redux state via `useSelector()` or `mapStateToProps`
4. Add CSS module if needed: `ComponentName.module.css`

### Modifying the Config Schema

1. Update `configs/config.common.json` for common changes
2. Update mission-specific configs for mission changes
3. Update TypeScript types if applicable
4. Document new config options

### Working with OpenSeadragon

Custom OpenSeadragon builds are in `src/externals/`. Modifications should be rare:

1. Make changes to external OpenSeadragon fork if needed
2. Build and copy to `src/externals/`
3. Test thoroughly with large images
4. Document customizations

## Getting Help

- **Issues**: Report bugs at [GitHub Issues](https://github.jpl.nasa.gov/MIPL/astria/issues)
- **Questions**: Ask in [Discussions](https://github.jpl.nasa.gov/MIPL/astria/discussions)
- **Slack**: Join [#mipl](https://jpl.slack.com/archives/C05U1RMD0AJ) for real-time help
- **Documentation**: Check [Wiki](https://github.jpl.nasa.gov/MIPL/astria/wiki) for additional guides
