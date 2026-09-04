import { fabric } from 'fabric';
import debounce from 'lodash.debounce';
import { angleBetween, calc2dDistance, deg2rad, formatWithUnit } from 'src/utils';
import { getDistanceMeasurement } from 'src/utils/dataQuery';
import { getPropFromProduct } from 'src/utils/sharedUtils';
import * as telemetry from 'src/utils/telemetryUtils';

import { getConfig } from 'src/utils/configRegistry';
// NOTE: requires OSDMeasureMixin(OSDFabricMixin(OSDViewer))

export const OSDMeasureMixin = (base) =>
  class extends base {
    constructor(options) {
      super(options);
      const config = getConfig();

      this._measuring = false;
      this._activeMeasureId = null;
      this._editMeasureId = null;
      this._measureClickTarget = null;
      this._measurements = {};

      this.debouncedMeasurementQueryUpdate = debounce(this.measurementQueryUpdate.bind(this), 150, {
        trailing: true,
      });

      // add listener for the end of editing
      this._fabricCanvas.on('mouse:down', (event) => {
        const shape = event.target;
        if (!shape && this._viewMode === config.interaction_modes.view_only) {
          this.disableMeasureInteractions();
        }
      });
    }

    getMeasureId() {
      return this.getShapeId();
    }

    getMeasurementById(id) {
      return this._measurements[id];
    }

    startMeasuring() {
      // just in case
      if (this.stopAnnotating) {
        this.stopAnnotating();
        this.clearSelection();
      }

      this.disableMeasureInteractions();
      this._measuring = true;
    }

    stopMeasuring() {
      this._measuring = false;
      this.clearUnfinishedMeasurement();
      this.disableMeasureInteractions();
    }

    clearMeasurements() {
      this.stopMeasuring();
      const measureIds = Object.keys(this._measurements);
      measureIds.forEach((measureId) => {
        this.removeMeasurement(measureId);
      });
    }

    clearUnfinishedMeasurement() {
      if (this._activeMeasureId) {
        this.removeMeasurement(this._activeMeasureId);
      }
      this._activeMeasureId = null;
    }

    handleKeydown(event) {
      super.handleKeydown(event);

      // skip key events on input elements
      if (event.target.tagName.toUpperCase() === 'INPUT' || event.target.tagName.toUpperCase() === 'TEXTAREA') {
        return;
      }

      // If delete key was hit, delete selected objects
      if (event.keyCode === 46 || event.keyCode === 8) {
        if (this._editMeasureId) {
          const removeId = this._editMeasureId;
          this.disableMeasureInteractions();
          this._fabricCanvas.discardActiveObject();
          this.removeMeasurement(removeId);
        }
      }

      // if escape or enter was hit, turn off editing
      if (event.keyCode === 27 || event.keyCode === 13) {
        if (this._editMeasureId) {
          this.disableMeasureInteractions();
        }
      }
    }

    handleClickEvent(event) {
      const config = getConfig();
      super.handleClickEvent(event);

      // check our interaction state
      if (!this._measuring) {
        return;
      }

      // use alt/option key to pan while measuring
      if (event.originalEvent.altKey) {
        return;
      }

      // check that we have a base image
      if (this.osdViewer.world.getItemCount() === 0) {
        return;
      }

      // Retrieve image coordinates and check for validity
      const lsPoint = this.osdToLineSample(event.position.x, event.position.y, false, false);
      if (lsPoint.line < 0 || lsPoint.sample < 0) {
        return;
      }

      // new measurement
      if (!this._activeMeasureId) {
        const promArr = []; // array to track all the promises
        const measureId = this.getMeasureId(); // get a new measure id

        // get label position
        const point = this.lineSampleToFabric(lsPoint.line, lsPoint.sample);
        const { labelPosition, labelPositionLS, labelAngle } = this.getMeasurementLabelPosition(point, point);

        // add a temp connecting line shape
        promArr.push(
          this.addShape({
            shapeType: 'line',
            params: {
              strokeWidth: 2,
              strokeDashArray: [5, 5],
              stroke: 'white',
              measureId,
              disableShapeEdit: true,
              noSelectionEvent: true,
              hasControls: false,
              selectable: false,
              isMeasurement: true,
            },
            coords: {
              lsPoint1: lsPoint,
              lsPoint2: lsPoint,
            },
            scaleInfo: {
              scaleType: 'scale',
              targetSize: { strokeWidth: 2, strokeDashArray: [5, 5] },
              onScale: (obj) => obj._setPositionDimensions({}),
            },
          })
        );

        // add the base target
        promArr.push(
          this.addShape({
            shapeType: 'ellipse',
            coords: {
              lsPoint,
            },
            params: {
              radius: 6,
              fill: 'black',
              stroke: 'white',
              strokeWidth: 1.5,
              originX: 'center',
              originY: 'center',
              measureId,
              disableShapeEdit: true,
              noSelectionEvent: true,
              hasControls: false,
              selectable: false,
              isMeasurement: true,
              isMeasureEditable: true,
            },
            scaleInfo: { scaleType: 'scale', targetSize: { radius: 6, strokeWidth: 1.5 } },
          })
        );
        promArr.push(
          this.addShape({
            shapeType: 'ellipse',
            coords: {
              lsPoint,
            },
            params: {
              radius: 3,
              fill: 'white',
              strokeWidth: 0,
              originX: 'center',
              originY: 'center',
              measureId,
              disableShapeEdit: true,
              noSelectionEvent: true,
              hasControls: false,
              selectable: false,
              isMeasurement: true,
              isMeasureEditable: true,
            },
            scaleInfo: { scaleType: 'scale', targetSize: { radius: 3, strokeWidth: 0 } },
          })
        );

        promArr.push(
          this.addShape({
            shapeType: 'text',
            text: '--',
            coords: {
              lsPoint: labelPositionLS,
            },
            params: {
              top: labelPosition.y,
              left: labelPosition.x,
              fill: 'white',
              stroke: 'black',
              textAlign: 'center',
              originX: 'center',
              originY: 'top',
              paintFirst: 'stroke',
              strokeWidth: 3,
              fontWeight: '600',
              fontSize: 12,
              charSpacing: 50,
              angle: labelAngle,
              isMeasureText: true,
              measureId,
              disableShapeEdit: true,
              noSelectionEvent: true,
              hasControls: false,
              selectable: false,
              isMeasurement: true,
            },
            scaleInfo: {
              scaleType: 'scale',
              targetSize: {
                fontSize: 12,
                strokeWidth: 3,
              },
            },
          })
        );

        // wait for the two objects to complete then add to our tracking dict
        Promise.all(promArr)
          .then((objs) => {
            const line = objs[0];

            this._measurements[measureId] = {
              measureId,
              fabricObjs: objs,
              lsPoint1: lsPoint,
            };
            this._activeMeasureId = measureId;

            this.setDrawingShape(line);

            this.dispatch('measurementstarted');
          })
          .catch((err) => {
            throw err;
          });
      } else {
        // completing current measurement
        this.setDrawingShape(null);
        const prevMeasurePoint = this._measurements[this._activeMeasureId];
        this.addMeasurement({ lsPoint1: prevMeasurePoint.lsPoint1, lsPoint2: lsPoint })
          .then(() => {
            this.stopMeasuring();
            const filename = getPropFromProduct(this.baseImage, config.es_mappings.filename);
            const instrument = getPropFromProduct(this.baseImage, config.es_mappings.instrument_id);
            telemetry.measurementAdded(filename, instrument);
          })
          .catch((err) => {
            throw err;
          });
      }
    }

    addMeasurement(options) {
      const config = getConfig();
      return new Promise((resolve, reject) => {
        const { lsPoint1, lsPoint2, text } = options;
        const measureId = this.getMeasureId();

        if (lsPoint1 && lsPoint2) {
          const promArr = [];
          const point1 = this.lineSampleToFabric(lsPoint1.line, lsPoint1.sample);
          const point2 = this.lineSampleToFabric(lsPoint2.line, lsPoint2.sample);

          // calculate the mid point for label position
          const { labelPosition, labelPositionLS, labelAngle } = this.getMeasurementLabelPosition(point1, point2);

          // add connecting line
          promArr.push(
            this.addShape({
              shapeType: 'line',
              coords: {
                lsPoint1: lsPoint1,
                lsPoint2: lsPoint2,
              },
              params: {
                strokeWidth: 4,
                stroke: 'black',
                isMeasureConnectingLine: true,
                measureId,
                disableShapeEdit: true,
                noSelectionEvent: true,
                hasControls: false,
                selectable: false,
                isMeasurement: true,
                isMeasureEditable: false,
              },
              scaleInfo: {
                scaleType: 'scale',
                targetSize: { strokeWidth: 4 },
                onScale: (obj) => obj._setPositionDimensions({}),
              },
            })
          );
          promArr.push(
            this.addShape({
              shapeType: 'line',
              coords: {
                lsPoint1: lsPoint1,
                lsPoint2: lsPoint2,
              },
              params: {
                strokeWidth: 2,
                stroke: 'white',
                isMeasureConnectingLine: true,
                measureId,
                disableShapeEdit: true,
                noSelectionEvent: true,
                hasControls: false,
                selectable: false,
                isMeasurement: true,
                isMeasureEditable: true,
              },
              scaleInfo: {
                scaleType: 'scale',
                targetSize: { strokeWidth: 2 },
                onScale: (obj) => obj._setPositionDimensions({}),
              },
            })
          );

          // add first end target
          promArr.push(
            this.addShape({
              shapeType: 'ellipse',
              coords: {
                lsPoint: lsPoint1,
              },
              params: {
                radius: 6,
                fill: 'black',
                stroke: 'white',
                strokeWidth: 1.5,
                originX: 'center',
                originY: 'center',
                isMeasureEnd1: true,
                measureId,
                disableShapeEdit: true,
                noSelectionEvent: true,
                hasControls: false,
                selectable: false,
                isMeasurement: true,
                isMeasureEditable: true,
              },
              scaleInfo: { scaleType: 'scale', targetSize: { radius: 6, strokeWidth: 1.5 } },
            })
          );
          promArr.push(
            this.addShape({
              shapeType: 'ellipse',
              coords: {
                lsPoint: lsPoint1,
              },
              params: {
                radius: 3,
                fill: 'white',
                strokeWidth: 0,
                originX: 'center',
                originY: 'center',
                isMeasureEnd1: true,
                measureId,
                disableShapeEdit: true,
                noSelectionEvent: true,
                hasControls: false,
                selectable: false,
                isMeasurement: true,
                isMeasureEditable: true,
              },
              scaleInfo: { scaleType: 'scale', targetSize: { radius: 3, strokeWidth: 0 } },
            })
          );

          // add second end target
          promArr.push(
            this.addShape({
              shapeType: 'ellipse',
              coords: {
                lsPoint: lsPoint2,
              },
              params: {
                radius: 6,
                fill: 'black',
                stroke: 'white',
                strokeWidth: 1.5,
                originX: 'center',
                originY: 'center',
                isMeasureEnd2: true,
                measureId,
                disableShapeEdit: true,
                noSelectionEvent: true,
                hasControls: false,
                selectable: false,
                isMeasurement: true,
                isMeasureEditable: true,
              },
              scaleInfo: { scaleType: 'scale', targetSize: { radius: 6, strokeWidth: 1.5 } },
            })
          );
          promArr.push(
            this.addShape({
              shapeType: 'ellipse',
              coords: {
                lsPoint: lsPoint2,
              },
              params: {
                radius: 3,
                fill: 'white',
                strokeWidth: 0,
                originX: 'center',
                originY: 'center',
                isMeasureEnd2: true,
                measureId,
                disableShapeEdit: true,
                noSelectionEvent: true,
                hasControls: false,
                selectable: false,
                isMeasurement: true,
                isMeasureEditable: true,
              },
              scaleInfo: { scaleType: 'scale', targetSize: { radius: 3, strokeWidth: 0 } },
            })
          );

          // add label text
          promArr.push(
            this.addShape({
              shapeType: 'text',
              text: text || '--',
              coords: {
                lsPoint: labelPositionLS,
              },
              params: {
                top: labelPosition.y,
                left: labelPosition.x,
                fill: 'white',
                stroke: 'black',
                textAlign: 'center',
                originX: 'center',
                originY: 'top',
                angle: labelAngle,
                paintFirst: 'stroke',
                strokeWidth: 3,
                fontWeight: '600',
                fontSize: 12,
                charSpacing: 50,
                isMeasureText: true,
                measureId,
                disableShapeEdit: true,
                noSelectionEvent: true,
                hasControls: false,
                selectable: false,
                isMeasurement: true,
              },
              scaleInfo: {
                scaleType: 'scale',
                onScale: (obj) => this.repositionMeasurementLabel(obj),
                targetSize: {
                  fontSize: 12,
                  strokeWidth: 3,
                },
              },
            })
          );

          // wait for all the shapes to load onto the canvas
          Promise.all(promArr)
            .then((objs) => {
              // create sub-groups
              const endPoints1 = objs.filter((o) => o.get('isMeasureEnd1'));
              const endPoints2 = objs.filter((o) => o.get('isMeasureEnd2'));
              const otherShapes = objs.filter((o) => !o.get('isMeasureEnd1') && !o.get('isMeasureEnd2'));
              const endProm1 = this.groupShapes(endPoints1, {
                lsPoint: lsPoint1,
                isMeasureEnd1: true,
                measureId,
                disableShapeEdit: true,
                noSelectionEvent: true,
                hasControls: false,
                selectable: false,
                isMeasurement: true,
                isMeasureEditable: true,
              });
              const endProm2 = this.groupShapes(endPoints2, {
                lsPoint: lsPoint2,
                isMeasureEnd2: true,
                measureId,
                disableShapeEdit: true,
                noSelectionEvent: true,
                hasControls: false,
                selectable: false,
                isMeasurement: true,
                isMeasureEditable: true,
              });
              Promise.all([endProm1, endProm2]).then((groupShapes) => {
                const finalObjs = otherShapes.concat(groupShapes);
                const editObjs = finalObjs.filter((obj) => obj.get('isMeasureEditable'));

                // enable editing
                finalObjs.forEach((obj) => {
                  obj.on('mousedown', (e) => {
                    if (this._viewMode === config.interaction_modes.view_only) {
                      this._measureClickTarget = { measureId: obj.get('measureId'), x: e.pointer.x, y: e.pointer.y };
                    }
                  });
                  obj.on('mouseup', (e) => {
                    if (
                      this._measureClickTarget &&
                      this._measureClickTarget.measureId === obj.get('measureId') &&
                      this._measureClickTarget.x === e.pointer.x &&
                      this._measureClickTarget.y === e.pointer.y &&
                      this._viewMode === config.interaction_modes.view_only &&
                      this._editMeasureId !== obj.get('measureId')
                    ) {
                      this.disableMeasureInteractions();
                      this.enableMeasureInteractions(obj.get('measureId'));
                    }
                  });
                });
                editObjs.forEach((obj) => {
                  obj.on('moving', (e) => {
                    this.handleMeasurementPositionUpdate(e, obj);
                  });
                  obj.on('mouseover', () => {
                    if (this._viewMode === config.interaction_modes.view_only) {
                      if (this._editMeasureId === obj.get('measureId')) {
                        if (obj.get('isMeasureEnd1') || obj.get('isMeasureEnd2')) {
                          this.setEndpointHoverStyle(obj);
                        }
                      } else {
                        this.setMeasureHoverStyle(obj.get('measureId'));
                      }
                    }
                  });
                  obj.on('mouseout', () => {
                    if (this._viewMode === config.interaction_modes.view_only) {
                      if (this._editMeasureId === obj.get('measureId')) {
                        if (obj.get('isMeasureEnd1') || obj.get('isMeasureEnd2')) {
                          this.resetEndpointHoverStyle(obj);
                        }
                      } else {
                        this.resetMeasureHoverStyle(obj.get('measureId'));
                      }
                    }
                  });
                });
                editObjs.forEach((obj) => {
                  obj.on('modified', (e) => {
                    if (e.action === 'moved') {
                      const measurement = this._measurements[obj.get('measureId')];
                      this.updateMeasurementPosition(measurement.measureId, {
                        lsPoint1: measurement.lsPoint1,
                        lsPoint2: measurement.lsPoint2,
                      });
                    }
                  });
                });

                // store the measurement
                const measurement = { measureId, fabricObjs: finalObjs, lsPoint1, lsPoint2 };
                this._measurements[measureId] = measurement;

                // update the measurement value if we aren't provided a text value
                if (!text) {
                  this.updateMeasurementText(measureId, 'loading...');
                  this.measurementQueryUpdate({ measureId });
                }

                // external callback
                this.dispatch('measurementadded', measurement);
                resolve(measurement);
              });
            })
            .catch((err) => reject(err));
        } else {
          reject(new Error('No line/sample'));
        }
      });
    }

    enableShapeInteractions(enabled, filter) {
      super.enableShapeInteractions(enabled, filter);

      this.disableMeasureInteractions();
    }

    enableMeasureInteractions(measureId) {
      if (this._measurements[measureId]) {
        this._editMeasureId = measureId;

        this.setMeasureEditStyles(measureId);

        const { fabricObjs } = this._measurements[measureId];
        const editObjs = fabricObjs.filter((obj) => obj.get('isMeasureEditable'));
        editObjs.forEach((obj) => {
          obj.set('selectable', true);
          if (obj.get('isGroup')) obj.getObjects().forEach((o) => o.set('selectable', true));
        });

        this.dispatch('measurementselected', this._measurements[measureId]);
      } else {
        console.warn('measure edit ID not found: ', measureId);
      }
    }

    disableMeasureInteractions() {
      const editMeasureId = this._editMeasureId;
      this._editMeasureId = null;
      this._measureClickTarget = null;
      if (editMeasureId) {
        this.resetMeasureStyles(editMeasureId);

        const measurement = this._measurements[editMeasureId];
        const { fabricObjs } = measurement;

        fabricObjs.forEach((obj) => {
          obj.set('selectable', false);
          if (obj.get('isGroup')) obj.getObjects().forEach((o) => o.set('selectable', false));
        });

        this._fabricCanvas.discardActiveObject();
      }

      this.dispatch('measurementdeselected');
    }

    removeMeasurement(measureOrId) {
      const measurement = typeof measureOrId === 'string' ? this._measurements[measureOrId] : measureOrId;
      if (measurement) {
        if (measurement._abortController) measurement._abortController.abort();
        measurement.fabricObjs.forEach((id) => this.removeShape(id));
        delete this._measurements[measurement.measureId];

        this.dispatch('measurementremoved', measurement);
      } else {
        telemetry.logWarning('Could not remove measurement');
      }
    }

    updateDrawingShape(event) {
      super.updateDrawingShape(event);

      // update the measurement text during pre-placement
      if (this._drawingShape.get('isMeasurement')) {
        const line = this._drawingShape;
        const measureId = this._drawingShape.get('measureId');
        const measurement = this._measurements[measureId];
        if (measurement) {
          const { fabricObjs } = measurement;
          const text = fabricObjs.find((x) => x.get('isMeasureText'));

          // calculate the current line transforms
          const matrix = line.calcTransformMatrix();
          const transformedPoints = line
            .get('points')
            .map(function (p) {
              return new fabric.Point(p.x - line.pathOffset.x, p.y - line.pathOffset.y);
            })
            .map(function (p) {
              return fabric.util.transformPoint(p, matrix);
            });

          // calculate the mid point for label position
          const { labelPosition, labelPositionLS, labelAngle } = this.getMeasurementLabelPosition(
            transformedPoints[0],
            transformedPoints[1]
          );

          // convert to line/sample
          const lsPoint1 = this.fabricToLineSample(transformedPoints[0].x, transformedPoints[0].y);
          const lsPoint2 = this.fabricToLineSample(transformedPoints[1].x, transformedPoints[1].y);

          // set the text positions
          text.angle = labelAngle;
          text.top = labelPosition.y;
          text.left = labelPosition.x;
          text.originX = 'center';
          text.originY = 'top';
          text.set('lsPoint', labelPositionLS);
          text.setCoords();
          if (text._setPositionDimensions) {
            text._setPositionDimensions({});
          }

          // update the measurement value
          this.updateMeasurementText(measureId, 'loading...');
          this.debouncedMeasurementQueryUpdate({ measureId, lsPoint1, lsPoint2 });
        }
      }
    }

    handleMeasurementPositionUpdate(event, target) {
      const measureId = target.get('measureId');
      if (target.get('isMeasureConnectingLine')) {
        const matrix = target.calcTransformMatrix();
        const transformedPoints = target
          .get('points')
          .map(function (p) {
            return new fabric.Point(p.x - target.pathOffset.x, p.y - target.pathOffset.y);
          })
          .map(function (p) {
            return fabric.util.transformPoint(p, matrix);
          });
        this.updateMeasurementPosition(measureId, {
          point1: transformedPoints[0],
          point2: transformedPoints[1],
        });
      } else {
        // its an endpoint
        const p = { x: event.pointer.x, y: event.pointer.y };
        const lsp = this.fabricToLineSample(event.pointer.x, event.pointer.y);

        if (target.get('isMeasureEnd1')) {
          this.updateMeasurementPosition(measureId, {
            lsPoint1: lsp,
            point1: p,
          });
        } else if (target.get('isMeasureEnd2')) {
          this.updateMeasurementPosition(measureId, {
            lsPoint2: lsp,
            point2: p,
          });
        }
      }
    }

    updateMeasurementPosition(measureId, options = {}) {
      const measurement = this._measurements[measureId];
      if (measurement) {
        let { lsPoint1, lsPoint2, point1, point2 } = options;

        // retrieve all the display objects pieces
        const { fabricObjs } = measurement;
        const connectingLines = fabricObjs.filter((x) => x.get('isMeasureConnectingLine'));
        const endPoint1 = fabricObjs.find((x) => x.get('isMeasureEnd1'));
        const endPoint2 = fabricObjs.find((x) => x.get('isMeasureEnd2'));
        const text = fabricObjs.find((x) => x.get('isMeasureText'));

        // retrieve the line/sample and x/y pairs
        const convLSPoint1 = point1 ? this.fabricToLineSample(point1.x, point1.y) : measurement.lsPoint1;
        const convLSPoint2 = point2 ? this.fabricToLineSample(point2.x, point2.y) : measurement.lsPoint2;
        lsPoint1 = lsPoint1 ? lsPoint1 : convLSPoint1;
        lsPoint2 = lsPoint2 ? lsPoint2 : convLSPoint2;
        point1 = point1 ? point1 : this.lineSampleToFabric(lsPoint1.line, lsPoint1.sample); // avoid partial placements
        point2 = point2 ? point2 : this.lineSampleToFabric(lsPoint2.line, lsPoint2.sample); // avoid partial placements

        // calculate the mid point for label position
        const { labelPosition, labelPositionLS, labelAngle } = this.getMeasurementLabelPosition(point1, point2);

        // set end point positions
        endPoint1.set('lsPoint', lsPoint1);
        endPoint2.set('lsPoint', lsPoint2);
        endPoint1.getObjects().forEach((obj) => {
          obj.lsPoint = lsPoint1;
        });
        endPoint2.getObjects().forEach((obj) => {
          obj.lsPoint = lsPoint2;
        });
        endPoint1.top = point1.y;
        endPoint1.left = point1.x;
        endPoint2.top = point2.y;
        endPoint2.left = point2.x;
        endPoint1.originX = 'center';
        endPoint1.originY = 'center';
        endPoint2.originX = 'center';
        endPoint2.originY = 'center';

        // set the connecting line positions
        connectingLines.forEach((lineObj) => {
          lineObj.set('points', [point1, point2]);
          lineObj.set('lsPoints', [lsPoint1, lsPoint2]);
        });

        // set the text positions
        text.angle = labelAngle;
        text.top = labelPosition.y;
        text.left = labelPosition.x;
        text.originX = 'center';
        text.originY = 'top';
        text.set('lsPoint', labelPositionLS);

        // update the positions on the canvas
        const updateShape = (obj) => {
          obj.setCoords();
          if (obj._setPositionDimensions) {
            obj._setPositionDimensions({});
          }
          if (obj.get('isGroup')) {
            obj.getObjects().forEach((o) => updateShape(o));
          }
        };
        fabricObjs.forEach((obj) => {
          updateShape(obj);
        });

        // update the measurement value
        this.updateMeasurementText(measureId, 'loading...');
        this.debouncedMeasurementQueryUpdate({ measureId });

        this._fabricCanvas.requestRenderAll();

        // update the store
        measurement.lsPoint1 = lsPoint1;
        measurement.lsPoint2 = lsPoint2;

        this.dispatch('measurementupdated', measurement);
      } else {
        console.warn('Could not find measure ID: ', measureId);
      }
    }

    setMeasureEditStyles(measureId) {
      const measurement = this._measurements[measureId];
      if (measurement) {
        // retrieve all the display objects pieces
        const { fabricObjs } = measurement;
        const connectingLines = fabricObjs.filter((x) => x.get('isMeasureConnectingLine'));
        const endPoint1 = fabricObjs.find((x) => x.get('isMeasureEnd1'));
        const endPoint2 = fabricObjs.find((x) => x.get('isMeasureEnd2'));

        connectingLines.forEach((lineObj) => {
          if (lineObj.get('stroke') === 'black') {
            lineObj.set('strokeDashArray', [5, 5]);
            lineObj.set('targetSize', { strokeWidth: 4, strokeDashArray: [5, 5] });
          } else {
            lineObj.set('stroke', 'white'); // reset possible hover state
            lineObj.set('strokeDashArray', [5, 5]);
            lineObj.set('targetSize', { strokeWidth: 2, strokeDashArray: [5, 5] });
          }
          this.rescaleShape(lineObj);
        });

        endPoint1.getObjects().forEach((obj) => {
          if (obj.get('strokeWidth')) {
            obj.set('stroke', 'black');
            obj.set('fill', 'white');
          } else {
            obj.set('fill', 'black');
          }
        });
        this.rescaleShape(endPoint1);

        endPoint2.getObjects().forEach((obj) => {
          if (obj.get('strokeWidth')) {
            obj.set('stroke', 'black');
            obj.set('fill', 'white');
          } else {
            obj.set('fill', 'black');
          }
        });
        this.rescaleShape(endPoint2);

        this._fabricCanvas.requestRenderAll();
      }
    }

    resetMeasureStyles(measureId) {
      const measurement = this._measurements[measureId];
      if (measurement) {
        // retrieve all the display objects pieces
        const { fabricObjs } = measurement;
        const connectingLines = fabricObjs.filter((x) => x.get('isMeasureConnectingLine'));
        const endPoint1 = fabricObjs.find((x) => x.get('isMeasureEnd1'));
        const endPoint2 = fabricObjs.find((x) => x.get('isMeasureEnd2'));

        connectingLines.forEach((lineObj) => {
          if (lineObj.get('stroke') === 'black') {
            lineObj.set('targetSize', { strokeWidth: 4 });
          } else {
            lineObj.set('stroke', 'white');
            lineObj.set('targetSize', { strokeWidth: 2 });
          }
          lineObj.set('strokeDashArray', null);
          this.rescaleShape(lineObj);
        });

        if (endPoint1) {
          endPoint1.getObjects().forEach((obj) => {
            if (obj.get('strokeWidth')) {
              obj.set('stroke', 'white');
              obj.set('fill', 'black');
            } else {
              obj.set('fill', 'white');
            }
          });
          this.rescaleShape(endPoint1);
        }

        if (endPoint2) {
          endPoint2.getObjects().forEach((obj) => {
            if (obj.get('strokeWidth')) {
              obj.set('stroke', 'white');
              obj.set('fill', 'black');
            } else {
              obj.set('fill', 'white');
            }
          });
          this.rescaleShape(endPoint2);
        }

        this._fabricCanvas.requestRenderAll();
      }
    }

    setMeasureHoverStyle(measureId) {
      const measurement = this._measurements[measureId];
      if (measurement) {
        const { fabricObjs } = measurement;
        const connectingLines = fabricObjs.filter((x) => x.get('isMeasureConnectingLine'));
        const endPoint1 = fabricObjs.find((x) => x.get('isMeasureEnd1'));
        const endPoint2 = fabricObjs.find((x) => x.get('isMeasureEnd2'));

        connectingLines.forEach((lineObj) => {
          if (lineObj.get('stroke') === 'white') {
            lineObj.set('stroke', '#4FA1FF');
          }
        });

        if (endPoint1) {
          endPoint1.getObjects().forEach((obj) => {
            if (obj.get('strokeWidth')) {
              obj.set('stroke', '#4FA1FF');
            } else {
              obj.set('fill', '#4FA1FF');
            }
          });
        }

        if (endPoint2) {
          endPoint2.getObjects().forEach((obj) => {
            if (obj.get('strokeWidth')) {
              obj.set('stroke', '#4FA1FF');
            } else {
              obj.set('fill', '#4FA1FF');
            }
          });
        }
      }
      this._fabricCanvas.requestRenderAll();
    }

    resetMeasureHoverStyle(measureId) {
      const measurement = this._measurements[measureId];
      if (measurement) {
        const { fabricObjs } = measurement;
        const connectingLines = fabricObjs.filter((x) => x.get('isMeasureConnectingLine'));
        const endPoint1 = fabricObjs.find((x) => x.get('isMeasureEnd1'));
        const endPoint2 = fabricObjs.find((x) => x.get('isMeasureEnd2'));

        connectingLines.forEach((lineObj) => {
          if (lineObj.get('stroke') === '#4FA1FF') {
            lineObj.set('stroke', 'white');
          }
        });

        if (endPoint1) {
          endPoint1.getObjects().forEach((obj) => {
            if (obj.get('strokeWidth')) {
              obj.set('stroke', 'white');
            } else {
              obj.set('fill', 'white');
            }
          });
        }

        if (endPoint2) {
          endPoint2.getObjects().forEach((obj) => {
            if (obj.get('strokeWidth')) {
              obj.set('stroke', 'white');
            } else {
              obj.set('fill', 'white');
            }
          });
        }
      }
      this._fabricCanvas.requestRenderAll();
    }

    setEndpointHoverStyle(endPointObj) {
      endPointObj.getObjects().forEach((obj) => {
        if (obj.get('strokeWidth')) {
          obj.set('stroke', 'black');
          obj.set('fill', 'rgba(79, 161, 255, 0.6)');
        } else {
          obj.set('fill', 'black');
        }
      });
      this.rescaleShape(endPointObj);
    }

    resetEndpointHoverStyle(endPointObj) {
      endPointObj.getObjects().forEach((obj) => {
        if (obj.get('strokeWidth')) {
          obj.set('stroke', 'black');
          obj.set('fill', 'white');
        } else {
          obj.set('fill', 'black');
        }
      });
      this.rescaleShape(endPointObj);
    }

    measurementQueryUpdate(options) {
      const { measureId } = options;
      if (this._measurements[measureId]) {
        const measurement = this._measurements[measureId];
        const { lsPoint1: measP1, lsPoint2: measP2 } = measurement;
        const { lsPoint1: opP1, lsPoint2: opP2 } = options;
        const lsPoint1 = opP1 || measP1;
        const lsPoint2 = opP2 || measP2;

        // Cancel previous measurement query if found
        if (measurement._abortController) measurement._abortController.abort();
        measurement._abortController = new AbortController();

        getDistanceMeasurement(
          this.baseImage,
          this.activeSearchProductGroups,
          lsPoint1,
          lsPoint2,
          measurement._abortController.signal,
          this.preferredImageForType
        )
          .then((data) => {
            // No action needed if request aborted
            if (data.aborted) return;

            if (this._measurements[measureId]) {
              const { dist, dataAvailable, queryOk } = data;
              let text = formatWithUnit(dist);
              if (!queryOk) {
                text = 'query failed';
              } else if (!dataAvailable) {
                text = 'unknown';
              }
              this.updateMeasurementText(measureId, text);
            } else {
              console.warn('cannot update measurement');
            }
          })
          .catch((err) => {
            const text = 'no XYZ data';
            this.updateMeasurementText(measureId, text);
            console.warn(err);
          });
      }
    }

    updateMeasurementText(measureId, text) {
      const measurement = this._measurements[measureId];
      const { fabricObjs } = measurement;

      const textObj = fabricObjs.find((obj) => obj.get('shapeType') === 'text');

      // update the text
      textObj.set({
        text,
      });

      // store text for reference
      measurement.text = text;

      // re-render
      this._fabricCanvas.requestRenderAll();
    }

    getMeasurementLabelPosition(point1, point2) {
      const { zoom } = this.getScaleFactor();
      if (point1.x > point2.x) {
        const tmp = point1;
        point1 = point2;
        point2 = tmp;
      }
      const baseTheta = angleBetween(point1, point2);
      const offsetDist = 8 / zoom; // pixel distance scaled by current zoom level
      const length = calc2dDistance(point1, point2);
      const midLength = length / 2;
      const offsetLength = Math.max(Math.sqrt(Math.abs(Math.pow(midLength, 2) - Math.pow(offsetDist, 2))), offsetDist);
      const offsetTheta = Math.atan(offsetDist / midLength);
      const theta = deg2rad(baseTheta) + offsetTheta;
      const xOffset = offsetLength * Math.cos(theta) || 0;
      const yOffset = offsetLength * Math.sin(theta) || 0;
      const x = xOffset + point1.x;
      const y = yOffset + point1.y;
      const labelPosition = { x, y };
      const labelPositionLS = this.fabricToLineSample(x, y);
      return { labelPosition, labelPositionLS, labelAngle: baseTheta };
    }

    repositionMeasurementLabel(textObj) {
      const measureId = textObj.get('measureId');
      if (this._measurements[measureId]) {
        const measurement = this._measurements[measureId];
        const { lsPoint1, lsPoint2 } = measurement;
        if (lsPoint1 && lsPoint2) {
          // update the label position
          const point1 = this.lineSampleToFabric(lsPoint1.line, lsPoint1.sample);
          const point2 = this.lineSampleToFabric(lsPoint2.line, lsPoint2.sample);
          const { labelPosition, labelPositionLS } = this.getMeasurementLabelPosition(point1, point2);
          textObj.top = labelPosition.y;
          textObj.left = labelPosition.x;
          textObj.originX = 'center';
          textObj.originY = 'top';
          textObj.set('lsPoint', labelPositionLS);
        }
      }
    }
  };
