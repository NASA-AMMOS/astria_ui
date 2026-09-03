#! /bin/bash

ENV_PATH="configs/default.env"

# extract options
while test $# -gt 0; do
    case "$1" in
        -h|--help)
            echo "Stop services (if applicable) and remove symlinks."
            echo " "
            echo "stop.sh [options]"
            echo " "
            echo "options:"
            echo "-h, --help                 show brief help"
            echo "-e, --env=PATH_TO_ENV      path to file with env vars (default: ./configs/default.env)"
            echo " "
            echo "Production mode is controlled by ASTRIA_PRODUCTION=true in the env file."
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
    export ASTRIA_ENV_DIR

    set -a
    source $ENV_PATH
    set +a
fi

if [[ $ASTRIA_PRODUCTION = true ]]; then
  # Production mode: stop production containers
  addtl_file=""
  if [ -f "$ASTRIA_EXTRA_DOCKER_COMPOSE" ]; then
    addtl_file="-f ${ASTRIA_EXTRA_DOCKER_COMPOSE}"
  fi

  echo "Stopping production containers..."
  docker compose -f docker/docker-compose.yml ${addtl_file} down
elif [[ $ASTRIA_RUN_DOCKER_CONTAINERS = true ]]; then
  # Development mode: stop dev containers
  addtl_file=""
  if [ -f "$ASTRIA_EXTRA_DOCKER_COMPOSE" ]; then
    addtl_file="-f ${ASTRIA_EXTRA_DOCKER_COMPOSE}"
  fi

  # stop the services
  docker compose -f docker/docker-compose.dev.yml ${addtl_file} down
fi

# remove existing symlinks
echo "Removing symlinks"
for file in public/*; do
  if [ -L "$file" ]; then
    rm $file
  fi
done
