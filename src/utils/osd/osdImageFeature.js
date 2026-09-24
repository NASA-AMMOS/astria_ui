import { fabric } from 'fabric';
import inside from 'point-in-polygon-hao';
import { angleBetween, calc2dDistance, deg2rad, parseWKTString } from 'src/utils';

import { getConfig } from 'src/utils/configRegistry';
// NOTE: requires OSDImageFeatureMixin(OSDExportMixin(OSDFabricMixin(OSDViewer)))

const COLOR_LOW_CONFIDECE = '#FF5252';
const COLOR_MEDIUM_CONFIDECE = '#FAFF18';
const COLOR_HIGH_CONFIDECE = '#5EFF50';
const DEFAULT_FEATURE_LABEL = 'Image Feature';

export const OSDImageFeatureMixin = (base) =>
  class extends base {
    constructor(options) {
      super(options);
      const config = getConfig();

      this._imageFeatures = {};
      this._activeFeatureLabel = DEFAULT_FEATURE_LABEL;
      this._activeFeatureConfidenceLevel = config.image_feature_confidence_levels.low;
      this._nextFeatureId = false;

      this.on('shaperemoved', (shape) => {
        if (shape.get('isImageFeaturePrimaryPolygon')) {
          const shapeId = shape.get('shapeId');
          const featureId = shape.get('imageFeatureId');
          const annotationId = shape.get('annotationId');

          // remove the other shapes from the display
          let features = this._imageFeatures[featureId];
          if (features) {
            features.forEach((featureShape) => {
              if (featureShape.get('shapeId') !== shapeId && this._shapes[featureShape.get('shapeId')]) {
                this.removeShape(featureShape);
              }
            });
          }

          // clear the image feature tracking
          this._imageFeatures[featureId] = null;
          delete this._imageFeatures[featureId];

          // clear the annotation tracking
          const annoShapes = this._annotationShapes[annotationId];
          if (annoShapes) {
            this._annotationShapes[annotationId] = annoShapes.filter((x) => x.get('imageFeatureId') !== featureId);
          }

          // fire event
          this.dispatch('imagefeatureremoved', featureId);
        }
      });
    }

    setActiveFeatureConfidenceLevel(level) {
      this._activeFeatureConfidenceLevel = level;
    }

    resetActiveFeatureConfidenceLevel() {
      this._activeFeatureConfidenceLevel = this._activeFeatureConfidenceLevel =
        getConfig().image_feature_confidence_levels.low;
    }

    setActiveFeatureLabel(label) {
      this._activeFeatureLabel = label;
    }

    resetActiveFeatureLabel() {
      this._activeFeatureLabel = DEFAULT_FEATURE_LABEL;
    }

    handleClickEvent(event) {
      const config = getConfig();
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
        if (this._drawMode === config.interaction_modes.draw_image_feature) {
          this.addImageFeatureAtPoint(lsPoint, this._activeFeatureLabel, this._activeFeatureConfidenceLevel);
        }
      }
    }

    addImageFeatureAtPoint(lsPoint, label = 'Feature Type', confidenceLevel = null) {
      const config = getConfig();
      if (confidenceLevel === null) confidenceLevel = config.image_feature_confidence_levels.low;
      if (this._drawingShape) {
        const polygon = this._drawingShape; // polygon
        const lsPoints = polygon.get('lsPoints');

        // check if we're clicking on or near the last point to complete
        const prevLS = lsPoints[lsPoints.length - 2];
        const distPrev = calc2dDistance(
          this.lineSampleToFabric(lsPoint.line, lsPoint.sample),
          this.lineSampleToFabric(prevLS.line, prevLS.sample)
        );

        if (distPrev >= 2) {
          // add another segment
          this.extendPolyline(polygon, lsPoint);
        } else if (lsPoints.length > 3) {
          // clear local tracking
          this._annotatingShape = null;

          // clear tracking on fabric canvas
          this.setDrawingShape(null);

          // update the fabric object and activate selection
          const fabricObj = this.getShapeById(polygon.shapeId);
          fabricObj.points = fabricObj.points.slice(0, fabricObj.points.length - 1);
          fabricObj.lsPoints = fabricObj.lsPoints.slice(0, fabricObj.lsPoints.length - 1);
          fabricObj._setPositionDimensions({});
          this._fabricCanvas.setActiveObject(fabricObj);

          this.unhighlightFeature(fabricObj.get('imageFeatureId'));
          this.rescaleRenderedShapes();

          // external callback
          this.dispatch('annotationadded', this._annotationShapes[fabricObj.get('annotationId')]);
          this.dispatch('imagefeatureadded', this._imageFeatures[fabricObj.get('imageFeatureId')]);
        }
      } else {
        const newFeatureId = this.getFeatureId();
        const defParams = {
          isImageFeature: true,
          imageFeatureId: newFeatureId,
          annotationId: this._activeAnnotationId,
          annOpacityLimit: this._activeAnnotationOpacity,
        };

        const point = this.lineSampleToFabric(lsPoint.line, lsPoint.sample);
        const { labelPosition, labelPositionLS, labelAngle } = this.getImageFeatureLabelPosition([point]);

        const promArr = [];

        // outline shape
        promArr.push(
          this.addShape({
            shapeType: 'polygon',
            params: {
              ...defParams,
              fill: undefined,
              stroke: '#000000',
              strokeWidth: 6,
              isImageFeaturePolygon: true,
              isImageFeatureSecondaryPolygon: true,
              disableShapeEdit: true,
              noSelectionEvent: true,
              hasControls: false,
              selectable: false,
              evented: false,
            },
            scaleInfo: {
              scaleType: 'scale',
              targetSize: { strokeWidth: 6 },
            },
            coords: {
              lsPoints: [lsPoint, lsPoint],
            },
          })
        );

        // main shape
        promArr.push(
          this.addShape({
            shapeType: 'polygon',
            params: {
              ...defParams,
              fill: undefined,
              stroke: '#ffffff',
              isImageFeaturePolygon: true,
              isImageFeaturePrimaryPolygon: true,
              onEdit: (shape) => this.handleFeatureEdit(shape),
            },
            scaleInfo: {
              scaleType: 'scale',
              targetSize: { strokeWidth: 2 },
            },
            coords: {
              lsPoints: [lsPoint, lsPoint],
            },
          })
        );

        // text background
        promArr.push(
          this.addShape({
            shapeType: 'rectangle',
            coords: {
              lsPoint: labelPositionLS,
            },
            params: {
              ...defParams,
              fill: '#000000',
              height: 18,
              width: 18,
              rx: 2,
              ry: 2,
              originX: 'center',
              originY: 'center',
              stroke: '#000000', // we use the stroke to provide scaled padding around the text
              strokeWidth: 8,
              paintFirst: 'stroke',
              angle: labelAngle,
              isImageFeatureTextWrapper: true,
              disableShapeEdit: true,
              noSelectionEvent: true,
              hasControls: false,
              selectable: false,
              evented: false,
              onScale: (obj) => this.handleFeatureEdit(obj),
            },
            scaleInfo: {
              scaleType: 'scale',
              targetSize: { height: 18, width: 18, strokeWidth: 8, cornerRadius: 2 },
            },
          })
        );

        // text
        promArr.push(
          this.addShape({
            shapeType: 'text',
            text: label,
            coords: {
              lsPoint: labelPositionLS,
            },
            params: {
              ...defParams,
              top: labelPosition.y,
              left: labelPosition.x,
              fill: 'white',
              textAlign: 'center',
              originX: 'center',
              originY: 'center',
              fontWeight: '600',
              fontSize: 12,
              charSpacing: 50,
              angle: labelAngle,
              isImageFeatureText: true,
              disableShapeEdit: true,
              noSelectionEvent: true,
              hasControls: false,
              selectable: false,
              evented: false,
              // onScale: (obj) => this.handleFeatureEdit(obj),
            },
            scaleInfo: {
              scaleType: 'scale',
              targetSize: {
                fontSize: 12,
              },
            },
          })
        );

        Promise.all(promArr)
          .then((objs) => {
            const polyShape = objs.find((x) => x.get('isImageFeaturePrimaryPolygon'));

            this._imageFeatures[newFeatureId] = objs;

            this.setDrawingShape(polyShape);
            if (this._annotationShapes[this._activeAnnotationId]) {
              this._annotationShapes[this._activeAnnotationId] =
                this._annotationShapes[this._activeAnnotationId].concat(objs);
            } else {
              this._annotationShapes[this._activeAnnotationId] = objs;
            }
            this._annotatingShape = polyShape;

            this.setFeatureConfidenceLevel(newFeatureId, confidenceLevel);
            this.handleFeatureEdit(polyShape);
            this.unhighlightFeature(newFeatureId);
          })
          .catch((err) => {
            throw err;
          });
      }
    }

    updateDrawingShape(event) {
      super.updateDrawingShape(event);

      // update the measurement text during pre-placement
      if (this._drawingShape.get('isImageFeature')) {
        this.handleFeatureEdit(this._drawingShape);
      }
    }

    handleFeatureEdit(shape) {
      if (shape && shape.get('imageFeatureId')) {
        const imageFeatureId = shape.get('imageFeatureId');
        const featureShapes = this._imageFeatures[imageFeatureId];
        if (featureShapes) {
          const primaryPolygon = featureShapes.find((x) => x.get('isImageFeaturePrimaryPolygon'));
          const secondaryPolygon = featureShapes.find((x) => x.get('isImageFeatureSecondaryPolygon'));
          const text = featureShapes.find((x) => x.get('isImageFeatureText'));
          const textWrapper = featureShapes.find((x) => x.get('isImageFeatureTextWrapper'));

          // calculate the current polygon transforms
          const matrix = primaryPolygon.calcTransformMatrix();
          const transformedPoints = primaryPolygon
            .get('points')
            .map(function (p) {
              return new fabric.Point(p.x - primaryPolygon.pathOffset.x, p.y - primaryPolygon.pathOffset.y);
            })
            .map(function (p) {
              return fabric.util.transformPoint(p, matrix);
            });

          // duplicate the points into the secondary polygon
          secondaryPolygon.set('points', [...transformedPoints]);
          secondaryPolygon.setCoords();
          if (secondaryPolygon._setPositionDimensions) {
            secondaryPolygon._setPositionDimensions({});
          }

          // calculate the label position
          const textWidthScaled = text.getScaledWidth();
          const { labelPosition, labelPositionLS, labelAngle } = this.getImageFeatureLabelPosition(
            transformedPoints,
            textWidthScaled
          );

          // set the text positions
          text.angle = labelAngle;
          text.top = labelPosition.y;
          text.left = labelPosition.x;
          text.originX = 'center';
          text.originY = 'center';
          text.set('lsPoint', labelPositionLS);
          text.setCoords();
          if (text._setPositionDimensions) {
            text._setPositionDimensions({});
          }

          // set the wrapper positions
          textWrapper.angle = labelAngle;
          textWrapper.top = labelPosition.y;
          textWrapper.left = labelPosition.x;
          textWrapper.originX = 'center';
          textWrapper.originY = 'center';
          textWrapper.width = textWidthScaled;
          textWrapper.targetSize.width = text.width;
          textWrapper.set('lsPoint', labelPositionLS);
          textWrapper.setCoords();
          if (textWrapper._setPositionDimensions) {
            textWrapper._setPositionDimensions({});
          }
        }
      }
    }

    getImageFeatureLabelPosition(fabricPoints, textWidth) {
      const upperLeftPointInd = fabricPoints.reduce((acc, point, i) => {
        const prevPoint = fabricPoints[acc];
        const origin = { x: 0, y: 0 };
        const pointDist = calc2dDistance(origin, point);
        const prevPointDist = calc2dDistance(origin, prevPoint);
        if (pointDist < prevPointDist) {
          // lower y value is higher on the screen
          return i;
        }
        return acc;
      }, 0);
      const upperLeftPoint = fabricPoints[upperLeftPointInd];

      const neighborIndA = upperLeftPointInd - 1 < 0 ? fabricPoints.length - 1 : upperLeftPointInd - 1;
      const neighborIndB = upperLeftPointInd + 1 > fabricPoints.length - 1 ? 0 : upperLeftPointInd + 1;
      const highestNeighbor =
        fabricPoints[neighborIndA].y < fabricPoints[neighborIndB].y
          ? fabricPoints[neighborIndA]
          : fabricPoints[neighborIndB];

      let point1 = upperLeftPoint;
      let point2 = highestNeighbor;

      // duplicated form getMeasurementLabelPosition

      const { zoom } = this.getScaleFactor();
      if (point1.x > point2.x) {
        const tmp = point1;
        point1 = point2;
        point2 = tmp;
      }
      const baseTheta = angleBetween(point1, point2);
      const offsetDist = 24 / zoom; // pixel distance scaled by current zoom level
      const length = calc2dDistance(point1, point2);
      const majorOffset = textWidth ? Math.min((textWidth + 32 / zoom) / 2, length / 2) : length / 2;
      const offsetTheta = Math.atan(offsetDist / majorOffset);
      const offsetLength = Math.max(
        Math.sqrt(Math.abs(Math.pow(majorOffset, 2) - Math.pow(offsetDist, 2))),
        offsetDist
      );

      let theta = deg2rad(baseTheta) - offsetTheta;
      let xOffset = offsetLength * Math.cos(theta) || 0;
      let yOffset = offsetLength * Math.sin(theta) || 0;
      let x = xOffset + point1.x;
      let y = yOffset + point1.y;

      const polygonPoints = [
        fabricPoints.map((point) => [point.x, point.y]).concat([[fabricPoints[0].x, fabricPoints[0].y]]),
      ];
      const isInside = fabricPoints.length > 2 && inside([x, y], polygonPoints);
      if (isInside) {
        theta = deg2rad(baseTheta) + offsetTheta;
        xOffset = offsetLength * Math.cos(theta) || 0;
        yOffset = offsetLength * Math.sin(theta) || 0;
        x = xOffset + point1.x;
        y = yOffset + point1.y;
      }

      const labelPosition = { x, y };

      const labelPositionLS = this.fabricToLineSample(x, y);
      return { labelPosition, labelPositionLS, labelAngle: baseTheta };
    }

    setFeatureConfidenceLevel(imageFeatureId, confidenceLevel = null) {
      const config = getConfig();
      if (confidenceLevel === null) confidenceLevel = config.image_feature_confidence_levels.low;
      const shapes = this._imageFeatures[imageFeatureId];
      if (shapes) {
        shapes.forEach((shape) => {
          shape.set('confidenceLevel', confidenceLevel);
        });
        if (confidenceLevel === config.image_feature_confidence_levels.low) {
          this.setLowConfidenceStyle(imageFeatureId);
        } else if (confidenceLevel === config.image_feature_confidence_levels.medium) {
          this.setMediumConfidenceStyle(imageFeatureId);
        } else if (confidenceLevel === config.image_feature_confidence_levels.high) {
          this.setHighConfidenceStyle(imageFeatureId);
        }

        this._fabricCanvas.requestRenderAll();
      }
    }

    setLowConfidenceStyle(imageFeatureId) {
      const shapes = this._imageFeatures[imageFeatureId];
      if (shapes) {
        const text = shapes.find((x) => x.get('isImageFeatureText'));

        text.set('fill', COLOR_LOW_CONFIDECE);
      }
    }

    setMediumConfidenceStyle(imageFeatureId) {
      const shapes = this._imageFeatures[imageFeatureId];
      if (shapes) {
        const text = shapes.find((x) => x.get('isImageFeatureText'));

        text.set('fill', COLOR_MEDIUM_CONFIDECE);
      }
    }

    setHighConfidenceStyle(imageFeatureId) {
      const shapes = this._imageFeatures[imageFeatureId];
      if (shapes) {
        const text = shapes.find((x) => x.get('isImageFeatureText'));

        text.set('fill', COLOR_HIGH_CONFIDECE);
      }
    }

    setFeatureLabel(imageFeatureId, label) {
      const shapes = this._imageFeatures[imageFeatureId];
      if (shapes) {
        const text = shapes.find((x) => x.get('isImageFeatureText'));
        const textWrapper = shapes.find((x) => x.get('isImageFeatureTextWrapper'));
        text.set('text', label);
        this.rescaleShape(textWrapper);
        this._fabricCanvas.requestRenderAll();
      }
    }

    enableShapeInteractions(enabled, annotationId) {
      if (annotationId) {
        this.setActiveAnnotationId(annotationId);
        return super.enableShapeInteractions(
          enabled,
          (x) =>
            x.get('annotationId') === annotationId &&
            !x.get('isImageFeatureText') &&
            !x.get('isImageFeatureTextWrapper') &&
            !x.get('isImageFeatureSecondaryPolygon')
        );
      }
      return super.enableShapeInteractions(enabled);
    }

    addImageFeatures(shapes, interactable, hideLabel = false) {
      if (!Array.isArray(shapes)) {
        shapes = [shapes];
      }

      return new Promise((resolve, reject) => {
        Promise.all(
          shapes.map((obj) => {
            return new Promise((res, rej) => {
              const { feature_geometry, feature_label, feature_confidence_level, annotation_id, feature_id } = obj;

              const geometry = parseWKTString(feature_geometry);
              const lsPoints = geometry.coords.map((x) => {
                return { sample: x[0], line: x[1] };
              });

              const defParams = {
                isImageFeature: true,
                imageFeatureId: feature_id,
                annotationId: annotation_id || feature_id,
                annOpacityLimit: this._activeAnnotationOpacity,
                confidenceLevel: feature_confidence_level,
              };

              const points = lsPoints.map((point) => this.lineSampleToFabric(point.line, point.sample));
              const { labelPosition, labelPositionLS, labelAngle } = this.getImageFeatureLabelPosition(points);

              const promArr = [];

              // outline shape
              promArr.push(
                this.addShape({
                  shapeType: 'polygon',
                  params: {
                    ...defParams,
                    fill: undefined,
                    stroke: '#000000',
                    strokeWidth: hideLabel ? 10 : 6, // make lines thicker when label is absent
                    isImageFeaturePolygon: true,
                    isImageFeatureSecondaryPolygon: true,
                    disableShapeEdit: true,
                    noSelectionEvent: true,
                    hasControls: false,
                    selectable: false,
                    evented: false,
                  },
                  scaleInfo: {
                    scaleType: 'scale',
                    targetSize: { strokeWidth: hideLabel ? 10 : 6 },
                  },
                  coords: {
                    lsPoints,
                  },
                })
              );

              // main shape
              promArr.push(
                this.addShape({
                  shapeType: 'polygon',
                  params: {
                    ...defParams,
                    fill: undefined,
                    stroke: '#ffffff',
                    strokeWidth: hideLabel ? 4 : 2, // make lines thicker when label is absent
                    isImageFeaturePolygon: true,
                    isImageFeaturePrimaryPolygon: true,
                    disableShapeEdit: !interactable,
                    noSelectionEvent: !interactable,
                    hasControls: false,
                    selectable: interactable,
                    evented: interactable,
                    onEdit: (shape) => this.handleFeatureEdit(shape),
                  },
                  scaleInfo: {
                    scaleType: 'scale',
                    targetSize: { strokeWidth: hideLabel ? 4 : 2 },
                  },
                  coords: {
                    lsPoints,
                  },
                })
              );

              // text background
              promArr.push(
                this.addShape({
                  shapeType: 'rectangle',
                  coords: {
                    lsPoint: labelPositionLS,
                  },
                  params: {
                    ...defParams,
                    fill: '#000000',
                    height: 18,
                    width: 18,
                    rx: 2,
                    ry: 2,
                    originX: 'center',
                    originY: 'center',
                    stroke: '#000000', // we use the stroke to provide scaled padding around the text
                    strokeWidth: 8,
                    paintFirst: 'stroke',
                    opacity: hideLabel ? 0 : 1,
                    annOpacityLimit: hideLabel ? 0 : 1,
                    objOpacityLimit: hideLabel ? 0 : 1,
                    angle: labelAngle,
                    isImageFeatureTextWrapper: true,
                    disableShapeEdit: true,
                    noSelectionEvent: true,
                    hasControls: false,
                    selectable: false,
                    evented: false,
                    onScale: (x) => this.handleFeatureEdit(x),
                  },
                  scaleInfo: {
                    scaleType: 'scale',
                    targetSize: { height: 18, width: 18, strokeWidth: 8, cornerRadius: 2 },
                  },
                })
              );

              // text
              promArr.push(
                this.addShape({
                  shapeType: 'text',
                  text: feature_label,
                  coords: {
                    lsPoint: labelPositionLS,
                  },
                  params: {
                    ...defParams,
                    top: labelPosition.y,
                    left: labelPosition.x,
                    fill: 'white',
                    textAlign: 'center',
                    originX: 'center',
                    originY: 'center',
                    fontWeight: '600',
                    fontSize: 12,
                    charSpacing: 50,
                    opacity: hideLabel ? 0 : 1,
                    annOpacityLimit: hideLabel ? 0 : 1,
                    objOpacityLimit: hideLabel ? 0 : 1,
                    angle: labelAngle,
                    isImageFeatureText: true,
                    disableShapeEdit: true,
                    noSelectionEvent: true,
                    hasControls: false,
                    selectable: false,
                    evented: false,
                    // onScale: (obj) => this.handleFeatureEdit(obj),
                  },
                  scaleInfo: {
                    scaleType: 'scale',
                    targetSize: {
                      fontSize: 12,
                    },
                  },
                })
              );

              Promise.all(promArr)
                .then((objs) => {
                  this.setDrawingShape(null); // make sure we're not drawing anything

                  const primaryPolygon = objs.find((x) => x.get('isImageFeaturePrimaryPolygon'));

                  this._imageFeatures[feature_id] = objs;

                  if (this._annotationShapes[annotation_id]) {
                    this._annotationShapes[annotation_id] = this._annotationShapes[annotation_id].concat(objs);
                  } else {
                    this._annotationShapes[annotation_id] = objs;
                  }

                  this.setFeatureConfidenceLevel(feature_id, primaryPolygon.get('confidenceLevel'));
                  this.handleFeatureEdit(primaryPolygon);
                  this.unhighlightFeature(feature_id);

                  this.rescaleFeature(feature_id);

                  this.dispatch('annotationadded', this._annotationShapes[annotation_id]);
                  this.dispatch('imagefeatureadded', this._imageFeatures[feature_id]);
                  res(objs);
                })
                .catch((err) => {
                  rej(err);
                });
            });
          })
        )
          .then((features) => {
            resolve(features);

            // clear tracking on fabric canvas
            this.setDrawingShape(null);
          })
          .catch((err) => reject(err));
      });
    }

    rescaleFeature(featureId) {
      let objs = this._imageFeatures[featureId];
      if (objs) {
        const primaryPolygon = objs.find((x) => x.get('isImageFeaturePrimaryPolygon'));
        const secondaryPolygon = objs.find((x) => x.get('isImageFeatureSecondaryPolygon'));
        const text = objs.find((x) => x.get('isImageFeatureText'));
        const textWrapper = objs.find((x) => x.get('isImageFeatureTextWrapper'));

        this.rescaleShape(primaryPolygon);
        this.rescaleShape(secondaryPolygon);
        this.rescaleShape(textWrapper);
        this.rescaleShape(text);
        this._fabricCanvas.requestRenderAll();
      }
    }

    zoomToFeature(featureId) {
      const bounds = this.getFeatureBounds(featureId, true); // only get bounds for polygon because the label bounds will change when we zoom
      this.zoomToBounds(bounds);
    }

    getFeatureBounds(featureId, polygonOnly = false) {
      let objs = this._imageFeatures[featureId];
      if (objs) {
        if (polygonOnly) {
          objs = objs.filter((x) => x.get('isImageFeaturePrimaryPolygon'));
        }
        return this.getFabricObjectBounds(objs);
      }
      return false;
    }

    getFeaturePrimaryPolygon(featureId) {
      let objs = this._imageFeatures[featureId];
      if (objs) {
        objs = objs.filter((x) => x.get('isImageFeaturePrimaryPolygon'));
        if (objs.length > 0) return objs[0];
        else return false;
      }
      return false;
    }

    highlightFeature(featureId) {
      const objs = this._imageFeatures[featureId];
      if (objs) {
        const poly = objs.find((x) => x.get('isImageFeatureSecondaryPolygon'));
        poly.set('stroke', '#4FA1FF');
        this._fabricCanvas.requestRenderAll();
      }
    }

    unhighlightFeature(featureId) {
      const objs = this._imageFeatures[featureId];
      if (objs) {
        const poly = objs.find((x) => x.get('isImageFeatureSecondaryPolygon'));
        poly.set('stroke', '#000000');
        this._fabricCanvas.requestRenderAll();
      }
    }

    startEditingFeature(featureId) {
      const objs = this._imageFeatures[featureId];
      if (objs) {
        const poly = objs.find((x) => x.get('isImageFeaturePrimaryPolygon'));
        this.startEditingShapePoints(poly);
      }
    }

    selectFeature(featureId) {
      const objs = this._imageFeatures[featureId];
      if (objs) {
        const poly = objs.find((x) => x.get('isImageFeaturePrimaryPolygon'));
        this._fabricCanvas.setActiveObject(poly);
        this._fabricCanvas.requestRenderAll();
      }
    }

    getActiveFeatures() {
      const annoId = this._activeAnnotationId;
      if (!annoId) return [];
      const shapes = this.getAnnotationShapes(annoId);
      if (!shapes) return [];
      const ids = [...new Set(shapes.map((x) => x.get('imageFeatureId')))];
      return this.getImageFeatures(ids);
    }

    getImageFeatures(ids) {
      // passing in no ids will return all features
      if (typeof ids === 'undefined') {
        ids = Object.keys(this._imageFeatures);
      }

      // support single id or multiple
      if (!Array.isArray(ids)) {
        ids = [ids];
      }

      // return array of feature objects
      return ids.reduce((acc, id) => {
        if (this._imageFeatures[id]) {
          acc.push(this._imageFeatures[id]);
        }
        return acc;
      }, []);
    }

    removeImageFeature(featureId) {
      const objs = this._imageFeatures[featureId];
      if (objs) {
        const poly = objs.find((x) => x.get('isImageFeaturePrimaryPolygon'));
        this.removeShape(poly);
      }
    }

    getImageFeatureImage(featureId, resolution, noLabel = true) {
      const bounds = this.getFeatureBounds(featureId, true);
      if (bounds) {
        const margin = 25; // image line/samples
        const imageBounds = [
          bounds.topLeft.sample - margin,
          bounds.topLeft.line - margin,
          bounds.bottomRight.sample - bounds.topLeft.sample + margin * 2,
          bounds.bottomRight.line - bounds.topLeft.line + margin * 2,
        ]; // [x, y, width, height];
        return this.exportImage({
          bounds: imageBounds,
          features: [featureId],
          download: false,
          resolution,
          hideFeatureLabels: noLabel,
        });
      }
      return new Promise((resolve, reject) => {
        reject(new Error('Feature bounds not found'));
      });
    }

    getFeatureId() {
      const res = this._nextFeatureId || this.getShapeId();
      this._nextFeatureId = false;
      return res;
    }

    setNextFeatureId(featureId) {
      this._nextFeatureId = featureId;
    }
  };
