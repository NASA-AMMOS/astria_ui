<span style="display:block;text-align:left;">![Example](/docs/images/astria.png)</span>

# Astria

Astria is a powerful web-based application for planetary image browsing and analysis, developed by NASA's Jet Propulsion Laboratory (JPL) Multimission Instrument Processing Lab (MIPL). Originally designed for Mars mission imagery (Mars 2020, MSL, etc.), Astria provides scientists and mission teams with tools to efficiently search, visualize, annotate, and analyze large-scale planetary image datasets.

## Who is Astria for?

- **Planetary Scientists** - Analyze Mars surface imagery and make scientific annotations
- **Mission Operations Teams** - Review tactical and strategic imaging products
- **Data Analysts** - Search and export image datasets for further processing
- **Researchers** - Access and study multi-mission planetary image archives

## Key Features

- Efficient viewing of very large images
- DN value access
- Fast facet based search
- Image metadata display
- Image markup
- Scientific feature annotation
- Custom image upload
- Image export
- Image scale and measurement
- RDR overlay
- Tactical target overlay
- Image stretch
- URL permalinking
- Orbital footprint visualization on context map

## Architecture

Astria is built as a modern, scalable web application:

- **Frontend**: React 18 + Redux for state management, built with Vite
- **Backend**: Node.js Express server with Docker-native deployment
- **Image Serving**: [Astria Image Tile Service](https://github.jpl.nasa.gov/MIPL/tile_service) provides efficient tiling of large images
- **DN Sampling**: [Astria Image Sampler Service](https://github.jpl.nasa.gov/MIPL/mis_rest_service) provides pixel value access
- **Authentication**: CSSO (JPL's Central Single Sign-On) integration for secure access
- **Visualization**: OpenSeadragon for high-performance image viewing, Leaflet for map context

## Getting Started

**→ [Developer Guide](docs/DEVELOPER.md)** - Complete setup and development instructions.

**Prerequisites:** Node.js 20+, Docker, and mkcert.

**Quick start:**
```bash
git clone https://github.jpl.nasa.gov/MIPL/astria.git
cd astria
npm install
./.dev/start.sh
```

Then open `https://localhost:3000`. See the [Developer Guide](docs/DEVELOPER.md) for detailed setup, mission configuration, and troubleshooting.

## Production Deployment

Deploy Astria in production using Docker containers. Set `ASTRIA_PRODUCTION=true` in your production env file:

```bash
./.dev/start.sh -e ./configs/missions/m2020/prod.env
```

This builds and deploys both frontend and backend containers using `docker-compose.yml`. The same command works for dev and production - the env file determines the mode. See the [Developer Guide - Production Deployment](docs/DEVELOPER.md#production-deployment) for complete instructions.

## Configuration

Astria uses a flexible configuration system that merges multiple JSON files at build time. See the [Developer Guide](docs/DEVELOPER.md#mission-configuration-setup) for details on how to set up mission-specific configurations.

Key files:
- `configs/config.common.json` - Base configuration
- `configs/missions/` - Mission-specific configs (symlinked, gitignored)
- `.env` files - Specify which configs to merge


## Documentation

- **[Developer Guide](docs/DEVELOPER.md)** - Setup, workflow, production deployment, and technical details
- **[Configuration Guide](docs/CONFIGURATION.md)** - Configuration system reference
- **[Contributing Guide](docs/CONTRIBUTING.md)** - How to contribute

## Contributing

We welcome contributions from the community! To get started:

1. Read our [Code of Conduct](CODE_OF_CONDUCT.md)
2. Review the [Contributing Guide](docs/CONTRIBUTING.md)
3. Check out [good first issues](https://github.jpl.nasa.gov/MIPL/astria/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
4. Join the conversation on [Slack (#mipl)](https://jpl.slack.com/archives/C05U1RMD0AJ)

### Development Contributions

- Report bugs via [GitHub Issues](https://github.jpl.nasa.gov/MIPL/astria/issues)
- Propose features via [GitHub Discussions](https://github.jpl.nasa.gov/MIPL/astria/discussions)
- Submit pull requests following our [PR guidelines](docs/CONTRIBUTING.md#submitting-a-pull-request)
- Improve documentation

All contributors must sign off on commits per the [Developer Certificate of Origin](https://developercertificate.org/).

## Related Projects

- **[Astria Tile Service](https://github.jpl.nasa.gov/MIPL/tile_service)** - High-performance image tiling service
- **[Astria Sampler Service](https://github.jpl.nasa.gov/MIPL/mis_rest_service)** - Image DN value sampling service

## License

Copyright © 2024 California Institute of Technology ("Caltech"). U.S. Government sponsorship acknowledged.

See [LICENSE](LICENSE) file for full license details.

## Contact & Support

- **Project Lead**: Contact via [GitHub Issues](https://github.jpl.nasa.gov/MIPL/astria/issues)
- **JPL MIPL Team**: [#mipl Slack channel](https://jpl.slack.com/archives/C05U1RMD0AJ)
- **Bug Reports**: [GitHub Issues](https://github.jpl.nasa.gov/MIPL/astria/issues)

---

**Developed by NASA's Jet Propulsion Laboratory, California Institute of Technology**
