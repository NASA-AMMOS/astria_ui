#! /bin/bash

ENV_PATH="configs/default.env"

# extract options
while test $# -gt 0; do
    case "$1" in
        -h|--help)
            echo "Build deployable docker image."
            echo " "
            echo "build-image.sh [options]"
            echo " "
            echo "options:"
            echo "-h, --help                 show brief help"
            echo "-e, --env=PATH_TO_ENV      path to file with env vars (default: ./configs/default.env)"
            exit 0
            ;;
        -e)
            shift
            if test $# -gt 0; then
                ENV_PATH=$1
            else
                echo "no env file specified"
                exit 1
            fi
            shift
            ;;
        --env*)
            ENV_PATH=`echo $1 | sed -e 's/^[^=]*=//g'`
            shift
            ;;
        *)
            echo "ERROR: malformed input. see -h for usage"
            exit 1
            ;;
    esac
done

# set env vars
if [ -f "$ENV_PATH" ]; then
    # extract base path
    ASTRIA_ENV_DIR="$(dirname $(realpath $ENV_PATH))"
    ASTRIA_ENV_FILE="$(basename $ENV_PATH)"
    export ASTRIA_ENV_DIR
    export ASTRIA_ENV_FILE

    set -a
    source $ENV_PATH
    set +a
else
    echo "ERROR: ENV file not found"
    exit 1
fi

# Capture git SHA for build
export ASTRIA_BUILD_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo "Building with git SHA: ${ASTRIA_BUILD_HASH}"

# Determine compose files to use
addtl_file=""
if [ -f "$ASTRIA_EXTRA_DOCKER_COMPOSE" ]; then
  addtl_file="-f ${ASTRIA_EXTRA_DOCKER_COMPOSE}"
fi

# Build all services defined in docker-compose.yml
echo "Building Docker images..."
docker compose -f docker/docker-compose.yml ${addtl_file} build
