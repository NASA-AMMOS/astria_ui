# Configuration Guide

This guide explains Astria's configuration system in detail, including how to create mission-specific configurations, environment variables, and the config merging process.

## Overview

Astria uses a flexible multi-file configuration system that allows:

- **Base configuration** shared across all deployments
- **Mission-specific overrides** for different planetary missions
- **Venue-specific settings** for dev/test/prod environments
- **Secure configuration management** via external repositories

## Configuration Architecture

```
┌─────────────────────────────────────────────┐
│  Application (reads config at runtime)      │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│  src/constants/config.json                  │
│  (Generated at build time)                  │
└────────────────┬────────────────────────────┘
                 │
                 ▼ Merges (left to right)
┌────────────────────────────────────────────────────┐
│ 1. configs/config.common.json (implicit base)      │
│ 2. Mission config 1 (from ASTRIA_CONFIG_BUILD_...) │
│ 3. Mission config 2 (from ASTRIA_CONFIG_BUILD_...) │
│ ...                                                │
└────────────────────────────────────────────────────┘
```

## Directory Structure

```
configs/
├── config.common.json          # Base config (in repo)
├── config.js                   # Config loader/merger
├── default.env                 # Default environment variables
└── missions/                   # Symlinked mission configs (gitignored)
    ├── m2020/                  # Mars 2020 configs (external repo)
    │   ├── dev.env
    │   ├── prod.env
    │   ├── config.base.json
    │   └── config.ops.json
    └── msl/                    # MSL configs (external repo)
        ├── dev.env
        └── config.base.json
```

## Configuration Files

### config.common.json

Located at `configs/config.common.json`, this file contains settings common to all Astria instances:

- API endpoint patterns
- Default UI settings
- Feature flags available to all missions
- Common metadata fields

**Important**: This file is **always** included as the base configuration automatically. You don't need to list it in `ASTRIA_CONFIG_BUILD_SRC_PATHS`.

**Example structure**:
```json
{
  "api": {
    "tileServiceUrl": "/api/tiles",
    "samplerServiceUrl": "/api/sampler"
  },
  "ui": {
    "defaultMapCenter": [0, 0],
    "defaultZoom": 2,
    "maxImageSize": 50000
  },
  "features": {
    "enableAnnotations": true,
    "enableExport": true
  }
}
```

### Mission Configuration Files

Mission configs are stored in **external repositories** for security and mission-specific needs. They override or extend settings from `config.common.json`.

**Typical mission config structure**:
```json
{
  "mission": {
    "name": "Mars 2020",
    "abbreviation": "M2020",
    "landingSite": "Jezero Crater"
  },
  "api": {
    "tileServiceUrl": "https://m2020-tiles.astria.gov"
  },
  "instruments": [
    {
      "name": "Mastcam-Z",
      "abbreviation": "MCZ"
    }
  ],
  "ui": {
    "missionLogo": "/assets/m2020-logo.png"
  }
}
```

## Environment Variables

Environment variables control the build process and runtime behavior. They are typically defined in `.env` files.

### Core Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `ASTRIA_CONFIG_BUILD_SRC_PATHS` | Comma-separated list of config files to merge | None | `${ASTRIA_ENV_DIR}/config.base.json,${ASTRIA_ENV_DIR}/config.ops.json` |
| `ASTRIA_ENV_DIR` | Directory containing the .env file (auto-set) | N/A | `/path/to/configs/missions/sample_mission` |
| `ASTRIA_APP_VERSION` | Version string shown in UI | `package.json` version | `v2.1.0-beta` |
| `ASTRIA_CONFIG_BUILD_OUTPUT_PATH` | Output location for merged config | `src/constants/config.json` | Custom path |

### Server Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `ASTRIA_UI_PORT` | Frontend port (dev and Docker build arg) | `3000` | `8080` |
| `ASTRIA_API_PORT` | Backend API port (dev and Docker build arg) | `3001` | `8081` |
| `ASTRIA_RUN_DOCKER_CONTAINERS` | Start Docker services on startup | `false` | `true` |
| `ASTRIA_EXTRA_DOCKER_COMPOSE` | Additional docker-compose file | None | `${ASTRIA_ENV_DIR}/docker-compose.backend.yml` |
| `ASTRIA_DEV_HTTPS` | Enable HTTPS in dev mode | `true` | `false` |

### Docker Deployment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `ASTRIA_PRODUCTION` | Enable production deployment mode | `false` | `true` |
| `ASTRIA_FRONTEND_DOCKER_IMAGE_NAME` | Frontend Docker image name and tag | `astria_ui` | `astria_ui:v8.7.0` |
| `ASTRIA_API_DOCKER_IMAGE_NAME` | Backend API Docker image name and tag | `astria_api` | `astria_api:v8.7.0` |
| `ASTRIA_UI_PORT` | **Build arg**: Frontend port baked into image | `3000` | `8080` |
| `ASTRIA_PUBLIC_URL_PATH` | **Build arg**: Base URL path baked into image | `/` | `/astria/` |

**Note**: Build arguments (`ASTRIA_UI_PORT`, `ASTRIA_API_PORT`, `ASTRIA_PUBLIC_URL_PATH`) are passed during `docker build` and become part of the image. They cannot be changed at runtime, making images portable and self-contained.

### Authentication Variables

| Variable | Description | Required For |
|----------|-------------|--------------|
| `APP_ACCOUNT_USER` | Application service account username | Mosaic gathering |
| `APP_ACCOUNT_PASS` | Application service account password | Mosaic gathering |
| `CSSO_ENDPOINT_URL` | CSSO authentication endpoint | JPL deployments |

## Setting Up Mission Configurations

### Step 1: Obtain Mission Config Repository

Contact your mission lead to get access to the mission configuration repository.

```bash
# Clone mission config repo (example)
[INSERT SAMPLE ONCE REPO IS AVAILABLE]
```

### Step 2: Symlink Config into Astria

```bash
# From Astria root directory
mkdir -p configs/missions
ln -s ~/mission-configs/sample_mission configs/missions/sample_mission
```

### Step 3: Verify Symlink

```bash
ls -la configs/missions/
# Should show: sample_mission -> /path/to/mission-configs/sample_mission

ls configs/missions/sample_mission/
# Should show mission config files
```

### Step 4: Use Mission Config

```bash
# Start with mission dev config
./.dev/start.sh -e ./configs/missions/sample_mission/dev.env

# Or build config only
./.dev/start.sh --config-only -e ./configs/missions/sample_mission/dev.env
```

## Creating a New Mission Configuration

### For Mission Config Repository Maintainers

If you need to create a new mission configuration repository:

**1. Create repository structure:**

```
sample-astria-config/
├── README.md
├── .gitignore
├── dev.env                 # Development environment
├── test.env                # Test environment
├── prod.env                # Production environment
├── config.base.json        # Base mission settings
├── config.ops.json         # Operations venue overrides
└── assets/                 # Mission-specific assets
    ├── logo.png
    └── custom-icons/
```

**2. Create base config (`config.base.json`):**

```json
{
  "mission": {
    "name": "Mars 2020",
    "abbreviation": "M2020",
    "landingSite": "Jezero Crater",
    "landingDate": "2021-02-18"
  },
  "api": {
    "tileServiceUrl": "https://sample_url",
    "samplerServiceUrl": "https://sample_url",
    "dataLakeUrl": "https://sample_url"
  },
  "instruments": [
    {
      "name": "Mastcam-Z Left",
      "abbreviation": "ZCAM_L",
      "type": "IMAGING"
    },
    {
      "name": "Mastcam-Z Right",
      "abbreviation": "ZCAM_R",
      "type": "IMAGING"
    }
  ],
  "ui": {
    "missionLogo": "/missions/m2020/assets/logo.png"
  },
  "features": {
    "enableMosaicTimeline": true,
    "enableTargetOverlay": true,
    "enableCustomUpload": false
  }
}
```

**3. Create environment files:**

**Development (`dev.env`):**
```bash
# Mission and version
ASTRIA_APP_VERSION=v2.1.0-m2020-dev

# Config files to merge (relative to this file's directory)
ASTRIA_CONFIG_BUILD_SRC_PATHS="${ASTRIA_ENV_DIR}/config.base.json"

# Development server settings
ASTRIA_UI_PORT=3000
ASTRIA_API_PORT=3001

# Enable backend services
ASTRIA_RUN_DOCKER_CONTAINERS=false

# Public URL (if behind proxy)
ASTRIA_PUBLIC_URL_PATH="/"
```

**Production (`prod.env`):**
```bash
# Enable production deployment mode
ASTRIA_PRODUCTION=true

# Mission and version
ASTRIA_APP_VERSION=v2.1.0-m2020

# Config files to merge (relative to this file's directory)
ASTRIA_CONFIG_BUILD_SRC_PATHS="${ASTRIA_ENV_DIR}/config.base.json,${ASTRIA_ENV_DIR}/config.ops.json"

# Docker image names for deployment
ASTRIA_FRONTEND_DOCKER_IMAGE_NAME="astria_m2020_ui:v2.1.0"
ASTRIA_API_DOCKER_IMAGE_NAME="astria_m2020_api:v2.1.0"

# Build arguments (baked into Docker images)
ASTRIA_UI_PORT=3000
ASTRIA_API_PORT=3001
ASTRIA_PUBLIC_URL_PATH="/astria/"

# Backend services (typically managed by orchestration)
ASTRIA_RUN_DOCKER_CONTAINERS=false
```

**4. Document mission-specific setup:**

Create a README.md in the config repo explaining:
- How to use the configs
- What each config file does
- Mission-specific requirements
- Contact information

## Config Merging Rules

When multiple config files are specified, they are merged using these rules:

### 1. Deep Merge

Objects are merged recursively:

```javascript
// config.common.json
{
  "api": {
    "tileServiceUrl": "/api/tiles",
    "timeout": 30000
  }
}

// mission config
{
  "api": {
    "tileServiceUrl": "https://custom.jpl.nasa.gov"
  }
}

// Result
{
  "api": {
    "tileServiceUrl": "https://custom.jpl.nasa.gov",  // Overridden
    "timeout": 30000                                   // Preserved
  }
}
```

### 2. Array Merging by Index

Arrays are merged by index position using `lodash.merge`:

```javascript
// config.common.json
{
  "instruments": ["INS1", "INS2", "INS3"]
}

// mission config
{
  "instruments": ["MCZ", "ZCAM"]
}

// Result (merged by index)
{
  "instruments": ["MCZ", "ZCAM", "INS3"]  // indices 0,1 overwritten, 2 preserved
}
```

**Note**: If you need to completely replace an array, you must provide all elements in the mission config. Shorter arrays will leave trailing elements from the base config.

### 3. Left-to-right Priority

Later configs override earlier ones:

```bash
ASTRIA_CONFIG_BUILD_SRC_PATHS="config1.json,config2.json,config3.json"
# Order of precedence: config.common.json < config1.json < config2.json < config3.json
```

## Debugging Configuration

### View Generated Config

The final merged configuration is at `src/constants/config.json`:

```bash
# Build config
./.dev/start.sh --config-only -e ./configs/missions/sample_mission/dev.env

# View result
cat src/constants/config.json | jq '.'
```

## Security Best Practices

### Never Commit Sensitive Data

Mission configs often contain sensitive information. **Never commit to the main Astria repo:**

- API credentials
- Service endpoints (production URLs)
- Internal network information
- Encryption keys

### Use External Repositories

Store sensitive configs in separate, access-controlled repositories:

```bash
# Good: External repo with restricted access
configs/missions/sample_mission/ -> ~/mission-configs/sample_mission (gitignored)

# Bad: Committed directly to Astria repo
configs/sample_mission/config.json (committed)
```

### Environment Variables for Secrets

Use environment variables for secrets, not config files:

```bash
# In .env file
APP_ACCOUNT_PASS=secret_password
CSSO_ENDPOINT_URL=https://internal-csso.jpl.nasa.gov

# Reference in code, not in config JSON
process.env.APP_ACCOUNT_PASS
```

### Gitignore Patterns

The following are gitignored by default:

```gitignore
configs/missions/          # All mission configs
configs/**/.env           # Environment files
src/constants/config.json # Generated config
.cert/                    # SSL certificates
```

## Advanced Configuration

### Custom Config Output Location

Override where the merged config is written:

```bash
export ASTRIA_CONFIG_BUILD_OUTPUT_PATH="/custom/path/config.json"
npm run build:config
```

### Programmatic Config Access

In application code, import the config:

```javascript
import config from 'config.js';

// Access config values
const tileServiceUrl = config.api.tileServiceUrl;
const missionName = config.mission.name;
```

### Config Validation

Add validation to ensure required fields exist:

```javascript
// In config.js or at app startup
function validateConfig(config) {
  const required = ['api.tileServiceUrl', 'mission.name'];
  
  for (const field of required) {
    const value = field.split('.').reduce((obj, key) => obj?.[key], config);
    if (!value) {
      throw new Error(`Required config field missing: ${field}`);
    }
  }
}
```

## Examples

### Example: Multi-Venue Mission Config

```bash
# configs/missions/sample_misison/dev.env
ASTRIA_CONFIG_BUILD_SRC_PATHS="${ASTRIA_ENV_DIR}/config.base.json,${ASTRIA_ENV_DIR}/config.dev.json"

# configs/missions/sample_misison/test.env
ASTRIA_CONFIG_BUILD_SRC_PATHS="${ASTRIA_ENV_DIR}/config.base.json,${ASTRIA_ENV_DIR}/config.test.json"

# configs/missions/sample_misison/prod.env
ASTRIA_CONFIG_BUILD_SRC_PATHS="${ASTRIA_ENV_DIR}/config.base.json,${ASTRIA_ENV_DIR}/config.prod.json"
```

### Example: Multi-Mission Support

```bash
# Start sample_misison instance
./.dev/start.sh -e ./configs/missions/sample_misison/dev.env

# Start MSL instance  
./.dev/start.sh -e ./configs/missions/msl/dev.env
```

## Further Reading

- [Developer Guide](DEVELOPER.md) - Setup, development workflow, and production deployment
- [Contributing Guide](CONTRIBUTING.md) - Contribute to ASTRIA
