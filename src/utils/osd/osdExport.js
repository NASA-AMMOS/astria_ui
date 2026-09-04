import FileSaver from 'file-saver';
import OpenSeaDragon, { DziTileSource, Rect } from 'openseadragon';
import shortid from 'shortid';
import { genWKTString } from 'src/utils'; // who likes circular dependencies?
import { getConfig } from 'src/utils/configRegistry';
import { OSDWrapperNoExport } from 'src/utils/osd/osdWrapper'; // who likes circular dependencies?

// NOTE: requires OSDExportMixin(OSDAnnotateMixin(OSDFabricMixin(OSDViewer)))

// constant ruler sizes
const RULER_WIDTH = {
  HIGH: 48,
  MED: 24,
  LOW: 12,
};
let RULER_WIDTH_REF = RULER_WIDTH.MED;

// limit the maximum edge size of the annotations to 16K because of browser limits
// https://stackoverflow.com/questions/6081483/maximum-size-of-a-canvas-element
const MAXIMUM_EDGE_LEN = 32767;
const MAXIMUM_AREA = 268435456;

export const OSDExportMixin = (base) =>
  class extends base {
    exportImage(options) {
      return new Promise((resolve, reject) => {
        const {
          bounds,
          drawings,
          features,
          measurements,
          targets,
          azElRulers,
          download,
          hideFeatureLabels,
          layerFilter,
        } = options;
        let { resolution } = options; // number ex: 720, 1080, 2160
        // retrieve base image size
        const baseImage = this.osdViewer.world.getItemAt(0);
        const baseSize = baseImage.getContentSize();

        // calculate target sizing
        let {
          targetWidth,
          targetHeight,
          resolution: calcRes,
          imageBounds,
        } = this.calculateExportResolution(baseImage, resolution, bounds);
        resolution = calcRes;

        // disable bounds for full-frame images
        imageBounds =
          imageBounds && imageBounds.width === baseSize.x && imageBounds.height === baseSize.y ? null : imageBounds;

        // set ruler width depending on requested resolution
        // at high resolutions these can be very small - TODO scale based on percentage?
        RULER_WIDTH_REF = resolution > 2160 ? RULER_WIDTH.HIGH : resolution > 1080 ? RULER_WIDTH.MED : RULER_WIDTH.LOW;

        // generate the base image
        this.generateViewImage(targetWidth, targetHeight, imageBounds, azElRulers, layerFilter)
          .then((data) => {
            const { renderedImage, shadowViewer, shadowContainer } = data;

            // force fabric size update out of paranoia
            shadowViewer.resizeFabricCanvas();

            // OSD may create an image at a different size & aspect ratio than specified depending on monitor pixel density.
            // we trust that it is upscaling via pixel duplication and that our eventual downsample will just use nearest-neighbor selection
            // if OSD renders to a canvas larger than MAXIMUM_EDGE_LEN, we may have an issue
            const fullFrameWidth = targetWidth;
            const fullFrameHeight = targetHeight;

            // pull annotation shapes and add them to the shadow viewer
            if (drawings) {
              const annoJson = this.annotationToJSON('__DRAWINGS__', false);
              if (layerFilter) {
                annoJson.objects = annoJson.objects.filter((obj) => layerFilter(obj));
              }
              shadowViewer.addAnnotation(annoJson, shortid.generate());
            }

            // pull measurements and add them to the shadow viewer
            if (measurements) {
              for (const measureId in this._measurements) {
                const measurement = this._measurements[measureId];
                shadowViewer.addMeasurement({
                  lsPoint1: { ...measurement.lsPoint1 },
                  lsPoint2: { ...measurement.lsPoint2 },
                  text: measurement.text,
                });
              }
            }

            if (targets) {
              for (const targetId in this._targets) {
                const target = this._targets[targetId];
                shadowViewer.addTarget({
                  line: target.lsPoint.line,
                  sample: target.lsPoint.sample,
                  id: target.targetId,
                  text: target.text,
                  opacity: target.fabricObjs[0].opacity,
                });
              }
            }

            if (features) {
              // features can be `true` for all features or an array of feature ids
              const featureIds = Array.isArray(features) ? features : Object.keys(this._imageFeatures);
              featureIds.forEach((featureId) => {
                if (layerFilter && !layerFilter(featureId)) return;

                const featureObjs = this._imageFeatures[featureId];
                if (featureObjs) {
                  const poly = featureObjs.find((x) => x.get('isImageFeaturePrimaryPolygon'));
                  const text = featureObjs.find((x) => x.get('isImageFeatureText'));
                  const points = poly.get('lsPoints');
                  shadowViewer.addImageFeatures(
                    {
                      feature_geometry: genWKTString({
                        coords: points.map((p) => [p.sample, p.line]),
                        forceCircle: true,
                      }),
                      feature_label: text.get('text'),
                      feature_confidence_level: poly.get('confidenceLevel'),
                      feature_id: shortid.generate(),
                    },
                    false,
                    hideFeatureLabels
                  );
                }
              });
            }

            // shadowViewer fabric layer should now be populated with all of the objects we want to export
            window.requestAnimationFrame(() => {
              shadowViewer
                .generateAnnotationImageDirect()
                .then((renderedImageAnno) => {
                  // composite everything together
                  const shadowCanvas = document.createElement('canvas');
                  shadowCanvas.width = fullFrameWidth;
                  shadowCanvas.height = fullFrameHeight;
                  const ctx = shadowCanvas.getContext('2d');
                  ctx.drawImage(renderedImage, 0, 0, fullFrameWidth, fullFrameHeight);
                  ctx.drawImage(renderedImageAnno, 0, 0, fullFrameWidth, fullFrameHeight);

                  // save the composite blob
                  shadowCanvas.toBlob((blob) => {
                    if (download) {
                      const output_filename = `${baseImage.filename.replace(/\.[^/.]+$/, '')}_EXPORT${
                        bounds ? '_CROPPED' : ''
                      }.png`;
                      FileSaver.saveAs(blob, output_filename);
                    }

                    // clean up resources
                    shadowViewer.osdViewer.destroy();
                    shadowViewer._fabricCanvas.dispose();
                    shadowContainer.remove();

                    resolve({ fullFrameHeight, fullFrameWidth, blob });
                  });
                })
                .catch((err) => {
                  // clean up resources
                  shadowViewer.osdViewer.destroy();
                  shadowViewer._fabricCanvas.dispose();
                  shadowContainer.remove();

                  reject(err);
                });
            });
          })
          .catch((err) => reject(err));
      });
    }

    generateViewImage(targetWidth, targetHeight, imageBounds, azElRulers, layerFilter) {
      const config = getConfig();
      return new Promise((resolve, reject) => {
        // built a DOM mount point for the shadow canvas
        const osdShadowDiv = document.createElement('div');
        osdShadowDiv.id = 'osd-viewer-shadow';
        osdShadowDiv.style.position = 'fixed';
        osdShadowDiv.style.left = 0;
        osdShadowDiv.style.top = '100%';
        osdShadowDiv.style.width = `${targetWidth + (azElRulers ? RULER_WIDTH_REF : 0)}px`;
        osdShadowDiv.style.height = `${targetHeight + (azElRulers ? RULER_WIDTH_REF : 0)}px`;
        document.getElementById('root').after(osdShadowDiv);

        // options for the shadow OSD instance
        const openSeaDragonOptions = {
          id: 'osd-viewer-shadow',
          debugMode: false,
          maxZoomPixelRatio: 50,
          imageSmoothingEnabled: this.osdViewer.drawer.context.imageSmoothingEnabled,
          prefixUrl: 'https://openseadragon.github.io/openseadragon/images/',
          showNavigator: false,
          showRotationControl: false,

          // don't let OSD actually attach controls but still tell it to think
          // that controls exist so that we can use their onClick methods
          zoomInButton: 'hidden-zoom-in-shadow',
          zoomOutButton: 'hidden-zoom-out-shadow',
          homeButton: 'hidden-home-shadow',
          fullPageButton: 'hidden-full-page-shadow',
          rotateLeftButton: 'hidden-rotate-left-shadow',
          rotateRightButton: 'hidden-rotate-right-shadow',

          visibilityRatio: 1,
          gestureSettingsMouse: { clickToZoom: false }, // Turn off zooms on click
          ajaxWithCredentials: config.using_csso,
          loadTilesWithAjax: true, // Always use AJAX for tiles to enable retry logic

          transformImage: this.transformImage,
        };

        // initiate the shadow viewer
        const shadowViewer = new OSDWrapperNoExport(openSeaDragonOptions);

        // add handler for failed loads
        shadowViewer.on('tileloaderror', () => {
          // clean up resources
          shadowViewer.osdViewer.destroy();
          shadowViewer._fabricCanvas.dispose();
          osdShadowDiv.remove();

          reject(new Error('Failed to load tiles'));
        });

        // add an individual tile load listener
        const tileTracker = {};
        const tiledImageTracker = {};
        shadowViewer.osdViewer.addHandler('tile-loaded', (evt) => {
          const { tiledImage, tile } = evt;
          const { total } = this.calculateTileCount(tiledImage);

          // OSD loads some tiles twice... not sure why.
          // Accommodate this in the progress tracking by upping the total number of needed tiles
          const tileKey = `${tiledImage._astriaId}_${tile.level}_${tile.x}_${tile.y}`;
          if (tileTracker[tileKey]) {
            tiledImageTracker[tiledImage._astriaId].needed += 1;
          }
          tileTracker[tileKey] = true;

          // update our progress tracking
          tiledImageTracker[tiledImage._astriaId].loaded += 1;
          tiledImageTracker[tiledImage._astriaId].needed = Math.max(
            total,
            tiledImageTracker[tiledImage._astriaId].needed
          );

          // sum our progress thus far and notify watchers
          let totalLoaded = 0;
          let totalNeeded = 0;
          const keys = Object.keys(tiledImageTracker);
          keys.forEach((key) => {
            totalLoaded += tiledImageTracker[key].loaded;
            totalNeeded += tiledImageTracker[key].needed;
          });
          this.dispatch('exportprogress', { loaded: totalLoaded, needed: totalNeeded });
        });

        // copy the image layers into the shadow viewer
        const promiseArr = [];
        const numItems = this.osdViewer.world.getItemCount();
        for (let i = 0; i < numItems; ++i) {
          const layer = this.osdViewer.world.getItemAt(i);
          if (layerFilter && !layerFilter(layer)) return;

          const prom = new Promise((res) => {
            const options = { ...layer._astriaOrigOptions };
            // apply the offset values to the layer for placement
            // only matters if we have a current base image
            const baseImage = this.osdViewer.world.getItemAt(0);
            const bounds = layer._astriaOrigOptions.bounds;
            if (bounds && baseImage) {
              // convert bounds to viewport coordinates
              const { left, right, top, bottom } = bounds;
              const viewportRect = baseImage.imageToViewportRectangle(left, top, right - left, bottom - top);

              // only render the image within these bounds
              options.fitBounds = viewportRect;
              options.fitBoundsPlacement = OpenSeaDragon.Placement.CENTER;
            }

            shadowViewer.osdViewer.addTiledImage(
              new DziTileSource({
                ...options,
                opacity: layer.opacity,
                success: (evt) => {
                  // successfully added (not loaded)
                  if (evt.item) {
                    evt.item._astriaId = layer._astriaId;

                    // initialize tile tracker
                    tiledImageTracker[evt.item._astriaId] = {
                      loaded: 0,
                      needed: 0,
                    };
                    res(true);
                  }
                },
              })
            );
          });
          promiseArr.push(prom);
        }

        // update the base image and groups
        shadowViewer.update({ baseImage: this.baseImage });

        // wait for the images to be added
        Promise.all(promiseArr).then(() => {
          // setup load listeners
          if (imageBounds) {
            const baseImage = shadowViewer.osdViewer.world.getItemAt(0);
            const bounds = baseImage.imageToViewportRectangle(imageBounds);
            shadowViewer.osdViewer.viewport.fitBounds(bounds, true);
          } else {
            shadowViewer.osdViewer.viewport.goHome(true);
            shadowViewer.osdViewer.world.resetItems();
          }

          window.requestAnimationFrame(() => {
            for (let i = 0; i < numItems; ++i) {
              const item = shadowViewer.osdViewer.world.getItemAt(i);
              const prom = new Promise((res) => {
                // initialize tile needed count
                const { total } = this.calculateTileCount(item);
                tiledImageTracker[item._astriaId].needed = total;
                if (item.getFullyLoaded()) {
                  res(true);
                } else if (Object.keys(item.coverage).length === 0) {
                  // Case where no tiles are needed, fully-loaded-change will never fire
                  // and this tileset is not needed for this export
                  res(true);
                } else {
                  item.addHandler('fully-loaded-change', () => {
                    res(true);
                  });
                }
              });
              promiseArr.push(prom);
            }

            // once all the images are loaded, export the canvas
            Promise.all(promiseArr).then(() => {
              if (azElRulers) {
                shadowViewer.setRulerWidth(RULER_WIDTH_REF);
                shadowViewer.addRulers();
              }

              // rAF for the warm and fuzzy feelings
              window.requestAnimationFrame(() => {
                resolve({
                  renderedImage: shadowViewer.osdViewer.drawer.canvas,
                  shadowViewer,
                  shadowContainer: osdShadowDiv,
                });
              });
            });
          });
        });
      });
    }

    calculateTileCount(tiledImage) {
      // calculate the number of tiles an image needs to load
      let needed = 0;
      let total = 0;
      const coverage = tiledImage.loadingCoverage;
      if (coverage) {
        for (const levelKey in coverage) {
          const level = coverage[levelKey];
          for (const xKey in level) {
            const x = level[xKey];
            for (const yKey in x) {
              const y = x[yKey];
              if (!y) {
                needed++;
              }
              total++;
            }
          }
        }
      }

      return {
        needed,
        total,
      };
    }

    calculateExportResolution(baseImage, resolution, bounds) {
      // retrieve base image size
      // const baseImage = this.osdViewer.world.getItemAt(0);
      const baseSize = baseImage.getContentSize();
      let imageSize = { width: baseSize.x, height: baseSize.y };

      // calculate full-res size based on longest side
      //  if we're preserving, we'll pull resolution directly from the current view
      if (resolution < 0 && !bounds) {
        resolution = imageSize.width > imageSize.height ? imageSize.width : imageSize.height;
      }

      // calculate target size
      let ratio = imageSize.width / imageSize.height;
      let targetHeight = resolution;
      let targetWidth = Math.round(targetHeight * ratio);
      if (baseSize.x > baseSize.y) {
        // flip ratio to avoid massive mosaics
        ratio = imageSize.height / imageSize.width;
        targetWidth = resolution;
        targetHeight = Math.round(targetWidth * ratio);
      }

      let imageBounds = null;
      if (bounds) {
        // get bounds within image
        // if bounds are provided as an array the assumed format is [x, y, width, height]
        // if bounds are simply a truthy value then the current bounds of the image are used
        imageBounds = Array.isArray(bounds)
          ? new Rect(bounds[0], bounds[1], bounds[2], bounds[3])
          : baseImage.viewportToImageRectangle(this.osdViewer.viewport.getBounds(true));
        imageBounds.x = Math.max(Math.round(imageBounds.x), 0);
        imageBounds.y = Math.max(Math.round(imageBounds.y), 0);
        imageBounds.width = Math.min(Math.round(imageBounds.width), baseSize.x);
        imageBounds.height = Math.min(Math.round(imageBounds.height), baseSize.y);

        // limit size to base image size
        imageSize = {
          width: Math.min(baseSize.x, imageBounds.width),
          height: Math.min(baseSize.y, imageBounds.height),
        };

        // calculate full-res size based on longest side
        if (resolution < 0) {
          resolution = imageSize.width > imageSize.height ? imageSize.width : imageSize.height;
        }

        // calculate target size
        ratio = imageSize.width / imageSize.height;
        targetHeight = resolution; // reset in case the original image was oriented differently
        targetWidth = Math.round(targetHeight * ratio);
        if (imageSize.width > imageSize.height) {
          // flip ratio to avoid massive mosaics
          ratio = imageSize.height / imageSize.width;
          targetWidth = resolution;
          targetHeight = Math.round(targetWidth * ratio);
        }
      }

      // true if the calculated size is larger than browser limits
      const scale = window.devicePixelRatio;
      const limitExceeded =
        resolution * scale >= MAXIMUM_EDGE_LEN || targetWidth * targetHeight * scale ** 2 > MAXIMUM_AREA;

      return {
        targetWidth,
        targetHeight,
        resolution,
        imageBounds,
        ratio,
        limitExceeded,
      };
    }
  };
