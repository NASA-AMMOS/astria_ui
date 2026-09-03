import config from 'config.js';
import { fabric } from 'fabric';
import * as telemetry from 'src/utils/telemetryUtils';
import { calc2dDistance } from '..';

// NOTE: requires OSDAnnotateMixin(OSDFabricMixin(OSDViewer))

export const OSDAnnotateMixin = (base) =>
  class extends base {
    constructor(options) {
      super(options);

      this._annotationShapes = {};
      this._drawMode = null;
      this._annotatingShape = null;
      this._activeAnnotationId = null;
      this._activeAnnotationOpacity = 1;

      // track path drawing for pen shapes
      this._fabricCanvas.on('path:created', () => {
        if (this._drawMode === config.interaction_modes.draw_pen) {
          this.updatePenShapes(true);
        }
      });

      // handle object opacity
      this.on('annotationadded', (objs) => {
        // allow single object or array of objects
        if (!Array.isArray(objs)) {
          objs = [objs];
        }

        objs.forEach((obj) => {
          const annOpLimit = obj.get('annOpacityLimit');
          obj.set('opacity', annOpLimit);
        });
        this._fabricCanvas.requestRenderAll();
      });

      // Prevent auto focus on OSD canvas after canvas click to keep focus on annotation textarea if present
      const osdViewerClickHandler = this.osdViewer.innerTracker.clickHandler;
      this.osdViewer.innerTracker.clickHandler = (event) => {
        if (document.activeElement.nodeName !== 'TEXTAREA') {
          return osdViewerClickHandler(event);
        }
      };
    }

    getDrawingShapeById(id) {
      return this._annotationShapes[id];
    }

    enableShapeInteractions(enabled, annotationId) {
      if (annotationId && typeof annotationId === 'string') {
        return super.enableShapeInteractions(enabled, (x) => x.get('annotationId') === annotationId);
      }
      return super.enableShapeInteractions(enabled, annotationId);
    }

    startAnnotating(drawMode, annotationId, opacity = 1) {
      this.stopAnnotating();

      this._drawMode = drawMode;
      this.enableShapeInteractions(false);

      // set active annotation id so all newly created shapes use this annotation ID
      this.setActiveAnnotationId(annotationId);

      // set active annotation opacity so all newly created shapes have this opacity limit
      this.setActiveAnnotationOpacity(opacity);

      if (this._drawMode === config.interaction_modes.draw_pen) {
        this.turnOnPenTool();
      }
    }

    stopAnnotating() {
      if (this._drawMode === config.interaction_modes.draw_pen) {
        this.turnOffPenTool();
      }

      // clear shape mid-draw
      this.setDrawingShape(null);
      if (this._annotatingShape) {
        this.removeDrawingShape(this._annotatingShape, false);
      }

      this._drawMode = null;
      this._annotatingShape = null;
    }

    clearShapes() {
      this.stopAnnotating();
      this.removeAllShapes();
    }

    handleClickEvent(event) {
      super.handleClickEvent(event);

      if (this._drawMode) {
        // check that we have a base image
        if (this.osdViewer.world.getItemCount() === 0) {
          return;
        }

        // Retrieve image coordinates and check for validity
        const lsPoint = this.osdToLineSample(event.position.x, event.position.y, false, false);
        if (lsPoint.line < 0 || lsPoint.sample < 0) {
          return;
        }
        switch (this._drawMode) {
          case config.interaction_modes.draw_ellipse:
            this.addEllipseAtPoint(lsPoint);
            break;
          case config.interaction_modes.draw_rect:
            this.addRectangleAtPoint(lsPoint);
            break;
          case config.interaction_modes.draw_line:
            this.addLineAtPoint(lsPoint);
            break;
          case config.interaction_modes.draw_polyline:
            this.addPolylineAtPoint(lsPoint);
            break;
          case config.interaction_modes.draw_polygon:
            this.addPolygonAtPoint(lsPoint);
            break;
          case config.interaction_modes.draw_text:
            this.addTextBoxAtPoint(lsPoint);
            break;
          case config.interaction_modes.draw_pen:
            // do nothing
            break;
          case config.interaction_modes.draw_arrow:
            this.addArrowAtPoint(lsPoint);
            break;
          default:
          // do nothing
          // console.warn('no valid annotation mode');
        }
      }
    }

    updatePenShapes(noSelect = false) {
      // find orphan paths
      const objs = this._fabricCanvas.getObjects();
      const penShapes = objs.filter((x) => typeof x.get('shapeType') === 'undefined' && x.get('type') === 'path');

      penShapes.forEach((shape) => {
        const path = shape.get('path');
        const top = shape.get('top');
        const left = shape.get('left');
        const width = shape.get('width');
        const height = shape.get('height');
        const lsPoint = this.fabricToLineSample(left + width / 2, top + height / 2);
        this._fabricCanvas.remove(shape);
        this.addShape({
          shapeType: 'pen',
          path,
          coords: {
            lsPoint,
          },
          params: {
            annotationId: this._activeAnnotationId,
            annOpacityLimit: this._activeAnnotationOpacity,
            strokeWidth: this._penOptions.strokeWidth,
            color: this._penOptions.color,
            justDrawn: true,
            top,
            left,
            originX: 'left',
            originY: 'top',
          },
        }).then((obj) => {
          if (this._annotationShapes[this._activeAnnotationId]) {
            this._annotationShapes[this._activeAnnotationId].push(obj);
          } else {
            this._annotationShapes[this._activeAnnotationId] = [obj];
          }

          if (!noSelect) {
            this._fabricCanvas.setActiveObject(obj);
          }

          // external callback
          this.dispatch('annotationadded', obj);
        });
      });
    }

    addEllipseAtPoint(lsPoint) {
      this.addShape({
        shapeType: 'ellipse',
        coords: {
          lsPoint,
        },
        params: {
          annotationId: this._activeAnnotationId,
          annOpacityLimit: this._activeAnnotationOpacity,
          radius: 40,
          strokeWidth: 4,
        },
      })
        .then((obj) => {
          if (this._annotationShapes[this._activeAnnotationId]) {
            this._annotationShapes[this._activeAnnotationId].push(obj);
          } else {
            this._annotationShapes[this._activeAnnotationId] = [obj];
          }

          this._fabricCanvas.setActiveObject(obj);

          // external callback
          this.dispatch('annotationadded', obj);
        })
        .catch((err) => {
          throw err;
        });
    }

    addRectangleAtPoint(lsPoint) {
      this.addShape({
        shapeType: 'rectangle',
        params: {
          annotationId: this._activeAnnotationId,
          annOpacityLimit: this._activeAnnotationOpacity,
          width: 150,
          height: 50,
          strokeWidth: 4,
        },
        coords: {
          lsPoint,
        },
      })
        .then((obj) => {
          if (this._annotationShapes[this._activeAnnotationId]) {
            this._annotationShapes[this._activeAnnotationId].push(obj);
          } else {
            this._annotationShapes[this._activeAnnotationId] = [obj];
          }

          this._fabricCanvas.setActiveObject(obj);

          // external callback
          this.dispatch('annotationadded', obj);
        })
        .catch((err) => {
          throw err;
        });
    }

    addLineAtPoint(lsPoint) {
      if (this._annotatingShape) {
        // clear local tracking
        const shape = this._annotatingShape;
        this._annotatingShape = null;

        // clear tracking on fabric canvas
        this.setDrawingShape(null);

        // update the fabric object and activate selection
        const fabricObj = this.getShapeById(shape.shapeId);
        fabricObj._setPositionDimensions({});
        this._fabricCanvas.setActiveObject(fabricObj);

        // external callback
        this.dispatch('annotationadded', fabricObj);
      } else {
        this.addShape({
          shapeType: 'line',
          params: {
            annotationId: this._activeAnnotationId,
            annOpacityLimit: this._activeAnnotationOpacity,
            strokeWidth: 4,
          },
          coords: {
            lsPoint1: lsPoint,
            lsPoint2: lsPoint,
          },
        })
          .then((obj) => {
            this.setDrawingShape(obj);

            if (this._annotationShapes[this._activeAnnotationId]) {
              this._annotationShapes[this._activeAnnotationId].push(obj);
            } else {
              this._annotationShapes[this._activeAnnotationId] = [obj];
            }

            this._annotatingShape = obj;
          })
          .catch((err) => {
            throw err;
          });
      }
    }

    addPolylineAtPoint(lsPoint) {
      const defParams = {
        width: 4,
        stroke: '#FFFE01',
        strokeWidth: 4,
        annotationId: this._activeAnnotationId,
        annOpacityLimit: this._activeAnnotationOpacity,
      };
      if (this._annotatingShape) {
        const shape = this.getShapeById(this._annotatingShape.shapeId);
        const lsPoints = shape.get('lsPoints');

        // check if we're clicking on or near the last point to complete
        const prevLS = lsPoints[lsPoints.length - 2];
        const dist = calc2dDistance(
          this.lineSampleToFabric(lsPoint.line, lsPoint.sample),
          this.lineSampleToFabric(prevLS.line, prevLS.sample)
        );

        if (dist >= 2) {
          // add another segment
          this.extendPolyline(shape, lsPoint);
        } else if (lsPoints.length > 2) {
          // clear local tracking
          const drawingShape = this._annotatingShape;
          this._annotatingShape = null;

          // clear tracking on fabric canvas
          this.setDrawingShape(null);

          // update the fabric object and activate selection
          const fabricObj = this.getShapeById(drawingShape.shapeId);
          fabricObj.points = fabricObj.points.slice(0, fabricObj.points.length - 1);
          fabricObj.lsPoints = fabricObj.lsPoints.slice(0, fabricObj.lsPoints.length - 1);
          fabricObj._setPositionDimensions({});
          this._fabricCanvas.setActiveObject(fabricObj);

          // external callback
          this.dispatch('annotationadded', fabricObj);
        }
      } else {
        this.addShape({
          shapeType: 'polyline',
          params: defParams,
          coords: {
            lsPoints: [lsPoint, lsPoint],
          },
        })
          .then((obj) => {
            this.setDrawingShape(obj);

            if (this._annotationShapes[this._activeAnnotationId]) {
              this._annotationShapes[this._activeAnnotationId].push(obj);
            } else {
              this._annotationShapes[this._activeAnnotationId] = [obj];
            }

            this._annotatingShape = obj;
          })
          .catch((err) => {
            throw err;
          });
      }
    }

    addPolygonAtPoint(lsPoint) {
      const defParams = {
        annotationId: this._activeAnnotationId,
        annOpacityLimit: this._activeAnnotationOpacity,
        strokeWidth: 4,
      };
      if (this._annotatingShape) {
        const shape = this.getShapeById(this._annotatingShape.shapeId);
        const lsPoints = shape.get('lsPoints');

        // check if we're clicking on or near the last point to complete
        const prevLS = lsPoints[lsPoints.length - 2];
        const distPrev = calc2dDistance(
          this.lineSampleToFabric(lsPoint.line, lsPoint.sample),
          this.lineSampleToFabric(prevLS.line, prevLS.sample)
        );

        if (distPrev >= 2) {
          // add another segment
          this.extendPolyline(shape, lsPoint);
        } else if (lsPoints.length > 3) {
          // clear local tracking
          const drawingShape = this._annotatingShape;
          this._annotatingShape = null;

          // clear tracking on fabric canvas
          this.setDrawingShape(null);

          // update the fabric object and activate selection
          const fabricObj = this.getShapeById(drawingShape.shapeId);
          fabricObj.points = fabricObj.points.slice(0, fabricObj.points.length - 1);
          fabricObj.lsPoints = fabricObj.lsPoints.slice(0, fabricObj.lsPoints.length - 1);
          fabricObj._setPositionDimensions({});
          this._fabricCanvas.setActiveObject(fabricObj);

          // external callback
          this.dispatch('annotationadded', fabricObj);
        }
      } else {
        this.addShape({
          shapeType: 'polygon',
          params: defParams,
          coords: {
            lsPoints: [lsPoint, lsPoint],
          },
        })
          .then((obj) => {
            this.setDrawingShape(obj);

            if (this._annotationShapes[this._activeAnnotationId]) {
              this._annotationShapes[this._activeAnnotationId].push(obj);
            } else {
              this._annotationShapes[this._activeAnnotationId] = [obj];
            }

            this._annotatingShape = obj;
          })
          .catch((err) => {
            throw err;
          });
      }
    }

    addTextBoxAtPoint(lsPoint) {
      this.addShape({
        shapeType: 'text-box',
        text: 'text',
        coords: {
          lsPoint,
        },
        params: {
          annotationId: this._activeAnnotationId,
          annOpacityLimit: this._activeAnnotationOpacity,
          fontWeight: '600',
          fontSize: 26,
          fill: '#FFFFFF',
          stroke: 'rgba(0,0,0,0)',
          paintFirst: 'stroke',
          strokeLineJoin: 'round',
          strokeWidth: 4,
        },
      })
        .then((obj) => {
          this._fabricCanvas.setActiveObject(obj);

          if (this._annotationShapes[this._activeAnnotationId]) {
            this._annotationShapes[this._activeAnnotationId].push(obj);
          } else {
            this._annotationShapes[this._activeAnnotationId] = [obj];
          }

          // start editing the text automatically
          obj.selectAll();
          obj.enterEditing();

          // external callback
          this.dispatch('annotationadded', obj);
        })
        .catch((err) => {
          throw err;
        });
    }

    addArrowAtPoint(lsPoint) {
      const defParams = {
        annotationId: this._activeAnnotationId,
        annOpacityLimit: this._activeAnnotationOpacity,
        strokeWidth: 4,
      };
      if (this._annotatingShape) {
        // on second click, turn off arrow drawing

        // fabric doesn't update the object bounds properly
        // so we must forcibly re-create the object
        const shape = this.getShapeById(this._annotatingShape.shapeId);
        const lsPoint1 = shape.get('lsPoint1');
        const lsPoint2 = shape.get('lsPoint2');
        this.removeShape(shape);
        this.addShape({
          shapeType: 'arrow',
          params: defParams,
          coords: {
            lsPoint1,
            lsPoint2,
          },
        })
          .then((obj) => {
            // finish the object and clear the drawing state
            const drawingShape = this._annotatingShape;
            this._annotatingShape = null;

            // update backing dictionary
            this._annotationShapes[obj.get('shapeId')] = obj;

            drawingShape.shapeId = obj.get('shapeId');
            this.setDrawingShape(null);
            this._fabricCanvas.setActiveObject(obj);

            // external callback
            this.dispatch('annotationadded', obj);
          })
          .catch((err) => {
            throw err;
          });
      } else {
        this.addShape({
          shapeType: 'arrow',
          params: defParams,
          coords: {
            lsPoint1: lsPoint,
            lsPoint2: lsPoint,
          },
        })
          .then((obj) => {
            this.setDrawingShape(obj);

            if (this._annotationShapes[this._activeAnnotationId]) {
              this._annotationShapes[this._activeAnnotationId].push(obj);
            } else {
              this._annotationShapes[this._activeAnnotationId] = [obj];
            }

            this._annotatingShape = obj;
          })
          .catch((err) => {
            throw err;
          });
      }
    }

    removeDrawingShape(objOrId, fireCallback = true) {
      const shape = typeof objOrId === 'string' ? this._shapes[objOrId] : objOrId;
      if (shape) {
        const shapeId = shape.get('shapeId');
        const annoId = shape.get('annotationId');
        const annoShape = this._annotationShapes[annoId];
        if (!annoShape) {
          telemetry.logWarning(`Unable to remove: ${objOrId}, shape not found in annotation shapes list.`);
        } else {
          // Remove drawing shape from state if found
          const ind = this._annotationShapes[annoId].findIndex((x) => x.get('shapeId') === shapeId);
          this._annotationShapes[annoId].splice(ind, 1);
        }

        // Remove the drawing shape from fabric
        this.removeShape(shape.shapeId);

        // external callback
        if (fireCallback) {
          this.dispatch('annotationremoved', shape);
        }
      } else telemetry.logWarning(`Unable to remove: ${objOrId}, shape not found.`);
    }

    setActiveAnnotationId(annotationId) {
      this._activeAnnotationId = annotationId;
    }

    setActiveAnnotationOpacity(opacity) {
      this._activeAnnotationOpacity = opacity;
    }

    removeAllShapes() {
      Object.keys(this._annotationShapes).forEach((annoId) => {
        let anno = this._annotationShapes[annoId];
        if (!Array.isArray(anno)) anno = [anno];
        anno.forEach((s) => {
          if (this._shapes[s.get('shapeId')]) this.removeShape(s); // image features sometimes cause double-deletes
        });
      });
      this._annotationShapes = {};
    }

    setAnnotationOpacity(annotationId, opacity) {
      const annotationShapes = this.getAnnotationShapes(annotationId);
      annotationShapes.forEach((shape) => {
        const objOpLimit = shape.get('objOpacityLimit');
        shape.set('annOpacityLimit', opacity);
        shape.set('opacity', opacity * objOpLimit);
      });
      this._fabricCanvas.requestRenderAll();
    }

    addAnnotation(json, annotationId, interactable = false) {
      // Add the objects in the json
      return new Promise((resolve) => {
        Promise.all(json.objects.map((obj) => this.loadObject(obj))).then((fabricObjs) => {
          fabricObjs.forEach((fabricObj) => {
            fabricObj.set('annotationId', annotationId); // ensure they have the correct annotationId set
            fabricObj.set('selectable', interactable);
            fabricObj.set('evented', interactable);
            fabricObj.set('annOpacityLimit', 1);

            // handle annotations that did not store the per object opacity
            if (typeof fabricObj.get('objOpacityLimit') !== 'number') {
              fabricObj.set('objOpacityLimit', 1);
            }
          });
          this.recreateInternalShapeTrackers(json.objects);
          resolve(true);
        });
      });
    }

    removeAnnotation(annotationId) {
      const annotationShapes = this.getAnnotationShapes(annotationId);
      annotationShapes.forEach((shape) => {
        if (this._shapes[shape.get('shapeId')]) {
          this.removeShape(shape);
        }
      });
      this._annotationShapes[annotationId] = null;
      delete this._annotationShapes[annotationId];
    }

    annotationToJSON(annotationId, asString) {
      this.clearSelection(); // clear selection so that shapes have proper `hasControls` value
      const allAnnotations = this._fabricCanvas.toJSON(this._customFabricProperties);
      if (annotationId !== '__ALL__') {
        allAnnotations.objects = allAnnotations.objects.filter((obj) => {
          // special key __NONE__ should implicitly not select any annotation objects
          if (
            annotationId.includes('__DRAWINGS__') &&
            obj.annotationId &&
            !obj.isMeasurement &&
            !obj.isImageFeature &&
            !obj.isTarget &&
            obj.shapeType !== 'controlPoint'
          ) {
            return true;
          }
          if (annotationId.includes('__FEATURES__') && obj.isImageFeature && obj.shapeType !== 'controlPoint') {
            return true;
          }
          if (annotationId.includes('__MEASUREMENTS__') && obj.isMeasurement && obj.shapeType !== 'controlPoint') {
            return true;
          }
          if (annotationId.includes('__TARGETS__') && obj.isTarget && obj.shapeType !== 'controlPoint') {
            return true;
          }
          return obj.annotationId === annotationId && !obj.isMeasurement && obj.shapeType !== 'controlPoint';
        });
      }
      if (asString) return JSON.stringify(allAnnotations);
      return allAnnotations;
    }

    clearSelection() {
      this._fabricCanvas.discardActiveObject().requestRenderAll();
    }

    recreateInternalShapeTrackers(objects) {
      super.recreateInternalShapeTrackers(objects);

      // Recreate shape map and shapeID state from the annotation objects
      objects.forEach((shape) => {
        const shapeId = shape.shapeId;
        this._annotationShapes[shapeId] = this.getShapeById(shapeId);
      });
    }

    generateAnnotationImage(annotationId, targetWidth, targetHeight, scale = 1, ppp = 1, measureScaleAdjust = 1) {
      return new Promise((resolve) => {
        // create a shadow canvas at the target size
        const shadowCanvas = document.createElement('canvas');
        shadowCanvas.width = targetWidth;
        shadowCanvas.height = targetHeight;
        const shadowFabricCanvas = new fabric.Canvas(shadowCanvas);

        // load the annotation shapes onto the canvas
        shadowFabricCanvas.loadFromJSON(this.annotationToJSON(annotationId, false));

        // set zoom and rescale appropriately
        shadowFabricCanvas.setZoom(scale);

        // rescale objects. have to specially handle groups for measurement shapes
        const objects = shadowFabricCanvas.getObjects();
        const groupReset = {};
        let rescaleShapes = [];
        objects.forEach((obj) => {
          if (obj.get('isGroup')) {
            const groupObjs = obj.getObjects();
            groupReset[obj.shapeId] = { group: obj, shapes: groupObjs };
            groupObjs.forEach((o) => obj.removeWithUpdate(o));
            rescaleShapes = rescaleShapes.concat(groupObjs);
            shadowFabricCanvas.remove(obj);
          } else {
            rescaleShapes.push(obj);
          }
        });

        // rescale individual shapes
        rescaleShapes.forEach((obj) => {
          if (obj.get('isMeasurement')) {
            this.rescaleShape(obj, measureScaleAdjust, ppp);
          } else {
            this.rescaleShape(obj, scale, ppp);
          }
        });

        // recreate groupings
        const groupIds = Object.keys(groupReset);
        groupIds.forEach((shapeId) => {
          const groupInfo = groupReset[shapeId];
          const { group, shapes } = groupInfo;
          shapes.forEach((shape) => group.addWithUpdate(shape));
          shadowFabricCanvas.add(group);
        });

        shadowFabricCanvas.renderAll();
        window.requestAnimationFrame(() => {
          resolve(shadowFabricCanvas.toCanvasElement()); // at a high resolution, this can be too massive for an image element
        });
      });
    }

    generateAnnotationImageDirect() {
      return new Promise((resolve) => {
        this._fabricCanvas.renderAll();
        window.requestAnimationFrame(() => {
          resolve(this._fabricCanvas.toCanvasElement()); // at a high resolution, this can be too massive for an image element
        });
      });
    }

    getAnnotationText(annotationId) {
      const annotationShapes = this.getAnnotationShapes(annotationId);
      const textArr = annotationShapes.reduce((acc, shape) => {
        const text = shape.get('text');
        if (text) {
          acc.push(text.replace(/(?:\r\n|\r|\n)/g, ' ')); // remove line breaks
        }
        return acc;
      }, []);

      return textArr.join(' ');
    }

    getAnnotationShapes(annotationId) {
      const objs = this._fabricCanvas.getObjects();
      return objs.filter((x) => x.get('annotationId') === annotationId);
    }

    zoomToAnnotation(annotationId) {
      const bounds = this.getAnnotationBounds(annotationId);
      this.zoomToBounds(bounds);
    }

    getAnnotationBounds(annotationId) {
      const objs = this.getAnnotationShapes(annotationId);
      if (objs) {
        return this.getFabricObjectBounds(objs);
      }
      return false;
    }
  };
