import { fabric } from 'fabric';
import * as telemetry from 'src/utils/telemetryUtils';

import config from 'config.js';
import { getPropFromProduct } from '../sharedUtils';
// NOTE: requires OSDFootprintsMixin(OSDFabricMixin(OSDViewer))

export const OSDFootprintsMixin = (base) =>
  class extends base {
    constructor(options) {
      super(options);

      this._activeFootprints = [];
      this._allowInteractions = false;
      this._footprints = {};
      this._filterFn = () => true;

      this.defaultStrokeWidth = 1;
      this.defaultFill = 'rgba(0,0,0,0.01)';
      this.highlightStroke = '#4FA1FF';
      this.highlightFill = 'rgba(79, 161, 255, 0.2)';
      this.selectionStroke = '#4FA1FF';
      this.selectionFill = 'rgba(79, 161, 255, 0.4)';

      this._fabricCanvas.on('mouse:over', (event) => {
        const shape = event.target;
        if (shape && !this.isFootprintActive(shape)) {
          const matchingFootprints = this.getAllFootprintsForFilename(
            getPropFromProduct(shape, config.es_mappings.filename)
          );
          matchingFootprints.forEach((footprint) => this.setFootprintHighlightStyle(footprint.fabricObjs[0]));
        }
      });
      this._fabricCanvas.on('mouse:out', (event) => {
        const shape = event.target;
        if (shape && !this.isFootprintActive(shape)) {
          const matchingFootprints = this.getAllFootprintsForFilename(
            getPropFromProduct(shape, config.es_mappings.filename)
          );
          matchingFootprints.forEach((footprint) => this.unsetFootprintHighlightStyle(footprint.fabricObjs[0]));
        }
      });

      // Differentiate between drag and click
      const delta = 6;
      let startX;
      let startY;

      this._fabricCanvas.on('mouse:down', (event) => {
        if (event.e.ctrlKey) return;
        startX = event.e.pageX;
        startY = event.e.pageY;
      });

      this._fabricCanvas.on('mouse:up', (event) => {
        if (event.e.ctrlKey) return;
        const diffX = Math.abs(event.e.pageX - startX);
        const diffY = Math.abs(event.e.pageY - startY);

        if (diffX < delta && diffY < delta) {
          const shape = event.target;
          this.clearActiveFootprintStyles();
          if (shape) {
            this.setSelectedFootprintForFilename(getPropFromProduct(shape, config.es_mappings.filename));
            this.dispatch('footprintselected', shape);
          }
        }
      });
    }

    setSelectedFootprintForFilename(filename) {
      // Look for other instances of the footprint's source image in case of wraparound
      const matchingFootprints = this.getAllFootprintsForFilename(filename);
      matchingFootprints.forEach((footprint) => this.setActiveFootprintStyle(footprint.fabricObjs[0]));
      this._fabricCanvas.requestRenderAll();
    }

    getImageSizeInFabric() {
      const baseImage = this.osdViewer.world.getItemAt(0) || this.osdViewer.viewport;
      if (!baseImage || !baseImage.source) return { width: 0, heigth: 0 };
      const samples = baseImage.source.width;
      const lines = baseImage.source.height;
      return this.lineSampleToFabric(lines, samples);
    }

    getClipPath(footprintBounds) {
      const { x, y } = this.getImageSizeInFabric();
      const shouldClip =
        footprintBounds.line[0] < 0 ||
        footprintBounds.sample[0] < 0 ||
        footprintBounds.line[1] > y ||
        footprintBounds.sample[1] > x;
      if (shouldClip) {
        const left = Math.max(footprintBounds.sample[0], 0);
        const top = Math.max(footprintBounds.line[0], 0);
        const footprintWidth = footprintBounds.sample[1] - footprintBounds.sample[0];
        const footprintHeight = footprintBounds.line[1] - footprintBounds.line[0];
        const extraWidth = footprintWidth - (x - left);
        const extraHeight = footprintHeight - (y - top);
        const width = Math.min(footprintWidth - extraWidth, x);
        const height = Math.min(footprintHeight - extraHeight, y);

        const clipRect = new fabric.Rect({
          originX: 'left',
          originY: 'top',
          left,
          top,
          width,
          height,
          absolutePositioned: true,
        });
        return clipRect;
      } else {
        return;
      }
    }

    getAllFootprintsForFilename(filename) {
      return Object.values(this._footprints).filter((footprint) => {
        return getPropFromProduct(footprint, config.es_mappings.filename) === filename;
      });
    }

    isFootprintActive(footprint) {
      return !!this._activeFootprints.find((f) => f.footprintId === footprint.footprintId);
    }

    setActiveFootprintStyle(footprint) {
      footprint.set('prevStroke', footprint.stroke);
      footprint.set('prevFill', footprint.fill);
      footprint.set('stroke', this.selectionStroke);
      footprint.set('fill', this.selectionFill);
      this._activeFootprints.push(footprint);
    }

    clearActiveFootprintStyles(notify = true) {
      this._activeFootprints.forEach((footprint) => {
        footprint.set('stroke', footprint.color);
        footprint.set('fill', this.defaultFill);
      });
      this._activeFootprints = [];
      this._fabricCanvas.requestRenderAll();
      if (notify) this.dispatch('footprintdeselected');
    }

    setFootprintHighlightStyleByOCSName(ocs_name, highlight) {
      const matchingFootprints = this.getAllFootprintsForFilename(ocs_name);
      matchingFootprints.forEach((f) => {
        const footprint = f.fabricObjs[0];
        if (highlight) this.setFootprintHighlightStyle(footprint);
        else this.unsetFootprintHighlightStyle(footprint);
      });
    }

    setFootprintHighlightStyle(footprint) {
      footprint.set('prevStroke', footprint.stroke);
      footprint.set('prevFill', footprint.fill);
      footprint.set('stroke', this.highlightStroke);
      footprint.set('fill', this.highlightFill);
      this._fabricCanvas.requestRenderAll();
    }

    unsetFootprintHighlightStyle(footprint) {
      footprint.set('stroke', footprint.prevStroke);
      footprint.set('fill', footprint.prevFill);
      this._fabricCanvas.requestRenderAll();
    }

    zoomToFootprintByOCSName(ocs_name, footprints) {
      const matchingFootprints = Object.values(footprints).filter((footprint) => {
        return getPropFromProduct(footprint, config.es_mappings.filename) === ocs_name;
      });

      this.zoomToFootprint(matchingFootprints);
    }

    zoomToFootprint(footprint) {
      const bounds = this.getFootprintBounds(footprint);
      this.zoomToBounds(bounds);
    }

    getFootprintBounds(footprint) {
      if (!Array.isArray(footprint)) {
        footprint = [footprint];
      }

      // Find the max bounds of all the footprint bounds
      let minX = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      footprint.forEach((obj) => {
        const bounds = obj.bounds;
        if (bounds.sample[0] < minX) {
          minX = bounds.sample[0];
        }
        if (bounds.line[0] < minY) {
          minY = bounds.line[0];
        }
        if (bounds.sample[1] > maxX) {
          maxX = bounds.sample[1];
        }
        if (bounds.line[1] > maxY) {
          maxY = bounds.line[1];
        }
      });

      const { x, y } = this.getImageSizeInFabric();
      minX = Math.max(minX, 0);
      maxX = Math.min(maxX, x);
      minY = Math.max(minY, 0);
      maxY = Math.min(maxY, y);

      const topLeft = this.fabricToLineSample(minX, minY);
      const bottomRight = this.fabricToLineSample(maxX, maxY);

      return { topLeft, bottomRight };
    }

    enableFootprintInteractions(enabled) {
      const footprintIds = Object.keys(this._footprints);
      footprintIds.forEach((footprintId) => {
        const footprint = this._footprints[footprintId];
        if (footprint) {
          footprint.fabricObjs.forEach((obj) => {
            obj.set('evented', enabled);
          });
        }
      });

      if (!enabled) {
        this.clearActiveFootprintStyles();
      }
    }

    getFootprintId() {
      return this.getShapeId();
    }

    getFootprintsById(id) {
      return this._footprints[id];
    }

    clearFootprints() {
      const footprintIds = Object.keys(this._footprints);
      footprintIds.forEach((footprintId) => {
        this.removeFootprint(footprintId);
      });
    }

    addFootprint(options) {
      return new Promise((resolve, reject) => {
        const { polygon, instrument_id, vicar_label, color, ocs_name, bounds } = options;
        const footprintId = this.getFootprintId();
        const clipPath = this.getClipPath(bounds);

        if (polygon) {
          const promArr = [];
          // main shape

          promArr.push(
            this.addShape({
              shapeType: 'polygon',
              params: {
                disableShapeEdit: true,
                lockMovementX: true,
                lockMovementY: true,
                evented: true,
                selectable: false,
                stroke: color,
                strokeWidth: 1,
                fill: this.defaultFill,
                footprintId,
                visible: this._filterFn({ instrument_id, vicar_label }),
                instrument_id,
                vicar_label,
                color,
                ocs_name,
                bounds,
                clipPath,
              },
              coords: {
                lsPoints: polygon,
              },
              scaleInfo: {
                scaleType: 'scale',
                targetSize: {
                  strokeWidth: this.defaultStrokeWidth,
                },
              },
            })
          );

          Promise.all(promArr)
            .then((objs) => {
              // store the footprint
              const footprint = {
                footprintId,
                fabricObjs: objs,
                polygon,
                ocs_name,
                instrument_id,
                vicar_label,
                color,
                bounds,
              };
              this._footprints[footprintId] = footprint;

              // external callback
              this.dispatch('footprintadded', footprint);
              resolve(footprint);
            })
            .catch((err) => {
              throw err;
            });
        } else {
          reject(new Error('No footprint specified'));
        }
      });
    }

    async addFootprints(footprints) {
      // Add footprints
      await Promise.all(
        footprints.map((footprint) => {
          return this.addFootprint(footprint);
        })
      );

      this._fabricCanvas.requestRenderAll();
    }

    removeFootprint(footprintOrId) {
      const footprint = typeof footprintOrId === 'string' ? this._footprints[footprintOrId] : footprintOrId;
      if (footprint) {
        if (footprint._abortController) footprint._abortController.abort();
        footprint.fabricObjs.forEach((id) => this.removeShape(id));
        delete this._footprints[footprint.footprintId];

        this.dispatch('footprintremoved', footprint);
      } else {
        telemetry.logWarning('Could not remove footprint');
      }
    }

    filterFootprints(filterFn) {
      this._filterFn = filterFn;
      Object.values(this._footprints).forEach((footprint) => {
        footprint.fabricObjs[0].visible = filterFn(footprint);
      });
      this._fabricCanvas.requestRenderAll();
    }
  };
