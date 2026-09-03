import * as telemetry from 'src/utils/telemetryUtils';

import config from 'config.js';
// NOTE: requires OSDTargetMixin(OSDFabricMixin(OSDViewer))

export const OSDTargetMixin = (base) =>
  class extends base {
    constructor(options) {
      super(options);

      this._targetClickTarget = null;
      this._targetHoverTargetId = null;
      this._activeTargetId = null;
      this._targets = {};

      // add listener for the end of editing
      this._fabricCanvas.on('mouse:down', (event) => {
        const shape = event.target;
        if (!shape && this._viewMode === config.interaction_modes.view_only && this._targetClickTarget) {
          const targetId = this._targetClickTarget.targetId;
          this._targetClickTarget = null;
          this.dispatch('targetdeselected', targetId);
        }
      });
    }

    getTargetId() {
      return this.getShapeId();
    }

    getTargetById(id) {
      return this._targets[id];
    }

    clearTargets() {
      const targetIds = Object.keys(this._targets);
      targetIds.forEach((targetId) => {
        this.removeTarget(targetId);
      });
    }

    addTarget(options) {
      return new Promise((resolve, reject) => {
        const { line, sample, id, text, opacity /* accurate */ } = options;

        // If target already exists skip adding it
        const existingTarget = this._targets[id];
        if (existingTarget) {
          resolve(existingTarget);
          return;
        }

        const targetId = id || this.getTargetId();
        options.id = targetId;

        // get fabric location for the target
        const point = this.lineSampleToFabric(line, sample);

        // calculate the mid point for label position
        const { labelPosition, labelPositionLS } = this.getTargetLabelPosition(point);

        // array of the shape promises
        const promises = [];

        // TODO - try using alternate symbol for more accurate targets
        // if (accurate) {
        //   promises.push(...this.addCrosshairTarget(options));
        // } else {
        //   promises.push(...this.addRingTarget(options));
        // }
        promises.push(...this.addRingTarget(options));

        // label wrapper
        promises.push(
          this.addShape({
            shapeType: 'rectangle',
            coords: {
              lsPoint: labelPositionLS,
            },
            params: {
              width: 24,
              height: 28,
              rx: 4,
              ry: 4,
              stroke: null,
              fill: 'rgba(0, 0, 0, 0.48)',
              originX: 'center',
              originY: 'center',
              opacity,
              hoverCursor: 'pointer',
              targetId,
              isTarget: true,
              perPixelTargetFind: false,
              disableShapeEdit: true,
              noSelectionEvent: false,
              hasControls: false,
              selectable: false,
            },
            scaleInfo: {
              scaleType: 'scale',
              targetSize: {
                width: 24,
                height: 28,
                cornerRadius: 4,
              },
            },
          })
        );

        // label
        promises.push(
          this.addShape({
            shapeType: 'text',
            text: text || '',
            coords: {
              lsPoint: labelPositionLS,
            },
            params: {
              top: labelPosition.y,
              left: labelPosition.x,
              fill: 'rgba(248, 248, 248, 1)',
              textAlign: 'center',
              originX: 'center',
              originY: 'center',
              fontWeight: '600',
              fontSize: 12,
              charSpacing: 30,
              opacity,
              hoverCursor: 'pointer',
              targetId,
              isTarget: true,
              perPixelTargetFind: false,
              disableShapeEdit: true,
              noSelectionEvent: true,
              hasControls: false,
              selectable: false,
              activeStyles: {
                fill: 'rgba(255, 221, 92, 1)',
              },
              resetStyles: {
                fill: 'rgba(248, 248, 248, 1)',
              },
            },
            scaleInfo: {
              scaleType: 'scale',
              onScale: (obj) => this.repositionTargetLabel(obj),
              targetSize: {
                fontSize: 12,
              },
            },
          })
        );

        Promise.all(promises)
          .then((objs) => {
            // resize the wrapper with the text
            requestAnimationFrame(() => {
              const textObj = objs.find((obj) => obj.get('shapeType') === 'text');
              const wrapperObj = objs.find((obj) => obj.get('shapeType') === 'rectangle');
              const { zoom } = this.getScaleFactor();
              const textWidth = textObj.getScaledWidth() * zoom;
              wrapperObj.targetSize.width = textWidth + 12;
              this.rescaleShape(wrapperObj);
              this.repositionTargetLabel(textObj);
              this._fabricCanvas.requestRenderAll();
            });

            // this.groupShapes(objs, {
            //   lsPoint: { line, sample },
            //   disableShapeEdit: true,
            //   noSelectionEvent: true,
            //   hasControls: false,
            //   selectable: false,
            // }).then(group => {});

            // add mouse listeners for each object
            objs.forEach((obj) => {
              obj.on('mousedown', (e) => {
                if (this._viewMode === config.interaction_modes.view_only) {
                  if (this._targetClickTarget) {
                    this.dispatch('targetdeselected', this._targetClickTarget.targetId);
                  }
                  this._targetClickTarget = { targetId: obj.get('targetId'), x: e.pointer.x, y: e.pointer.y };
                }
              });
              obj.on('mouseup', (e) => {
                if (
                  this._targetClickTarget &&
                  this._targetClickTarget.targetId === obj.get('targetId') &&
                  this._targetClickTarget.x === e.pointer.x &&
                  this._targetClickTarget.y === e.pointer.y &&
                  this._viewMode === config.interaction_modes.view_only
                ) {
                  this.dispatch('targetselected', obj.get('targetId'));
                }
              });
              obj.on('mouseover', () => {
                if (this._viewMode === config.interaction_modes.view_only) {
                  if (this._targetHoverTargetId) {
                    if (this._targetHoverTargetId !== obj.get('targetId')) {
                      this.resetTargetStyle(this._targetHoverTargetId);
                      this._targetHoverTargetId = obj.get('targetId');
                      this.setTargetActiveStyle(this._targetHoverTargetId);
                    }
                  } else {
                    this._targetHoverTargetId = obj.get('targetId');
                    this.setTargetActiveStyle(this._targetHoverTargetId);
                  }
                }
              });
              obj.on('mouseout', (event) => {
                if (this._viewMode === config.interaction_modes.view_only && !event.nextTarget) {
                  this.resetTargetStyle(obj.get('targetId'));
                  this._targetHoverTargetId = null;
                }
              });
            });

            // store the target
            const target = { targetId, text, fabricObjs: objs, lsPoint: { line, sample } };
            this._targets[targetId] = target;
            this.dispatch('targetadded', target);
            resolve(target);
          })
          .catch((err) => {
            reject(err);
          });
      });
    }

    addCrosshairTarget(options) {
      const { line, sample, opacity, id } = options;

      // array of the shape promises
      const promises = [];

      // inner ring
      promises.push(
        this.addShape({
          shapeType: 'ellipse',
          params: {
            fill: null,
            stroke: 'rgba(255, 10, 10, 1)',
            strokeWidth: 2,
            radius: 8,
            opacity,
            hoverCursor: 'pointer',
            disableShapeEdit: true,
            noSelectionEvent: true,
            hasControls: false,
            selectable: false,
            targetId: id,
            isTarget: true,
          },
          coords: {
            lsPoint: { line, sample },
          },
          scaleInfo: {
            scaleType: 'scale',
            targetSize: {
              radius: 8,
              strokeWidth: 2,
            },
          },
        })
      );

      return promises;
    }

    addRingTarget(options) {
      const { line, sample, opacity, id } = options;

      // array of the shape promises
      const promises = [];

      // inner ring
      promises.push(
        this.addShape({
          shapeType: 'ellipse',
          params: {
            fill: null,
            stroke: 'rgba(140, 194, 255, 1)',
            strokeWidth: 2,
            radius: 8,
            opacity,
            hoverCursor: 'pointer',
            disableShapeEdit: true,
            noSelectionEvent: true,
            hasControls: false,
            selectable: false,
            perPixelTargetFind: false,
            targetId: id,
            isTarget: true,
            activeStyles: {
              stroke: 'rgba(255, 221, 92, 1)',
            },
            resetStyles: {
              stroke: 'rgba(140, 194, 255, 1)',
            },
          },
          coords: {
            lsPoint: { line, sample },
          },
          scaleInfo: {
            scaleType: 'scale',
            targetSize: {
              radius: 8,
              strokeWidth: 2,
            },
          },
        })
      );

      // outer ring
      promises.push(
        this.addShape({
          shapeType: 'ellipse',
          params: {
            fill: null,
            stroke: 'rgba(140, 194, 255, 0.5)',
            strokeWidth: 2,
            radius: 10,
            opacity,
            hoverCursor: 'pointer',
            disableShapeEdit: true,
            noSelectionEvent: true,
            hasControls: false,
            selectable: false,
            perPixelTargetFind: false,
            targetId: id,
            isTarget: true,
            activeStyles: {
              stroke: 'rgba(255, 221, 92, 0.5)',
            },
            resetStyles: {
              stroke: 'rgba(140, 194, 255, 0.5)',
            },
          },
          coords: {
            lsPoint: { line, sample },
          },
          scaleInfo: {
            scaleType: 'scale',
            targetSize: {
              radius: 10,
              strokeWidth: 2,
            },
          },
        })
      );

      return promises;
    }

    removeTarget(targetOrId) {
      const target = typeof targetOrId === 'string' ? this._targets[targetOrId] : targetOrId;
      if (target) {
        target.fabricObjs.forEach((id) => this.removeShape(id));
        delete this._targets[target.targetId];

        this.dispatch('targetremoved', target);
      } else {
        telemetry.logWarning('Could not remove target');
      }
    }

    zoomToTarget(targetOrId) {
      const target = typeof targetOrId === 'string' ? this._targets[targetOrId] : targetOrId;
      if (target) {
        const { lsPoint } = target;
        this.zoomToLineSample(lsPoint);
      }
    }

    setTargetActive(targetId) {
      if (this._activeTargetId) {
        this.deactivateTarget();
      }
      this._activeTargetId = targetId;
      this.setTargetActiveStyle(targetId);
      this.bringTargetToFront(targetId);
    }

    deactivateTarget() {
      const tmpId = this._activeTargetId;
      this._activeTargetId = null;
      if (tmpId) {
        this.resetTargetStyle(tmpId);
      }
    }

    bringTargetToFront(targetId) {
      const target = this._targets[targetId];
      if (target) {
        target.fabricObjs.forEach((obj) => {
          obj.canvas.bringToFront(obj);
        });
        this._fabricCanvas.requestRenderAll();
      }
    }

    setTargetActiveStyle(targetId) {
      const target = this._targets[targetId];
      if (target) {
        target.fabricObjs.forEach((obj) => {
          const styles = obj.get('activeStyles');
          if (styles) {
            const keys = Object.keys(styles);
            keys.forEach((key) => {
              obj.set(key, styles[key]);
            });
          }
        });
        this._fabricCanvas.requestRenderAll();
      }
    }

    resetTargetStyle(targetId) {
      const target = this._targets[targetId];
      if (target && targetId !== this._activeTargetId) {
        target.fabricObjs.forEach((obj) => {
          const styles = obj.get('resetStyles');
          if (styles) {
            const keys = Object.keys(styles);
            keys.forEach((key) => {
              obj.set(key, styles[key]);
            });
          }
        });
        this._fabricCanvas.requestRenderAll();
      }
    }

    setTargetsOpacity(targetIds, opacity) {
      targetIds.forEach((targetId) => {
        const target = this._targets[targetId];
        if (target && targetId !== this._activeTargetId) {
          target.fabricObjs.forEach((obj) => {
            obj.set('opacity', opacity);
          });
        }
      });
      this._fabricCanvas.requestRenderAll();
    }

    getTargetLabelPosition(point) {
      const { zoom } = this.getScaleFactor();
      const offsetDist = 30 / zoom; // pixel distance scaled by current zoom level

      // position label directly above the target
      const x = point.x;
      const y = point.y - offsetDist;

      const labelPosition = { x, y };
      const labelPositionLS = this.fabricToLineSample(x, y);
      return { labelPosition, labelPositionLS };
    }

    repositionTargetLabel(textObj) {
      const targetId = textObj.get('targetId');
      if (this._targets[targetId]) {
        const target = this._targets[targetId];
        const { lsPoint } = target;
        if (lsPoint) {
          // update the label position
          const point = this.lineSampleToFabric(lsPoint.line, lsPoint.sample);
          const { labelPosition, labelPositionLS } = this.getTargetLabelPosition(point);
          textObj.top = labelPosition.y;
          textObj.left = labelPosition.x;
          textObj.originX = 'center';
          textObj.originY = 'center';
          textObj.set('lsPoint', labelPositionLS);
          textObj.calcACoords();

          // reposition the wrapper as well
          const wrapperObj = target.fabricObjs.find((obj) => obj.get('shapeType') === 'rectangle');
          wrapperObj.top = labelPosition.y;
          wrapperObj.left = labelPosition.x;
          wrapperObj.originX = 'center';
          wrapperObj.originY = 'center';
          wrapperObj.set('lsPoint', labelPositionLS);
          wrapperObj.calcACoords();
        }
      }
    }
  };
