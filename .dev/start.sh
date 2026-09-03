#! /bin/bash

ENV_PATH="configs/default.env"
CONFIG_ONLY=false

# extract options
while test $# -gt 0; do
    case "$1" in
        -h|--help)
            echo "Build config and start services."
            echo " "
            echo "start.sh [options]"
            echo " "
            echo "options:"
            echo "-h, --help                 show brief help"
            echo "-c, --config-only          build the config but do not start the server"
            echo "-e, --env=PATH_TO_ENV      path to file with env vars (default: ./configs/default.env)"
            echo " "
            echo "Production mode is controlled by ASTRIA_PRODUCTION=true in the env file."
            exit 0
            ;;
        -c|--config-only)
            shift
            echo "building config"
            CONFIG_ONLY=true
            shift
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
else
    echo "ERROR: ENV file not found"
    exit 1
fi

if [ $CONFIG_ONLY = true ]; then
  npm run build:config
elif [[ $ASTRIA_PRODUCTION = true ]]; then
  # Production mode: build and run with Docker
  echo "Starting in production mode..."
  
  # stop before we start
  .dev/stop.sh -e $ENV_PATH

  # build config
  npm run build:config

  # create new symlinks
  echo "Creating symlinks"
  pub_dir=${ASTRIA_ENV_DIR}/public
  if [ -d "$pub_dir" ]; then
    for file in $pub_dir/*; do
      fname=$(basename $file)
      ln -s $file public/$fname
    done
  fi

  # Build Docker images
  ./.dev/build-image.sh -e $ENV_PATH

  # Determine compose files to use
  addtl_file=""
  if [ -f "$ASTRIA_EXTRA_DOCKER_COMPOSE" ]; then
    addtl_file="-f ${ASTRIA_EXTRA_DOCKER_COMPOSE}"
  fi

  # Start production containers
  echo "Starting Docker containers..."
  docker compose -f docker/docker-compose.yml ${addtl_file} up -d

  echo ""
  echo "Production services started!"
  echo "To view logs: docker compose -f docker/docker-compose.yml ${addtl_file} logs -f"
  echo "To stop: ./.dev/stop.sh -e $ENV_PATH"
else
  # Development mode
  # stop before we start
  .dev/stop.sh

  # build config
  npm run build:config

  # create new symlinks
  echo "Creating symlinks"
  pub_dir=${ASTRIA_ENV_DIR}/public
  if [ -d "$pub_dir" ]; then
    for file in $pub_dir/*; do
      fname=$(basename $file)
      ln -s $file public/$fname
    done
  fi

  if [[ $ASTRIA_RUN_DOCKER_CONTAINERS = true ]]; then

    addtl_file=""
    if [ -f "$ASTRIA_EXTRA_DOCKER_COMPOSE" ]; then
      addtl_file="-f ${ASTRIA_EXTRA_DOCKER_COMPOSE}"
    fi

    # start docker services
    docker compose -f docker/docker-compose.dev.yml ${addtl_file} pull
    docker compose -f docker/docker-compose.dev.yml ${addtl_file} up -d --force-recreate
  fi

  # start dev server
  npm run dev -- --host 127.0.0.1
fi

