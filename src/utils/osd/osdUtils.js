import { DziTileSource } from 'openseadragon';
import shortid from 'shortid';
import { getConfig } from 'src/utils/configRegistry';
import { getPropFromProduct } from 'src/utils/sharedUtils';
import urlJoin from 'url-join';

export function buildTiledImageURL(
  product,
  thumb = false,
  isDNStretch = false,
  stretchLow = null,
  stretchHigh = null,
  operatorControls = null
) {
  const config = getConfig();
  const url = product._pdsURL ?? getPropFromProduct(product, config.es_mappings.img_url);
  if (url) {
    const imageType = getPropFromProduct(product, config.es_mappings.image_type);
    return urlJoin(
      config.tile_service_url,
      `?image=${url}&format=png${
        thumb ? `&thumb=true&proxy=${config.tile_service_proxy_thumb}` : `&proxy=${config.tile_service_proxy}`
      }${imageType ? `&rdr=${imageType}` : ''}${isDNStretch ? `&extremaStretch=true` : ''}${
        stretchLow !== null ? `&stretchLow=${stretchLow}` : ''
      }${stretchHigh !== null ? `&stretchHigh=${stretchHigh}` : ''}${operatorControls ? `&${operatorControls}` : ''}`
    );
  }
  return false;
}

export function buildImageHistogramURL(product, thumb = false) {
  const config = getConfig();
  const url = product._pdsURL ?? getPropFromProduct(product, config.es_mappings.img_url);
  const typeKey = getPropFromProduct(product, config.es_mappings.image_type, null);
  return urlJoin(
    config.tile_service_url,
    `?image=${url}&format=png${thumb ? '&thumb=true' : ''}${typeKey ? `&rdr=${typeKey}` : ''}&metadata=true&proxy=${
      config.tile_service_proxy
    }`
  );
}

export function buildTileSourceForOverlay(options) {
  const config = getConfig();
  const {
    layer,
    index,
    isDNStretch = false,
    stretchLow,
    stretchHigh,
    operatorControls,
    bounds,
    onSuccess,
    onError,
  } = options;
  const url = buildTiledImageURL(layer, false, isDNStretch, stretchLow, stretchHigh, operatorControls);
  const sourceOptions = { type: 'dzi', tileSource: url, crossOriginPolicy: 'Anonymous' };
  if (bounds) {
    sourceOptions.bounds = bounds;
  }
  const tileSource = new DziTileSource({
    ...sourceOptions,
    success: (ts) => {
      if (ts.item) {
        ts.item._astriaOrigOptions = { ...sourceOptions };
        ts.item._astriaId = layer._astriaId || getPropFromProduct(layer, config.es_mappings.id);
        ts.item.filename = getPropFromProduct(layer, config.es_mappings.filename);
        ts.item.overlayId = getPropFromProduct(layer, config.es_mappings.overlay_id);
        if (typeof onSuccess === 'function') {
          onSuccess(ts.item);
        }
      }
    },
    error: () => {
      if (typeof onError === 'function') {
        onError(layer);
      }
    },
  });

  tileSource.opacity = typeof layer.opacity === 'number' ? layer.opacity : 1;
  tileSource.index = index;
  tileSource._astriaId = layer._astriaId || getPropFromProduct(layer, config.es_mappings.id);
  tileSource.filename = getPropFromProduct(layer, config.es_mappings.filename);
  tileSource.overlayId = getPropFromProduct(layer, config.es_mappings.overlay_id);

  return tileSource;
}

export function buildSimpleImageSourceForOverlay(overlay, index) {
  const config = getConfig();
  const { opacity, url } = overlay;

  return {
    index,
    url,
    opacity: typeof opacity === 'number' ? opacity : 1,
    crossOriginPolicy: 'Anonymous',
    success: (ts) => {
      if (ts.item) {
        ts.item._astriaId = getPropFromProduct(overlay, config.es_mappings.id);
        ts.item._isBaseImage = index === 0;
      }
    },
  };
}

export function generateAnnotationId(username, overlayId, suffix = '') {
  return `${[username, overlayId, suffix, shortid.generate()].join('-')}`;
}

export function getShortTargetID(targetID) {
  return targetID.slice(0, 8);
}

export function getTilesFromTilesMatrix(tilesMatrix) {
  if (Object.prototype.hasOwnProperty.call(tilesMatrix, 'level')) return tilesMatrix;
  return Object.keys(tilesMatrix)
    .map((obj) => getTilesFromTilesMatrix(tilesMatrix[obj]))
    .flat();
}
