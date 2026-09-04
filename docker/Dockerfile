FROM node:20.18.0 AS build

# the spefific env file that should be used for this build
# specifies things like authentication server URL and frontend config files
ARG ENV_FILE=""
ARG ASTRIA_BUILD_HASH="unknown"
ARG ASTRIA_MISSION_CONFIG_NAME="config"

# optional tweaks for the FS within the image
ARG _WORKSPACE="/app"
ARG _ENV_WORKSPACE="/app_env"

ENV ASTRIA_ENV_DIR=${_ENV_WORKSPACE}

# make sure we're up to date
RUN apt-get -y update

# copy in the mission specific files
RUN mkdir -p ${_ENV_WORKSPACE}
COPY --from=env_dir . ${_ENV_WORKSPACE}

# copy in the app source
RUN mkdir -p ${_WORKSPACE}
WORKDIR ${_WORKSPACE}
COPY . ${_WORKSPACE}

# install dependencies
RUN npm install -g serve && \
  npm install && \
  npm cache clean --force

# build ASTRIA config
RUN export ASTRIA_ENV_DIR=${_ENV_WORKSPACE} && \
  export ASTRIA_MISSION_CONFIG_NAME=${ASTRIA_MISSION_CONFIG_NAME} && \
  set -a && . ${_ENV_WORKSPACE}/${ENV_FILE} && set +a && \
  npm run build:config

# copy over the mission specific static assets
RUN cp -r ${_ENV_WORKSPACE}/public/* ${_WORKSPACE}/public/

# build source bundle
RUN export ASTRIA_ENV_DIR=${_ENV_WORKSPACE} && \
  export ASTRIA_BUILD_HASH=${ASTRIA_BUILD_HASH} && \
  set -a && . ${_ENV_WORKSPACE}/${ENV_FILE} && set +a && \
  ASTRIA_BASE="${ASTRIA_PUBLIC_URL_PATH:-/}" && \
  ASTRIA_BASE="${ASTRIA_BASE%/}/" && \
  npm run build -- --base=${ASTRIA_BASE}

FROM nginx:1.30 AS serve

# Build-time arguments for port and path (baked into image)
ARG ASTRIA_UI_PORT=3000
ARG ASTRIA_PUBLIC_URL_PATH=/

# Set as environment variables in the image
ENV ASTRIA_UI_PORT=${ASTRIA_UI_PORT}
ENV ASTRIA_PUBLIC_URL_PATH=${ASTRIA_PUBLIC_URL_PATH}

# put the built package in the serve directory
COPY --from=build /app/dist /usr/share/nginx/html

# Generate nginx config from template with build-time port
COPY docker/nginx.astria.conf.template /tmp/nginx.astria.conf.template
RUN envsubst '${ASTRIA_UI_PORT}' < /tmp/nginx.astria.conf.template > /etc/nginx/conf.d/default.conf && \
    rm /tmp/nginx.astria.conf.template

EXPOSE ${ASTRIA_UI_PORT}

CMD ["nginx", "-g", "daemon off;"]
