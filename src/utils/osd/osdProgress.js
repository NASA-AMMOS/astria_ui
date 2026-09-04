import { getConfig } from 'src/utils/configRegistry';
import { getPropFromProduct } from 'src/utils/sharedUtils';
// NOTE: requires OSDProgressMixin(OSDViewer)

export const OSDProgressMixin = (base) =>
  class extends base {
    constructor(options) {
      super(options);
      const config = getConfig();

      // trackers for both individual tiles and images as a whole
      this._tileProgressTracker = {};
      this._tiledImageProgressTracker = {};
      this._tiledImageLoadedTracker = {};

      // layer loaded callback
      const onLayerLoad = (evt) => {
        const osdLayer = evt.eventSource;

        // toggle state
        this._tiledImageLoadedTracker[osdLayer._astriaId] = !this._tiledImageLoadedTracker[osdLayer._astriaId];

        this.checkStatus();
      };

      // listen for a layer to be added to the viewer
      this.on('layeradded', (osdLayer) => {
        // set state tracker
        // False indicates this layer has not finished loading
        this._tiledImageLoadedTracker[osdLayer._astriaId] = false;

        // check for fully loaded state change
        osdLayer.removeHandler('fully-loaded-change', onLayerLoad);
        osdLayer.addHandler('fully-loaded-change', onLayerLoad);

        this.checkStatus();
      });

      // listen for the initial request for a layer
      this.on('layerrequested', (appLayer) => {
        const layerId = appLayer._astriaId || getPropFromProduct(appLayer, config.es_mappings.id);

        // set state tracker
        // False indicates this layer has not finished loading
        this._tiledImageLoadedTracker[layerId] = false;

        this.checkStatus();
      });

      // listen for layer to be removed from the viewer
      this.on('layerremoved', (layerId) => {
        this._tiledImageLoadedTracker[layerId] = null;
        delete this._tiledImageLoadedTracker[layerId];
        this.checkStatus();
      });

      // listen for remove of all layers
      this.on('alllayersremoved', (_layerId) => {
        this._tiledImageLoadedTracker = {};
        this.checkStatus();
      });

      this.on('layererror', (appLayer) => {
        const layerId = appLayer._astriaId || getPropFromProduct(appLayer, config.es_mappings.id);
        this._tiledImageLoadedTracker[layerId] = null;
        delete this._tiledImageLoadedTracker[layerId];
        this.checkStatus();
      });
    }

    checkStatus() {
      // sum our progress thus far and notify watchers
      let layerTotalLoaded = 0;
      let layerTotalNeeded = 0;
      const keys = Object.keys(this._tiledImageLoadedTracker);
      layerTotalNeeded = keys.length;
      keys.forEach((key) => {
        layerTotalLoaded += this._tiledImageLoadedTracker[key] ? 1 : 0;
      });

      // signal whether we are loading or not
      this.dispatch('viewerloadstatechange', {
        loading: layerTotalLoaded !== layerTotalNeeded,
        layers: { ...this._tiledImageLoadedTracker },
      });
    }
  };
