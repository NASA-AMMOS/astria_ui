import debounce from 'lodash.debounce';
import throttle from 'lodash.throttle';
import OpenSeaDragon, { MouseTracker } from 'openseadragon';
import { TileInfoFetchManager } from 'src/utils';
import { getConfig } from 'src/utils/configRegistry';
import { pdsGetS3PathForImage } from 'src/utils/endpoints';
import { getPropFromProduct } from 'src/utils/sharedUtils';
import { EventDispatcher } from '../events';
import {
  buildSimpleImageSourceForOverlay,
  buildTileSourceForOverlay,
  buildTiledImageURL,
  getTilesFromTilesMatrix,
} from './osdUtils';
import OpenSeadragonViewerInputHook from './viewerinputhook';

export const INVALID_POINT = -1;

// Override default timeout settings since OSD appears to not respect the configured timeout on rare occasion.
OpenSeaDragon.DEFAULT_SETTINGS.timeout = 100000000;

const customLogger = (...args) => {
  try {
    // Remove various messages that tend to spew such as tile aborts which we can't easily override logging of otherwise
    if (args.length === 4 && args[3] === 'Image load aborted - XHR error') {
      return;
    }
    console.log(...args);
  } catch (err) {
    console.log(err, args);
  }
};

OpenSeaDragon.console = { ...window.console, log: customLogger };

// TODO might be able to pass in a reference to the current scope in this makeAjaxRequest
// in order to store these net requests on the OSD instance instead of globally here + kludgy
// checking of viewer ID.
const activeTileRequests = {};
const activeTileInfoRequests = {};
class CustomMakeAjaxRequest {
  constructor(url, onSuccess, onError) {
    this.aborted = false; // whether or not the manager has been aborted
    this.url = url; // url to fetch
    this.onSuccess = onSuccess;
    this.onError = onError;
    this.request = null;
    this.retryAttempts = 0;

    this.makeAjaxRequest();
  }
  abort() {
    // Cancel in-flight request if active
    if (this.request) this.request.abort();

    // Indicate that the manager has been aborted so that the request does not retry after sleep timer
    this.aborted = true;
  }
  getSleepMS(retries) {
    // Retry often for the first few attempts otherwise use increasingly higher sleep times
    if (retries < 3) return 5000;
    else if (retries < 10) return 10000;
    else return 30000;
  }
  makeAjaxRequest() {
    if (this.aborted) return;
    let withCredentials;
    let headers;
    let responseType;
    let url = this.url;
    let onSuccess = this.onSuccess;
    let onError = this.onError;

    // Note that our preferred API is that you pass in a single object; the named
    // arguments are for legacy support.
    if (OpenSeaDragon.isPlainObject(this.url)) {
      onSuccess = this.url.success;
      onError = this.url.error;
      withCredentials = this.url.withCredentials;
      headers = this.url.headers;
      responseType = this.url.responseType || null;
      url = this.url.url;
    }

    const protocol = OpenSeaDragon.getUrlProtocol(url);
    const request = OpenSeaDragon.createAjaxRequest(protocol === 'file:');
    this.request = request;
    activeTileRequests[url] = this;

    if (!OpenSeaDragon.isFunction(onSuccess)) {
      throw new Error('makeAjaxRequest requires a success callback');
    }

    request.onreadystatechange = () => {
      // 4 = DONE (https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest#Properties)
      if (request.readyState === 4) {
        request.onreadystatechange = function () {};

        // Retry HTTP 202 (Accepted) or 404
        if (request.status === 202 || request.status === 404) {
          this.retryAttempts += 1;
          const sleepMS = this.getSleepMS(this.retryAttempts);
          console.log(`Tile request: ${url} returned: ${request.status}, retrying in ${sleepMS / 1000}s`);
          setTimeout(() => {
            this.makeAjaxRequest();
          }, sleepMS);
        } else if (
          // With protocols other than http/https, a successful request status is in
          // the 200's on Firefox and 0 on other browsers
          (request.status >= 200 && request.status < 300) ||
          (request.status === 0 && protocol !== 'http:' && protocol !== 'https:')
        ) {
          try {
            // Stop tracking network request
            delete activeTileRequests[url];
            onSuccess(request);
          } catch (err) {
            console.log('Catching unprotected onSuccess from OSD...', err);
          }
        } else {
          // Case of some non successful request other than 404
          // Stop tracking network request
          delete activeTileRequests[url];

          // Oddly this returns 0 when encountering a 303, could be a quirk of XHTTP request
          // since this doesn't appear to be the case with fetch. OSD normally logs this case
          // but we'll silence it.
          // OpenSeaDragon.console.log('AJAX request returned %d: %s', request.status, url);

          if (OpenSeaDragon.isFunction(onError)) {
            try {
              onError(request);
            } catch (err) {
              console.log('Catching unprotected onError from OSD...', err);
            }
          }
        }
      }
    };

    try {
      request.open('GET', url, true);

      if (responseType) {
        request.responseType = responseType;
      }

      if (headers) {
        for (var headerName in headers) {
          if (Object.prototype.hasOwnProperty.call(headers, headerName) && headers[headerName]) {
            request.setRequestHeader(headerName, headers[headerName]);
          }
        }
      }

      if (withCredentials) {
        request.withCredentials = true;
      }

      request.send();
    } catch (e) {
      OpenSeaDragon.console.log('%s while making AJAX request: %s', e.name, e.message);

      request.onreadystatechange = function () {};

      // Stop tracking network request
      delete activeTileRequests[url];

      if (OpenSeaDragon.isFunction(onError)) {
        onError(request, e);
      }
    }
  }
}
OpenSeaDragon.makeAjaxRequest = (...args) => new CustomMakeAjaxRequest(...args);

export class OSDViewerManager extends EventDispatcher {
  constructor(options) {
    super(options);
    const config = getConfig();

    const { debugMode, transformImage, imageSmoothingEnabled, ...overrides } = options;
    this.activeTileInfoRequests = activeTileInfoRequests;
    this.activeTileRequests = activeTileRequests;
    this.baseImage = null;
    this.activeSearchProductGroups = null;
    this._viewMode = null;
    this.preferredImageForType = {};

    this.debouncedViewportChange = debounce(this.onViewportChange.bind(this), 250, {
      trailing: true,
    });

    this.firstImageLoadedListener = false;

    const openSeaDragonOptions = {
      id: 'osd-viewer',
      debugMode: debugMode ? debugMode.debugState : false,
      maxZoomPixelRatio: 50,
      // minZoomImageRatio:  0, // TODO set this when defautl 100% zoom to fix thumbnail zoom issue
      imageSmoothingEnabled: imageSmoothingEnabled,
      navigationControlAnchor: OpenSeaDragon.ControlAnchor.BOTTOM_LEFT,
      navigatorPosition: 'BOTTOM_RIGHT',
      navigatorSizeRatio: 0.1,
      prefixUrl: 'https://openseadragon.github.io/openseadragon/images/',
      showNavigator: true,
      flipped: false,
      controlsFadeDelay: 0,
      controlsFadeLength: 0,
      autoHideControls: true,
      timeout: 100000000,
      showRotationControl: true,

      // don't let OSD actually attach controls but still tell it to think
      // that controls exist so that we can use their onClick methods
      zoomInButton: 'hidden-zoom-in',
      zoomOutButton: 'hidden-zoom-out',
      homeButton: 'hidden-home',
      fullPageButton: 'hidden-full-page',
      rotateLeftButton: 'hidden-rotate-left',
      rotateRightButton: 'hidden-rotate-right',

      visibilityRatio: 1,
      // constrainDuringPan: true,
      gestureSettingsMouse: { clickToZoom: false }, // Turn off zooms on click
      ajaxWithCredentials: config.using_csso,
      loadTilesWithAjax: true, // Always use AJAX for tiles to enable retry logic

      // Set subpixel rounding strategies to fix issue with tile gaps in Chrome for Mac users with Apple Silicon
      // around 8/8/2022. Also resolves this same issue (longstanding) for Firefox users.
      // See https://jira.jpl.nasa.gov/browse/MSTRIAGE-7752
      subPixelRoundingForTransparency: { '*': OpenSeaDragon.SUBPIXEL_ROUNDING_OCCURRENCES.ALWAYS },

      // apply config overrides
      ...overrides,
    };

    this.osdViewer = OpenSeaDragon(openSeaDragonOptions);

    // hack because OSD does not expose a way to disable individual shortcuts directly
    const keyHandler = this.osdViewer.innerTracker.keyHandler;
    this.osdViewer.innerTracker.keyHandler = function (event) {
      switch (event.keyCode) {
        case 114: //r - clockwise rotation
          return false;
        case 82: //R - counterclockwise  rotation
          return false;
        case 102: //f
          return false;
        default:
          keyHandler(event);
      }
    };

    // Use tile-drawn trigger for the first image loaded trigger
    // because until tiles are drawn, resolving line/sample from coordinates
    // will result in inaccurate placements
    this.osdViewer.addHandler('tile-drawn', () => {
      if (!this.firstImageLoadedListener) {
        this.firstImageLoadedListener = true;

        this.dispatch('firstimageloaded');

        // edit: for some reason OSD in this context is overriding
        // this option at some point.. probably because of all this
        // reinitialization BS. Fix later.
        requestAnimationFrame(() => this.setImageSmoothingEnabled(imageSmoothingEnabled));
      }
    });

    this.osdViewer.addHandler('tile-drawing', (tileParams) => {
      const worldItemIndex = this.osdViewer.world._items.findIndex(
        (i) => i._astriaId === tileParams.tiledImage._astriaId
      );
      if (tileParams.tile.loaded !== 1 && worldItemIndex === 0) {
        const canvas = tileParams.rendered.canvas;
        const context = canvas.getContext('2d');
        const imgd = context.getImageData(0, 0, canvas.width, canvas.height);

        if (transformImage) transformImage(imgd.data);

        tileParams.rendered.putImageData(imgd, 0, 0);
        tileParams.tile.loaded = 1;
      }
    });
    this.transformImage = transformImage;

    // Prevent default context menu appearing on control click
    this.osdViewer.canvas.addEventListener('contextmenu', function (event) {
      event.preventDefault();
    });

    this.osdViewer.addHandler('zoom', () => {
      this.debouncedViewportChange();
    });

    this.osdViewer.addHandler('pan', () => {
      this.debouncedViewportChange();
    });

    this.osdViewer.addHandler('tile-load-failed', (result) => {
      if (
        config.using_csso &&
        result !== undefined &&
        result.tileRequest !== undefined &&
        result.tileRequest.status !== 'undefined' &&
        result.tileRequest.status === 401
      ) {
        window.location = '/ssologoutredirect';
        window.location.reload(true);
      }

      this.dispatch('tileloaderror', result);
    });

    this.osdViewer.addHandler('canvas-press', (event) => {
      // use alt/option key to pan
      if (!event.originalEvent.altKey) {
        this.handleClickEvent(event);
      }
    });

    const tracker = new MouseTracker({
      element: this.osdViewer.container,
      moveHandler: throttle((evt) => this.handleMouseMove(evt), 100, {
        leading: true,
        trailing: true,
      }),
    });
    tracker.setTracking(true);

    new OpenSeadragonViewerInputHook({
      viewer: this.osdViewer,
      hooks: [
        {
          tracker: 'viewer',
          handler: 'dblClickHandler',
          hookHandler: (event) => this.handleDoubleClickEvent(event),
        },
      ],
    });

    // listen for keyboard interaction
    document.addEventListener('keydown', (evt) => {
      this.handleKeydown(evt);
    });
  }

  setViewMode(viewMode) {
    this._viewMode = viewMode;
  }

  getLayerById(layerId) {
    return this.osdViewer.world._items.find((x) => x._astriaId === layerId);
  }

  getLayerIndexById(layerId) {
    return this.osdViewer.world._items.findIndex((x) => x._astriaId === layerId);
  }

  addLayer = async (options) => {
    const config = getConfig();
    const {
      layer: appLayer,
      index,
      opacity,
      replace,
      type,
      stretchMode,
      isDNStretch,
      stretchLow,
      stretchHigh,
      operatorControls,
      bounds, // bounding box: {top, left, bottom, right}
    } = options;

    const onLoad = (osdLayer) => {
      this.dispatch('layeradded', osdLayer);
    };

    const onFail = (applayer) => {
      this.dispatch('layererror', applayer);
    };

    this.dispatch('layerrequested', appLayer);

    // Prefetch DZI
    const layerId = appLayer._astriaId || getPropFromProduct(appLayer, config.es_mappings.id);

    // Map product to actual data path if using PDS
    if (config.data_provider_type === 'pds') {
      // const url = await pdsFetchDownloadPath(appLayer);
      appLayer._pdsURL = pdsGetS3PathForImage(appLayer);
    }
    const tileInfoManager = new TileInfoFetchManager(
      buildTiledImageURL(appLayer, false, isDNStretch, stretchLow, stretchHigh, operatorControls),
      (_response) => {
        delete activeTileInfoRequests[this.osdViewer.id][layerId];

        // only support tiled images and simple images
        const osdLayer =
          type === 'tile'
            ? stretchMode === 'backend'
              ? buildTileSourceForOverlay({
                  layer: appLayer,
                  index,
                  isDNStretch,
                  stretchLow,
                  stretchHigh,
                  operatorControls,
                  bounds,
                  onSuccess: onLoad,
                  onError: onFail,
                })
              : buildTileSourceForOverlay({
                  layer: appLayer,
                  index,
                  operatorControls,
                  bounds,
                  onSuccess: onLoad,
                  onError: onFail,
                })
            : buildSimpleImageSourceForOverlay(appLayer);

        // check that it isn't already added
        if (this.getLayerById(osdLayer._astriaId) && !replace) {
          return;
        }

        if (typeof index !== 'undefined') {
          osdLayer.index = index;
        }
        if (typeof opacity !== 'undefined') {
          osdLayer.opacity = opacity;
        }
        if (typeof replace !== 'undefined') {
          osdLayer.replace = replace;
        }

        // apply the offset values to the layer for placement
        // only matters if we have a current base image
        const baseImage = this.osdViewer.world.getItemAt(0);
        if (bounds && baseImage) {
          // convert bounds to viewport coordinates
          const { left, right, top, bottom } = bounds;
          const viewportRect = baseImage.imageToViewportRectangle(left, top, right - left, bottom - top);

          // only render the image within these bounds
          osdLayer.fitBounds = viewportRect;
          osdLayer.fitBoundsPlacement = OpenSeaDragon.Placement.CENTER;
        }

        if (type === 'tile') {
          this.osdViewer.addTiledImage(osdLayer);
        } else {
          this.osdViewer.addSimpleImage(osdLayer);
        }
      },
      (err) => {
        console.error('Error fetching DZI:', err);
        onFail(appLayer);
      }
    );
    if (!activeTileInfoRequests[this.osdViewer.id]) activeTileInfoRequests[this.osdViewer.id] = {};
    activeTileInfoRequests[this.osdViewer.id][layerId] = tileInfoManager;
    await tileInfoManager.fetchTileInfo();
  };

  removeLayer(layerId) {
    let osdLayer = this.getLayerById(layerId);
    if (osdLayer) {
      // Remove layer from the OSD world
      this.osdViewer.world.removeItem(osdLayer);

      // Remove tile requests
      this.abortTilesForLayer(osdLayer);
    }

    // Abort the layer DZI which may be prefetching so may not have an osdLayer yet
    this.abortAllTileInfoRequestForLayer(layerId);

    // clear item from load queue as well
    this.osdViewer._loadQueue = this.osdViewer._loadQueue.filter((item) => item.options._astriaId !== layerId);

    this.dispatch('layerremoved', layerId);
  }

  removeAll() {
    // track the ids of layers that are about about to be removed
    const numLayers = this.osdViewer.world.getItemCount();
    const layerIds = [];
    for (let i = 0; i < numLayers; ++i) {
      const item = this.osdViewer.world.getItemAt(i);
      if (item._astriaId) {
        layerIds.push(item._astriaId);
      }
      // If this is the main viewer and not the image export viewer or some other viewer
      // we'll abort any ongoing DZI and tile requests.
      if (this.osdViewer.id === 'osd-viewer') {
        this.abortTilesForLayer(item);
      }
    }

    // remove everything
    this.osdViewer.world.removeAll();
    this.abortAllTileInfoRequests();

    // signal what things were removed
    layerIds.forEach((layerId) => {
      this.dispatch('layerremoved', layerId);
    });

    this.dispatch('alllayersremoved');
  }

  abortTilesForLayer(osdLayer) {
    // Abort tiles
    const tileURLs = getTilesFromTilesMatrix(osdLayer.tilesMatrix).map((t) => t.url);
    tileURLs.forEach((tileURL) => {
      const activeReq = activeTileRequests[tileURL];
      if (activeReq) {
        activeReq.abort();
        delete activeTileRequests[tileURL];
      }
    });
  }

  abortAllTileInfoRequests() {
    // Abort DZI if found
    const requests = activeTileInfoRequests[this.osdViewer.id];
    if (requests) {
      Object.keys(requests).forEach((k) => requests[k].abort());
      delete activeTileInfoRequests[this.osdViewer.id];
    }
  }

  abortAllTileInfoRequestForLayer(layerId) {
    // Abort DZI for layer if found
    const requests = activeTileInfoRequests[this.osdViewer.id];
    if (requests) {
      const request = requests[layerId];
      if (request) {
        request.abort();
        delete requests[layerId];
      }
    }
  }

  // used for event overloading
  handleDoubleClickEvent(_event) {}
  handleClickEvent(_event) {}
  handleKeydown(_event) {}
  handleKeyup(_event) {}
  handleMouseMove(event) {
    if (this.osdViewer.world.getItemCount() > 0) {
      const webPoint = event.position;
      const viewportPoint = this.osdViewer.viewport.pointFromPixel(webPoint);
      const baseImage = this.osdViewer.world.getItemAt(0);
      if (baseImage.getBounds().containsPoint(viewportPoint)) {
        // Compute real image line and sample since image world starts at 0.5
        const oneIndexedImagePoint = baseImage.viewportToImageCoordinates(viewportPoint);
        oneIndexedImagePoint.x += 0.5;
        oneIndexedImagePoint.y += 0.5;
        this.dispatch('mousemove', { x: oneIndexedImagePoint.x, y: oneIndexedImagePoint.y });
      } else {
        this.dispatch('mousemove', { x: INVALID_POINT, y: INVALID_POINT });
      }
    }
  }

  setBaseImage(baseImage, groups) {
    this.baseImage = baseImage;
    this.activeSearchProductGroups = groups;
  }

  update(options) {
    const { baseImage, groups, preferredImageForType } = options;

    this.setBaseImage(baseImage, groups);
    this.setPreferredImageForType(preferredImageForType);
  }

  setPreferredImageForType(preferredImageForType) {
    this.preferredImageForType = preferredImageForType;
  }

  resetWorld() {
    this.osdViewer.world.resetItems();
  }

  setDebugMode(debug) {
    this.osdViewer.setDebugMode(debug);
  }

  setImageSmoothingEnabled(enabled) {
    this.osdViewer.drawer.context.imageSmoothingEnabled = enabled;
    this.osdViewer.forceRedraw();
  }

  moveLayer(layerId, newIndex) {
    const osdLayer = this.getLayerById(layerId);
    if (osdLayer) {
      // Prevent index from exceeding number of items in world since OSD
      // will throw an error if this situation occurs.
      const finalIndex = Math.min(newIndex, this.osdViewer.world.getItemCount() - 1);
      this.osdViewer.world.setItemIndex(osdLayer, finalIndex);
    } else {
      // check loading queue
      const lqItem = this.osdViewer._loadQueue.find((i) => i.options._astriaId === layerId);
      if (lqItem) {
        lqItem.options.index = newIndex;
      }
    }
  }

  setLayerOpacity(layerId, opacity) {
    const osdLayer = this.getLayerById(layerId);
    if (osdLayer) {
      osdLayer.setOpacity(opacity);
    } else {
      // check loading queue
      const lqItem = this.osdViewer._loadQueue.find((i) => i.options._astriaId === layerId);
      if (lqItem) {
        lqItem.options.opacity = opacity;
      }
    }
  }

  destroy() {
    this.osdViewer.destroy();
    this.osdViewer = null;
  }

  onViewportChange() {
    this.dispatch('viewportchange', this.getView());
  }

  getView(current = false) {
    // Guard against uninitialized or misbehaving osdViewer/viewport which can in rare cases
    // decide not to exist yet.
    if (!this.osdViewer || !this.osdViewer.viewport) {
      return { zoom: 0, center: [0, 0], imageBounds: [0, 0, 1, 1], rotation: 0 };
    }

    let base = this.osdViewer.viewport;
    if (this.osdViewer.world.getItemCount() > 0) {
      base = this.osdViewer.world.getItemAt(0);
    }

    const vCenter = this.osdViewer.viewport.getCenter(current);
    const { x, y } = base.viewportToImageCoordinates(vCenter);

    const zoom = base.viewportToImageZoom(this.osdViewer.viewport.getZoom(current));
    const center = [x, y];

    const viewBounds = this.osdViewer.viewport.getBounds();
    let imageBounds = base.viewportToImageRectangle(viewBounds);
    imageBounds = [imageBounds.x, imageBounds.y, imageBounds.x + imageBounds.width, imageBounds.y + imageBounds.height];

    const rotation = this.osdViewer.viewport.getRotation();

    return { zoom, center, imageBounds, rotation };
  }

  zoomIn() {
    // Call OSD button onClick. Note: these buttons must not be
    // disabled in OSD options or else the control onClicks will not be
    // exposed. Normally OSD binds to some ID in the DOM for custom buttons
    // but there's an issue if the button ever gets recreated so this is the
    // workaround since OSD doesn't otherwise cleanly expose those functions.
    // In fact it makes it particularly annoying to emulate zoomIn/Out since
    // it employs a tracking variable local to the non-exported, private OSD context.
    this.osdViewer.zoomInButton.onClick();
  }

  zoomOut() {
    // Call OSD button onClick. Note: these buttons must not be
    // disabled in OSD options or else the control onClicks will not be
    // exposed. Normally OSD binds to some ID in the DOM for custom buttons
    // but there's an issue if the button ever gets recreated so this is the
    // workaround since OSD doesn't otherwise cleanly expose those functions.
    // In fact it makes it particularly annoying to emulate zoomIn/Out since
    // it employs a tracking variable local to the non-exported, private OSD context.
    this.osdViewer.zoomOutButton.onClick();
  }

  // Taken from OSD src since they do not expose this.
  positiveModulo(num, modulo) {
    let result = num % modulo;
    if (result < 0) {
      result += modulo;
    }
    return result;
  }

  // Taken from OSD src since they do not expose this.
  rotateLeft() {
    if (this.osdViewer.viewport) {
      let currRotation = this.osdViewer.viewport.getRotation();
      currRotation = this.positiveModulo(currRotation - 90, 360);
      this.setRotation(currRotation);
      this.onViewportChange();
    }
  }

  // Taken from OSD src since they do not expose this.
  rotateRight() {
    if (this.osdViewer.viewport) {
      let currRotation = this.osdViewer.viewport.getRotation();
      currRotation = this.positiveModulo(currRotation + 90, 360);
      this.setRotation(currRotation);
      this.onViewportChange();
    }
  }

  resetRotation() {
    this.setRotation(0);
  }

  setRotation(degrees) {
    // Sets rotations in OSD but does not trigger viewport change
    if (this.osdViewer.viewport) {
      this.osdViewer.viewport.setRotation(degrees);
      this.osdViewer.viewport.applyConstraints();
    }
  }

  resetView() {
    this.osdViewer.viewport.goHome();
  }

  setPictureZoom(picZoom, picCenter, immediately = true) {
    window.requestAnimationFrame(() => {
      if (typeof picZoom === 'number' && picZoom > 0 && picZoom <= 5000) {
        let base = this.osdViewer.viewport;
        if (this.osdViewer.world.getItemCount() > 0) {
          base = this.osdViewer.world.getItemAt(0);
        }
        const zoom = base.imageToViewportZoom(picZoom);
        const zChain = this.osdViewer.viewport.zoomTo(zoom, null, immediately);
        if (picCenter) {
          const center = base.imageToViewportCoordinates(picCenter[0], picCenter[1]);
          zChain.panTo(center, immediately);
        }
      } else {
        this.osdViewer.viewport.goHome();
      }
    });
  }

  zoomToBounds(bounds, offset = 35) {
    if (!bounds) return;
    const baseImage = this.osdViewer.world.getItemAt(0);
    if (!baseImage) return;
    const targetWidth = Math.abs(bounds.bottomRight.sample - bounds.topLeft.sample);
    const targetHeight = Math.abs(bounds.bottomRight.line - bounds.topLeft.line);
    const imageSize = baseImage.getContentSize();

    const x = Math.max(bounds.topLeft.sample - offset, 0);
    const y = Math.max(bounds.topLeft.line - offset, 0);
    const width = Math.min(targetWidth + offset * 2, imageSize.x - x);
    const height = Math.min(targetHeight + offset * 2, imageSize.y - y);
    const viewportRect = baseImage.imageToViewportRectangle(x, y, width, height);
    this.osdViewer.viewport.fitBoundsWithConstraints(viewportRect);
  }

  zoomToLineSample(lsPoint) {
    const offset = Math.min(lsPoint.line, lsPoint.sample, 35);
    const baseImage = this.osdViewer.world.getItemAt(0);
    const viewportRect = baseImage.imageToViewportRectangle(
      lsPoint.sample - offset,
      lsPoint.line - offset,
      Math.max(offset, 70),
      Math.max(offset, 70)
    );
    this.osdViewer.viewport.fitBoundsWithConstraints(viewportRect);
  }

  /**
   * Convert an OSD window coordinate to an image line/sample point
   *
   * @param {Number} x x window pixel coordinate
   * @param {Number} y y window pixel coordinate
   * @param {Bool} allowExt false if this should return an invalid point if the point lies outside the image
   * @param {Bool} allowPartial false if this should always return a round number
   * @returns {Object} {line,sample} image coordinate
   * @memberof OpenSeaDragonWrapper
   */
  osdToLineSample = (x, y, allowExt = false, allowPartial = false) => {
    const osdPoint = new OpenSeaDragon.Point(x, y);
    const viewportPoint = this.osdViewer.viewport.pointFromPixel(osdPoint);

    if (this.osdViewer.world.getItemCount() > 0) {
      const baseImage = this.osdViewer.world.getItemAt(0);
      // Compute real image line and sample since image world starts at 0.5
      const oneIndexedImagePoint = baseImage.viewportToImageCoordinates(viewportPoint);
      // round off partial pixels if needed
      if (!allowPartial) {
        oneIndexedImagePoint.x = Math.ceil(oneIndexedImagePoint.x);
        oneIndexedImagePoint.y = Math.ceil(oneIndexedImagePoint.y);
      }
      if (allowExt || baseImage.getBounds().containsPoint(viewportPoint)) {
        return { line: oneIndexedImagePoint.y, sample: oneIndexedImagePoint.x };
      }
    }
    return { line: INVALID_POINT, sample: INVALID_POINT };
  };
}
