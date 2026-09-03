#! /bin/bash

ENV_PATH="configs/default.env"

# extract options
while test $# -gt 0; do
    case "$1" in
        -h|--help)
            echo "Build app bundle."
            echo " "
            echo "build.sh [options]"
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

    npm run build:config

    cp -r ${ASTRIA_ENV_DIR}/public/* ./public/

    npm run build -- --base=${ASTRIA_PUBLIC_URL_PATH}
else
    echo "ERROR: ENV file not found"
    exit 1
fi
