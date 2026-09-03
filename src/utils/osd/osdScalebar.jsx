import debounce from 'lodash.debounce';
import { MouseTracker, Point } from 'openseadragon';
import { createRoot } from 'react-dom/client';
import { v4 as uuidv4 } from 'uuid';
import { Scalebar } from '../../components/common/Scalebar';
import { getScaleData } from '../dataQuery';

// NOTE: requires OSDScalebarMixin(OSDViewer)

export const OSDScalebarMixin = (base) =>
  class extends base {
    constructor(options) {
      super(options);

      this.scalebarOverlays = {};
      this.scalebarsToAdd = [];
      this.autoAddScalebar = false;
      this.scalebars = {};
      this.resetScalebars();
      this.scalebarTrackers = {};
      this.defaultScalebar = {
        defaultX: 16,
        defaultY: 40,
        pinToScreen: true,
        isDragging: false,
        prevPixelSizeInfo: { approximate: false },
        controller: null,
      };
      this.debouncedScalebarQueries = {};

      // set up listeners
      this.osdViewer.addHandler('zoom', (evt) => {
        Object.values(this.scalebars).forEach((loc) => {
          if (evt.zoom !== loc.prevZoom) {
            if (loc.pinToScreen) {
              loc.prevPPM = -1;
              loc.prevPPMUncertainty = -1;
            }
          }
          loc.prevZoom = evt.zoom;
        });
      });

      this.osdViewer.addHandler('pan', () => {
        Object.values(this.scalebars).forEach((loc) => {
          if (loc.pinToScreen) {
            loc.prevPPM = -1;
            loc.prevPPMUncertainty = -1;
          }
        });
      });

      this.on('layeradded', () => {
        const osdBaseImage = this.osdViewer.world.getItemAt(0);
        if (osdBaseImage) {
          this.scalebarsToAdd.forEach((scalebar) => {
            this.addScalebar(scalebar.point, scalebar.pinToScreen);
          });
          this.scalebarsToAdd = [];
        }
      });
    }

    showScalebars() {
      // if we have already made scalebars, re-activate them
      // otherwise create a new one
      if (Object.keys(this.scalebarOverlays).length > 0) {
        Object.entries(this.scalebarOverlays).forEach(([id, scalebarOverlay]) => {
          scalebarOverlay.element.style.display = 'block';
          if (this.scalebarTrackers[id]) {
            this.scalebarTrackers[id].setTracking(true);
          }
          return;
        });
      } else if (this.scalebarsToAdd.length < 1 && this.autoAddScalebar) {
        this.addScalebar();
      }
    }

    addScalebar(lsPoint, pinToScreen = true) {
      const id = uuidv4();

      // get the base image for reference
      const osdBaseImage = this.osdViewer.world.getItemAt(0);
      if (!osdBaseImage) {
        this.scalebarsToAdd.push({ point: lsPoint, pinToScreen });
      } else {
        this.scalebars[id] = structuredClone(this.defaultScalebar);
        this.scalebars[id].pinToScreen = pinToScreen;

        // create a dom element for the overlay
        this.scalebarOverlays[id] = {};
        this.scalebarOverlays[id].element = document.createElement('div');
        this.scalebarOverlays[id].element.id = `osd-scalebar-overlay-${id}`;
        this.scalebarOverlays[id].reactRoot = createRoot(this.scalebarOverlays[id].element);

        // get the viewport coordinate for the scalebar and add the overlay
        let initialViewportPoint;
        let initialPoint;

        const p = lsPoint || { line: this.defaultScalebar.defaultY, sample: this.defaultScalebar.defaultX };
        if (pinToScreen) {
          initialPoint = new Point(p.line, p.sample);
        } else {
          initialPoint = new Point(p.sample - 0.5, p.line - 0.5); // convert back to normal pixel space
        }
        if (lsPoint) {
          this.scalebars[id].x = p.line;
          this.scalebars[id].y = p.sample;
        }

        initialViewportPoint = osdBaseImage.imageToViewportCoordinates(initialPoint);

        this.scalebars[id].update = debounce(this.scalebarQueryUpdate.bind(this), 300, {
          trailing: true,
        });

        this.osdViewer.addOverlay({
          element: this.scalebarOverlays[id].element,
          location: initialViewportPoint,
          placement: 'ABSOLUTE',
          onDraw: (position, size, element) => this.drawScalebar(position, size, element, id),
        });

        // create a tracker to respond to drag events
        this.scalebarTrackers[id] = new MouseTracker({
          element: this.scalebarOverlays[id].element,
          startDisabled: false,
          clickHandler: function (event) {
            const target = event.originalTarget;
            if (typeof target.click === 'function') {
              target.click();
            }
          },
          pressHandler: (event) => {
            // make sure that we are pressing (dragging) the scalebar and not the pin button
            const noDrag = event.originalEvent
              .composedPath()
              .reduce((acc, el) => acc || (el.getAttribute && el.getAttribute('nodrag')), false);

            if (!noDrag) {
              // signal drag
              this.scalebars[id].isDragging = true;
              this.placeScalebarFromDrag(event, id);
            }
          },
          releaseHandler: () => {
            if (this.scalebars[id].isDragging) {
              // reset ppm since we have moved
              this.scalebars[id].prevPPM = -1;
              this.scalebars[id].prevPPMUncertainty = -1;
              this.scalebars[id].prevPixelSizeInfo = { approximate: false };
            }
            // end drag signal
            this.scalebars[id].isDragging = false;
            this.placeScalebarFromPrevious(id);
          },
          dragHandler: (event) => {
            this.placeScalebarFromDrag(event, id);
          },
        });

        let storedPoint;
        if (pinToScreen) {
          storedPoint = { line: initialPoint.x, sample: initialPoint.y };
        } else {
          storedPoint = { line: initialPoint.y, sample: initialPoint.x };
        }

        if (lsPoint) {
          this.dispatch('scalebaradded', {
            point: storedPoint,
            id,
            pinToScreen,
          });
        }
      }
    }

    removeScalebar(id) {
      const scalebar = this.scalebars[id];
      if (scalebar && scalebar.controller) {
        scalebar.controller.abort();
      }
      if (this.scalebarOverlays[id]) {
        const root = this.scalebarOverlays[id].reactRoot;
        // unmount asyncronously
        setTimeout(() => {
          root?.unmount();
        });
        this.osdViewer.removeOverlay(this.scalebarOverlays[id].element);
      }
      delete this.scalebarOverlays[id];
      delete this.scalebars[id];
      delete this.scalebarTrackers[id];

      this.dispatch('scalebarremoved', { id });
    }

    placeScalebarFromDrag(event, id) {
      const scalebar = this.scalebars[id];
      if (scalebar && scalebar.isDragging) {
        // convert the drag event coordinate (window space) to a viewport space coordinate for osd placement reference
        // and convert that to a viewer element space coordinate for future reference
        const vLoc = this.osdViewer.viewport.windowToViewportCoordinates(
          new Point(event.originalEvent.x, event.originalEvent.y)
        );
        const veLoc = this.osdViewer.viewport.viewportToViewerElementCoordinates(new Point(vLoc.x, vLoc.y));
        scalebar.x = veLoc.x;
        scalebar.y = veLoc.y;
        this.osdViewer.updateOverlay(this.scalebarOverlays[id].element, vLoc, 'ABSOLUTE');
      }
    }

    placeScalebarFromPrevious(id) {
      const scalebar = this.scalebars[id];
      if (typeof scalebar.x === 'undefined' || typeof scalebar.y === 'undefined') {
        scalebar.x = scalebar.prevX;
        scalebar.y = scalebar.prevY;
      }
      // update the scalebar from the last known location to force a redraw and scale update
      const vLoc = this.osdViewer.viewport.viewerElementToViewportCoordinates(new Point(scalebar.x, scalebar.y));
      this.osdViewer.updateOverlay(this.scalebarOverlays[id].element, vLoc, 'ABSOLUTE');

      // If pinned, treat as L/S, otherwise treat as screen space
      let point;
      if (scalebar.pinToScreen) {
        point = { line: scalebar.x, sample: scalebar.y };
      } else {
        point = this.osdToLineSample(scalebar.x, scalebar.y);
      }
      this.dispatch('scalebarupdated', {
        id,
        point,
        pinToScreen: scalebar.pinToScreen,
      });
    }

    hideScalebars() {
      if (this.callback) {
        this.off('layeradded', this.callback);
      }
      Object.entries(this.scalebarOverlays).forEach(([id, scalebarOverlay]) => {
        // hide the scalebar node and disable the listeners
        scalebarOverlay.element.style.display = 'none';

        if (this.scalebarTrackers[id]) {
          this.scalebarTrackers[id].setTracking(false);
        }
      });
    }

    resetScalebars() {
      Object.keys(this.scalebars).forEach((id) => {
        this.removeScalebar(id);
      });
      this.scalebarOverlays = {};
      this.scalebars = {};
      this.scalebarTrackers = {};
    }

    scalebarQueryUpdate(options) {
      // query scale information for a product at a particular image x/y
      const { groups, baseImage, osdBaseImage, iLocX, iLocY, preferredImageForType, id } = options;
      const scalebar = this.scalebars[id];
      if (baseImage && scalebar) {
        const renderScalebar = (pixelSizeInfo) => {
          window.requestAnimationFrame(() => {
            if (this.osdViewer && this.scalebarOverlays[id]) {
              // convert pixel size (mpp) to current ppm based on zoom
              const { pixelSize, pixelSizeUncertainty, approximate } = pixelSizeInfo;
              const zoom = osdBaseImage.viewportToImageZoom(this.osdViewer.viewport.getZoom());
              const ppm = pixelSize > 0 ? zoom / pixelSize : -2;
              const ppmUncertainty = pixelSizeUncertainty > 0 ? zoom / pixelSizeUncertainty : -2;
              scalebar.prevPPM = ppm;
              scalebar.prevPPMUncertainty = ppmUncertainty;
              scalebar.prevPixelSizeInfo = pixelSizeInfo;

              // re-render the scalebar with the new ppm
              this.scalebarOverlays[id].reactRoot.render(
                <Scalebar
                  draggable={true}
                  pixelsPerMeter={ppm}
                  pixelsPerMeterUncertainty={ppmUncertainty}
                  drag={scalebar.isDragging}
                  approximate={approximate}
                  pinned={!scalebar.pinToScreen}
                  togglePinned={() => this.toggleScalebarPinned(id)}
                  addScalebar={() => this.addScalebar(this.getImageCenter())}
                  removeScalebar={() => this.removeScalebar(id)}
                />
              );
            }
          });
        };

        if (scalebar?.controller) {
          scalebar.controller.abort();
        }

        scalebar.controller = new AbortController();
        getScaleData(baseImage, groups, iLocY, iLocX, preferredImageForType, scalebar.controller.signal)
          .then(renderScalebar)
          .catch((err) => {
            renderScalebar({ pixelSize: -1, approximate: true });
            return;
          });
      }
    }

    drawScalebar = (position, size, element, id) => {
      // check if we still have a base image to be relative to
      const osdBaseImage = this.osdViewer.world.getItemAt(0);
      if (!osdBaseImage) {
        return;
      }

      // extract current zoom, image bounds, and viewport bounds
      const zoom = osdBaseImage.viewportToImageZoom(this.osdViewer.viewport.getZoom());
      const ibounds = this.osdViewer.viewport.viewportToViewerElementRectangle(osdBaseImage.getBounds(true));
      const vbounds = this.osdViewer.viewport.viewportToViewerElementRectangle(this.osdViewer.viewport.getBounds(true));

      // calculate position limits
      let x = position.x;
      let y = position.y;
      const halfX = Math.round(size.x / 2);
      const halfY = Math.round(size.y / 2);
      const scalebar = this.scalebars[id];
      if (!scalebar.pinToScreen || scalebar.isDragging) {
        // scalebar pinned to image or dragging
        const minX = ibounds.x + halfX; // image left
        const maxX = ibounds.width + ibounds.x - halfX; // image right
        const minY = ibounds.y + halfY; // image top
        const maxY = ibounds.height + ibounds.y - halfY; // image bottom
        x = Math.max(Math.min(position.x, maxX), minX);
        y = Math.max(Math.min(position.y, maxY), minY);
        scalebar.x = x;
        scalebar.y = y;
      } else {
        // pinned to screen

        // this is the point in the image we would like to place the scalebar
        const targetX = scalebar.x ? scalebar.x : ibounds.x + this.defaultScalebar.defaultX + halfX;
        const targetY = scalebar.y ? scalebar.y : ibounds.y + ibounds.height - this.defaultScalebar.defaultY;

        // this is the buffer around the edge of the image we want to keep the scalebar within
        const bufferX = scalebar.x ? 0 : this.defaultScalebar.defaultX;
        const bufferY = scalebar.y ? 0 : this.defaultScalebar.defaultY;

        // calculate the horizontal bounds of the viewport and the image
        const iMaxX = ibounds.x + ibounds.width - (bufferX + halfX);
        const iMinX = ibounds.x + (bufferX + halfX);
        const vMaxX = vbounds.x + vbounds.width - (bufferX + halfX);
        const vMinX = vbounds.x + (bufferX + halfX);

        // calculate the vertical bounds of the viewport and the image
        const iMinY = ibounds.y + bufferY + halfY;
        const iMaxY = ibounds.y + ibounds.height - (bufferY + halfY);
        const vMinY = vbounds.y + bufferY + halfY;
        const vMaxY = vbounds.y + vbounds.height - (bufferY + halfY);

        // calculate the min/max bounds from the image and viewport
        const minX = Math.max(iMinX, vMinX);
        const maxX = Math.min(iMaxX, vMaxX);
        const minY = Math.max(iMinY, vMinY);
        const maxY = Math.min(iMaxY, vMaxY);

        // calculate the best actual placement
        x = iMaxX < vMinX ? iMaxX : Math.max(Math.min(targetX, maxX), minX);
        y = iMaxY < vMinY ? iMaxY : Math.max(Math.min(targetY, maxY), minY);
      }

      // query accurate scale data
      const iLoc = osdBaseImage.viewerElementToImageCoordinates(new Point(x, y));
      iLoc.x = Math.ceil(iLoc.x);
      iLoc.y = Math.ceil(iLoc.y);
      // only query if we have moved (but are not currently dragging)
      if (
        !scalebar.isDragging &&
        (iLoc.x !== scalebar.prevIX || iLoc.y !== scalebar.prevIY || zoom !== scalebar.prevZoom)
      ) {
        scalebar.prevIX = iLoc.x;
        scalebar.prevIY = iLoc.y;
        scalebar.prevZoom = zoom;

        // create a debounce for querying a new scale value
        scalebar.update({
          osdBaseImage: osdBaseImage /* the openseadragon base image object */,
          baseImage: this.baseImage /* the ocs base image object */,
          groups: this.activeSearchProductGroups,
          iLocX: iLoc.x,
          iLocY: iLoc.y,
          preferredImageForType: this.preferredImageForType,
          id,
        });
      }

      // render the scalebar to the dom
      window.requestAnimationFrame(() => {
        // position the node
        element.style.left = `${Math.round(x)}px`;
        element.style.top = `${Math.round(y)}px`;

        // store the previous location
        scalebar.prevX = x;
        scalebar.prevY = y;

        // caclulate the ppm scale to display
        let ppm = scalebar.prevPPM || -1;
        let ppmUncertainty = scalebar.prevPPMUncertainty || -1;
        const approximate = scalebar.prevPixelSizeInfo.approximate;
        if (!scalebar.pinToScreen) {
          const pixelSize = scalebar.prevPixelSizeInfo.pixelSize;
          if (pixelSize) {
            ppm = pixelSize > 0 ? zoom / pixelSize : -2;
          }
          const pixelSizeUncertainty = scalebar.prevPixelSizeInfo.pixelSizeUncertainty;
          if (pixelSizeUncertainty) {
            ppmUncertainty = pixelSizeUncertainty > 0 ? zoom / pixelSizeUncertainty : -1;
          }
        }
        const hidden = size.x === 0 && size.y === 0;
        if (this.scalebarOverlays[id]) {
          this.scalebarOverlays[id].reactRoot.render(
            <Scalebar
              draggable={true}
              hidden={hidden}
              pixelsPerMeter={ppm}
              pixelsPerMeterUncertainty={ppmUncertainty}
              drag={scalebar.isDragging}
              approximate={approximate}
              pinned={!scalebar.pinToScreen}
              togglePinned={() => this.toggleScalebarPinned(id)}
              addScalebar={() => this.addScalebar(this.getImageCenter())}
              removeScalebar={() => this.removeScalebar(id)}
            />
          );
        }
      });
    };

    getImageCenter() {
      const osdBaseImage = this.osdViewer.world.getItemAt(0);
      if (osdBaseImage) {
        const { x, y, width, height } = this.osdViewer.viewport.getBounds(true);
        const point = new Point(x + width / 2, y + height / 2);
        const veLoc = this.osdViewer.viewport.viewportToViewerElementCoordinates(new Point(point.x, point.y));
        return { line: veLoc.x, sample: veLoc.y };
      }
      return null;
    }

    toggleScalebarPinned = (id) => {
      this.scalebars[id].pinToScreen = !this.scalebars[id].pinToScreen;
      this.scalebars[id].isDragging = false;
      this.placeScalebarFromPrevious(id);
    };
  };
