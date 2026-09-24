// import OpenSeaDragon from '../../externals/openseadragon/openseadragon-custom';
import { fabric } from 'fabric';
import OpenSeaDragon from 'openseadragon';
import shortid from 'shortid';
import { TrashIconString } from 'src/components/common/Icons';
import { angleBetween, calc2dDistance, deg2rad, findMidPoint } from 'src/utils';
import * as telemetry from 'src/utils/telemetryUtils';

fabric.Object.prototype.objectCaching = false;
fabric.Group.prototype.hasControls = false;

// Set default shape manipulation control styles
const selectionStrokeBlue = '#4FA1FF';
const selectionFillBlue = 'rgba(79, 161, 255, 0.6)';
fabric.Object.prototype.set({
  transparentCorners: false,
  borderColor: selectionStrokeBlue,
  cornerStrokeColor: selectionStrokeBlue,
  cornerColor: 'white',
  cornerSize: 9, // px
  borderScaleFactor: 2.5,
});

export const OSDFabricMixin = (base) =>
  class extends base {
    constructor(options) {
      super(options);

      // Add fabricJS canvas
      this._canvasdiv = document.createElement('div');
      this._canvasdiv.style.position = 'absolute';
      this._canvasdiv.style.left = 0;
      this._canvasdiv.style.top = 0;
      this._canvasdiv.style.width = '100%';
      this._canvasdiv.style.height = '100%';
      this.osdViewer.drawer.canvas.after(this._canvasdiv);

      this._canvas = document.createElement('canvas');
      this._containerWidth = 0;
      this._containerHeight = 0;
      this._canvas.style.width = '100%';
      this._canvas.style.height = '100%';
      this._previousZoom = null;

      this._id = 'osd-fabric-canvas';
      this._canvas.setAttribute('id', this._id);
      this._canvasdiv.appendChild(this._canvas);
      this._fabricCanvas = new fabric.Canvas(this._canvas, {
        preserveObjectStacking: true, // active object does not appear above others
        isDrawingMode: false,
        targetFindTolerance: 5,
        // selection: false, // disable fabric selection because default click is tracked by OSD
        defaultCursor: 'crosshair',
      });

      // active draw mode
      this._drawingShape = null;
      this._editShapePoints = [];
      this._editShape = null;

      // instance specific trackers
      this._shapes = {};
      this._penOptions = { strokeWidth: 4, color: '#FFFFFF' };

      // custom properties added to fabric objects
      this._customFabricProperties = [
        'shapeType',
        'shapeId',
        'lsPoint',
        'lsPoint1',
        'lsPoint2',
        'lsPoints',
        'scaleType',
        'onScale',
        'targetSize',
        'breakScale',
        'strokeUniform',
        'targetCornerRadius',
        'disableShapeEdit',
        'hasControls',
        'annotationId',
        'isGroup',
        'objOpacityLimit',
        'isMeasurement',
        'isMeasureEditable',
        'measureId',
        'noSelectionEvent',
        'isTarget',
        'targetId',
        'isImageFeature',
        'imageFeatureId',
        'confidenceLevel',
        'isImageFeaturePolygon',
        'isImageFeatureSecondaryPolygon',
        'isImageFeaturePrimaryPolygon',
        'isImageFeatureTextWrapper',
        'isImageFeatureText',
        'footprintId',
      ];

      // add specific listeners to keep view in sync
      this.osdViewer.addHandler('open', () => {
        this.resizeFabricCanvas();
        this._fabricCanvas.setWidth(this._containerWidth);
        this._fabricCanvas.setHeight(this._containerHeight);
      });
      this.osdViewer.addHandler('update-viewport', () => {
        this.resizeFabricCanvas();
      });
      this.osdViewer.addHandler('resize', () => {
        this.resizeFabricCanvas();
      });

      // pass click/drag events to fabric
      this._selectedShapes = [];
      this.osdViewer.addHandler('canvas-release', (event) => {
        const newEvent = new MouseEvent('mouseup', event.originalEvent);
        if (this._fabricCanvas.upperCanvasEl) this._fabricCanvas.upperCanvasEl.dispatchEvent(newEvent);
      });

      this.osdViewer.addHandler('canvas-drag', (event) => {
        if (this._selectedShapes.length || this._fabricCanvas.isDrawingMode) {
          event.preventDefaultAction = true;
          const newEvent = new MouseEvent('mousemove', event.originalEvent);
          if (this._fabricCanvas.upperCanvasEl) this._fabricCanvas.upperCanvasEl.dispatchEvent(newEvent);
        }
      });

      // track shape selection
      const clearHoverStyling = (shape) => {
        const clear = (obj) => {
          if (obj.prevStroke) obj.set('stroke', obj.prevStroke);
          if (obj.prevFill) obj.set('fill', obj.prevFill);
          obj.prevStroke = '';
          obj.prevFill = '';
        };
        if (shape) {
          const arr = typeof shape === 'object' && !Array.isArray(shape) ? [shape] : shape;
          arr.forEach((o) => {
            clear(o);
          });
        } else {
          this._selectedShapes.forEach((o) => {
            clear(o);
          });
        }
      };
      this._fabricCanvas.on('selection:created', (event) => {
        const shape = event.selected[0];
        if (shape.get('selectable')) {
          this._selectedShapes = this._fabricCanvas.getActiveObjects();
          this._selectedShapes =
            typeof this._selectedShapes === 'object' && !Array.isArray(this._selectedShapes)
              ? [this._selectedShapes]
              : this._selectedShapes;
          this._selectedShapes.forEach((obj) => (obj.perPixelTargetFind = false));
          clearHoverStyling();
          if (shape.get('shapeType') !== 'controlPoint') {
            this.stopEditingShapePoints();

            if (!shape.get('noSelectionEvent')) {
              this.dispatch('shapesselected', this._selectedShapes);
            }
            this._fabricCanvas.requestRenderAll();
          }
        }
      });
      this._fabricCanvas.on('selection:updated', (event) => {
        const shape = event.selected[0];
        if (shape.get('selectable')) {
          const prevShape = this._selectedShapes;
          const activeObjs = this._fabricCanvas.getActiveObjects();
          if (activeObjs.length > 1 && activeObjs.find((x) => x.get('shapeType') === 'controlPoint')) {
            activeObjs.forEach((obj) => clearHoverStyling(obj));
            this.clearSelection();
            return;
          }
          this._selectedShapes = this._fabricCanvas.getActiveObjects();
          this._selectedShapes =
            typeof this._selectedShapes === 'object' && !Array.isArray(this._selectedShapes)
              ? [this._selectedShapes]
              : this._selectedShapes;
          this._selectedShapes.forEach((obj) => (obj.perPixelTargetFind = false));
          clearHoverStyling();
          clearHoverStyling(prevShape);
          if (shape.get('shapeType') !== 'controlPoint') {
            this.stopEditingShapePoints();

            if (!prevShape.reduce((acc, s) => acc || s.get('noSelectionEvent'), false)) {
              this.dispatch('shapesdeselected', prevShape);
            }
            if (!shape.get('noSelectionEvent')) {
              this.dispatch('shapesselected', this._selectedShapes);
            }
          } else {
            shape.set('prevFill', shape.get('fill'));
            shape.set('prevStroke', shape.get('stroke'));
            shape.set('fill', selectionStrokeBlue);
            shape.set('stroke', '#FFFFFF');
          }
        }
      });
      this._fabricCanvas.on('selection:cleared', () => {
        const editShape = this._editShape;
        if (editShape) {
          editShape.perPixelTargetFind = this.getPerPixelTargetFindByShape(editShape.shapeType);
        }
        this.stopEditingShapePoints();

        const prevShape = this._selectedShapes;
        if (prevShape) {
          this._selectedShapes.forEach(
            (obj) => (obj.perPixelTargetFind = this.getPerPixelTargetFindByShape(obj.shapeType))
          );
          this._selectedShapes = [];

          if (!prevShape.reduce((acc, s) => acc || s.get('noSelectionEvent'), false)) {
            this.dispatch('shapesdeselected', prevShape);
          }
        }
      });

      // track clicking objects for secondary selection/edit mode
      this._fabricCanvas.on('mouse:dblclick', (event) => {
        const shape = event.target;
        if (
          shape &&
          !shape.get('isMeasurement') &&
          !shape.get('disableShapeEdit') &&
          !this._drawingShape &&
          ['polygon', 'polyline', 'line', 'arrow'].indexOf(shape.get('shapeType')) !== -1
        ) {
          this.startEditingShapePoints(shape);
        }
      });
      this._fabricCanvas.on('mouse:down', (event) => {
        const shape = event.target;
        this.handleShapeClicked(shape);
      });
      this._fabricCanvas.on('object:moving', (event) => {
        let shapes = event.target;
        if (typeof shapes.getObjects === 'function') {
          // this is a multi-select group
          shapes = shapes.getObjects();
        } else {
          shapes = [shapes]; // assume it's singular
        }

        shapes.forEach((shape) => this.handleShapeMove(shape));
      });

      // track shape hover
      this._fabricCanvas.on('mouse:over', (event) => {
        if (
          !this._drawingShape &&
          event.target &&
          event.target.get('selectable') &&
          (!this._selectedShapes.length || this._selectedShapes.find((shape) => shape.shapeId !== event.target.shapeId)) // only show hover on unselected objects
        ) {
          event.target.set('prevStroke', event.target.stroke);
          event.target.set('prevFill', event.target.fill);
          if (event.target.stroke) event.target.set('stroke', selectionStrokeBlue);
          if (event.target.fill) event.target.set('fill', selectionFillBlue);
          this._fabricCanvas.requestRenderAll();
        }
      });

      this._fabricCanvas.on('mouse:out', (event) => {
        if (
          !this._drawingShape &&
          event.target &&
          event.target.get('selectable') &&
          (!this._selectedShapes.length || this._selectedShapes.find((shape) => shape.shapeId !== event.target.shapeId)) // only show hover on unselected objects
        ) {
          if (event.target.prevStroke) event.target.set('stroke', event.target.prevStroke);
          if (event.target.prevFill) event.target.set('fill', event.target.prevFill);
          this._fabricCanvas.requestRenderAll();
        }
      });

      // track mouse movement for shape interaction
      this._fabricCanvas.on('mouse:move', (event) => {
        if (this._drawingShape) {
          this.updateDrawingShape(event);
        }
      });

      // cache of images so we don't need to re-load them a lot
      this._imageCache = {};
    }

    handleShapeMove(shape) {
      const editShape = this._editShape;
      if (shape && shape.get('shapeType') === 'controlPoint') {
        // use this control point to update the selected object
        const p = {
          x: shape.getCenterPoint().x,
          y: shape.getCenterPoint().y,
        };
        const lsp = this.fabricToLineSample(p.x, p.y);

        if (editShape.get('shapeType') === 'arrow') {
          const shapePoints = [editShape.points[0], editShape.points[3]];
          const lsPoints = [editShape.lsPoint1, editShape.lsPoint2];
          shapePoints[shape.get('pointIndex')] = p;
          lsPoints[shape.get('pointIndex')] = lsp;

          const { drawPoints } = this.calculateArrowPoints(shapePoints[0], shapePoints[1], true);

          editShape.points = drawPoints;
          editShape.lsPoint1 = lsPoints[0];
          editShape.lsPoint2 = lsPoints[1];
        } else {
          editShape.points[shape.get('pointIndex')] = p;
          editShape.lsPoints[shape.get('pointIndex')] = lsp;
        }

        editShape.setCoords();
        editShape._setPositionDimensions({});
        if (typeof editShape.onEdit === 'function') {
          editShape.onEdit(editShape);
        }
        this._fabricCanvas.requestRenderAll();
      } else {
        this.stopEditingShapePoints();
        if (typeof shape.onEdit === 'function') {
          shape.onEdit(shape);
        }
      }
    }

    handleShapeClicked(shape) {
      if (!shape) {
        this.stopEditingShapePoints();
        this.dispatch('noshapeclicked', shape);
      } else {
        this.dispatch('shapeclicked', shape);
      }
    }

    enableShapeInteractions(enabled, filter) {
      // Filter shapes
      let shapes = this._fabricCanvas
        .getObjects()
        .filter((obj) => obj.shapeType && !obj.isMeasurement && !obj.isTarget && !obj.isNonDrawing);
      if (typeof filter === 'function') {
        shapes = shapes.filter(filter);
      }

      // Set shape interactivity
      shapes.forEach((obj) => {
        obj.selectable = enabled;
        obj.evented = enabled;
        obj.disableShapeEdit = !enabled;
      });
    }

    handleClickEvent(event) {
      super.handleClickEvent(event);

      const newEvent = new MouseEvent('mousedown', event.originalEvent);
      if (this._fabricCanvas.upperCanvasEl) this._fabricCanvas.upperCanvasEl.dispatchEvent(newEvent);
    }

    handleDoubleClickEvent(event) {
      super.handleDoubleClickEvent(event);

      const newEvent = new MouseEvent('dblclick', event.originalEvent);
      if (this._fabricCanvas.upperCanvasEl) this._fabricCanvas.upperCanvasEl.dispatchEvent(newEvent);
    }

    setPenOptions(options) {
      Object.assign(this._penOptions, options);
    }

    clearSelection() {
      this._fabricCanvas.discardActiveObject().requestRenderAll();
    }

    getPerPixelTargetFindByShape(shapeType) {
      return shapeType !== 'text' && shapeType !== 'text-box';
    }

    startEditingShapePoints(shape) {
      this.stopEditingShapePoints();

      // transform the shape points according the current position
      const matrix = shape.calcTransformMatrix();
      const points = shape
        .get('points')
        .map(function (p) {
          return new fabric.Point(p.x - shape.pathOffset.x, p.y - shape.pathOffset.y);
        })
        .map(function (p) {
          return fabric.util.transformPoint(p, matrix);
        });

      // update the shape with the current transform
      shape.set('points', points);
      shape._setPositionDimensions({});

      let shapePoints = points;
      if (shape.get('shapeType') === 'arrow') {
        shapePoints = [shapePoints[0], shapePoints[3]];
      }

      // add handles to the canvas for editing the shape
      Promise.all(
        shapePoints.map((p, i) => {
          return this.addShape({
            shapeType: 'ellipse',
            coords: {
              lsPoint: { sample: 0, line: 0 },
            },
            params: {
              radius: 6,
              fill: '#FFFFFF',
              stroke: '#4384ce',
              left: p.x,
              top: p.y,
              strokeWidth: 1,
              originX: 'center',
              originY: 'center',
              shapeType: 'controlPoint',
              hasBorders: false,
              hasControls: false,
              disableShapeEdit: true,
              pointIndex: i,
            },
            scaleInfo: { scaleType: 'scale', targetSize: { radius: 6, strokeWidth: 1 } },
          });
        })
      )
        .then((shapes) => {
          this._editShapePoints = shapes;
        })
        .catch((err) => {
          throw err;
        });

      // disable standard controls
      this._editShape = shape;
      this._editShape.hasBorders = false;
      this._fabricCanvas.requestRenderAll();
    }

    stopEditingShapePoints() {
      // remove the edit control shapes
      this._editShapePoints.forEach((p) => {
        const shapeId = p.get('shapeId');
        this._fabricCanvas.remove(p);
        this._shapes[shapeId] = null;
        delete this._shapes[shapeId];
      });

      // enable standard controls
      if (this._editShape) {
        this._editShape.hasBorders = true;
      }
      this._editShapePoints = [];
      this._editShape = null;
    }

    handleKeyup(event) {
      super.handleKeydown(event);

      const newEvent = new KeyboardEvent('keyup', event.originalEvent);
      if (this._fabricCanvas.upperCanvasEl) this._fabricCanvas.upperCanvasEl.dispatchEvent(newEvent);
    }

    handleKeydown(event) {
      super.handleKeydown(event);

      const newEvent = new KeyboardEvent('keydown', event.originalEvent);
      if (this._fabricCanvas.upperCanvasEl) this._fabricCanvas.upperCanvasEl.dispatchEvent(newEvent);

      // If delete key was hit, delete selected objects
      if (
        event.target.tagName.toUpperCase() !== 'INPUT' &&
        event.target.tagName.toUpperCase() !== 'TEXTAREA' &&
        (event.keyCode === 46 || event.keyCode === 8)
      ) {
        this._fabricCanvas.getActiveObjects().forEach((obj) => {
          if (!obj.get('isMeasurement')) {
            if (obj.get('shapeType') === 'controlPoint') {
              const pointIndex = obj.get('pointIndex');
              const editShape = this._editShape;
              this.removeShapePoint(editShape, pointIndex);
            } else {
              this._fabricCanvas.discardActiveObject();
              this.removeShape(obj);
            }
          }
        });
      }
    }

    updateDrawingShape(event) {
      if (this._drawingShape) {
        const shapeType = this._drawingShape.get('shapeType');
        switch (shapeType) {
          case 'line':
            this.updateDrawingPolyline(this._drawingShape, event);
            break;
          case 'polyline':
            this.updateDrawingPolyline(this._drawingShape, event);
            break;
          case 'polygon':
            this.updateDrawingPolyline(this._drawingShape, event);
            break;
          case 'arrow':
            this.updateDrawingArrow(this._drawingShape, event);
            break;
          default:
            break;
        }
        this._drawingShape._setPositionDimensions({});
      }
    }

    updateDrawingPolyline(shape, event) {
      // this func returns the fabric canvas location, different than event.pointer
      const pointer = this._fabricCanvas.getPointer(event.e);

      // for the osd location, event.pointer is the correct point. a little messy but works.
      const lsPoint = this.osdToLineSample(event.pointer.x, event.pointer.y, true, true);

      // retrieve/update points
      const points = shape.get('points');
      const lsPoints = shape.get('lsPoints');
      points[points.length - 1] = { x: pointer.x, y: pointer.y };
      lsPoints[lsPoints.length - 1] = lsPoint;
      shape.set('points', points);
      shape.set('lsPoints', lsPoints);

      // re-render the shapes
      shape.setCoords();
      this._fabricCanvas.requestRenderAll();
    }

    extendPolyline(shape, lsPoint) {
      // convert line sample to fabric coords
      const point = this.lineSampleToFabric(lsPoint.line, lsPoint.sample);

      // retrieve/update points
      const points = shape.get('points');
      const lsPoints = shape.get('lsPoints');
      points[points.length - 1] = { ...point };
      points.push({ ...point });
      lsPoints[lsPoints.length - 1] = { ...lsPoint };
      lsPoints.push({ ...lsPoint });
      shape.set('points', points);
      shape.set('lsPoints', lsPoints);

      // re-render the shapes
      shape.setCoords();
      this._fabricCanvas.requestRenderAll();
    }

    updateDrawingArrow(shape, event) {
      // retrieve/update points
      // for the osd location, event.pointer is the correct point. a little messy but works.
      const lsPoint2 = this.osdToLineSample(event.pointer.x, event.pointer.y, true, true);
      const lsPoint1 = shape.get('lsPoint1');
      const { drawPoints } = this.calculateArrowPoints(lsPoint1, lsPoint2);

      shape.set('points', drawPoints);
      shape.set('lsPoint2', lsPoint2);

      // re-render the shapes
      shape.setCoords();
      this._fabricCanvas.requestRenderAll();
    }

    resizeFabricCanvas() {
      if (this._containerHeight !== this.osdViewer.container.clientHeight) {
        this._containerHeight = this.osdViewer.container.clientHeight;
        this._fabricCanvas.setHeight(this._containerHeight);
      }
      if (this._containerWidth !== this.osdViewer.container.clientWidth) {
        this._containerWidth = this.osdViewer.container.clientWidth;
        this._fabricCanvas.setWidth(this._containerWidth);
      }

      const origin = new OpenSeaDragon.Point(0, 0);
      const viewportZoom = this.osdViewer.viewport.getZoom(true);
      const baseImage = this.osdViewer.world.getItemAt(0);
      const zoom = baseImage ? baseImage.viewportToImageZoom(viewportZoom) : viewportZoom;

      const shouldZoom = zoom !== this._previousZoom;
      if (shouldZoom) this._fabricCanvas.setZoom(zoom);
      const viewportWindowPoint = this.osdViewer.viewport.viewportToWindowCoordinates(origin);
      const x = Math.round(viewportWindowPoint.x);
      const y = Math.round(viewportWindowPoint.y);
      const canvasOffset = this._canvasdiv.getBoundingClientRect();
      const pageScroll = OpenSeaDragon.getPageScroll();
      this._fabricCanvas.absolutePan(
        new fabric.Point(canvasOffset.left - x + pageScroll.x, canvasOffset.top - y + pageScroll.y)
      );
      this._fabricCanvas.calcOffset();

      if (shouldZoom) this.rescaleRenderedShapes();
      else this._fabricCanvas.renderAll();

      this._previousZoom = zoom;
    }

    /**
     * Convert a fabric point to an OpenSeaDragon window coordinate
     *
     * @param {Number} x x coordinate in fabric canvas
     * @param {Number} y y coordinate in fabric canvas
     * @returns {Point} OSD window coordinate point
     * @memberof OSDFabricManager
     */
    fabricToOSD(x, y) {
      const baseImage = this.osdViewer.world.getItemAt(0) || this.osdViewer.viewport;
      const factor = 1 / this._fabricCanvas.getZoom();

      const canvasOffset = this._canvasdiv.getBoundingClientRect();
      const pageScroll = OpenSeaDragon.getPageScroll();
      const origin = new OpenSeaDragon.Point(0, 0);
      const imageWindowPoint = baseImage.imageToWindowCoordinates(origin);
      const paintPoint = new fabric.Point(
        canvasOffset.left - imageWindowPoint.x + pageScroll.x,
        canvasOffset.top - imageWindowPoint.y + pageScroll.y
      );

      const webPoint = new OpenSeaDragon.Point(x / factor - paintPoint.x, y / factor - paintPoint.y);

      return webPoint;
    }

    /**
     * Convert a fabric point to an Line, Sample coordinate
     *
     * @param {Number} x x coordinate in fabric canvas
     * @param {Number} y y coordinate in fabric canvas
     * @param {Bool} allowExt false if this should return an invalid point if the point lies outside the image
     * @param {Bool} allowPartial false if this should always return a round number
     * @returns {Point} line and sample coordinate point
     * @memberof OSDFabricManager
     */
    fabricToLineSample(x, y, allowExt = false, allowPartial = false) {
      const osdPoint = this.fabricToOSD(x, y);
      return this.osdToLineSample(osdPoint.x, osdPoint.y, allowExt, allowPartial);
    }

    /**
     * Convert a line/sample image coordinate to a fabric x,y point
     *
     * @param {Number} line the line in the image
     * @param {Number} sample the sample in the image
     * @returns {Object} {x,y} point on the fabric canvas
     * @memberof OSDFabricManager
     */
    lineSampleToFabric(line, sample) {
      const imagePoint = new OpenSeaDragon.Point(sample - 0.5, line - 0.5); // convert back to normal pixel space

      const baseImage = this.osdViewer.world.getItemAt(0) || this.osdViewer.viewport;
      const factor = 1 / this._fabricCanvas.getZoom();
      const viewportPoint = baseImage.imageToViewportCoordinates(imagePoint);
      const webPoint = this.osdViewer.viewport.viewportToViewerElementCoordinates(viewportPoint);
      const canvasOffset = this._canvasdiv.getBoundingClientRect();
      const pageScroll = OpenSeaDragon.getPageScroll();
      const origin = new OpenSeaDragon.Point(0, 0);
      const imageWindowPoint = baseImage.imageToWindowCoordinates(origin);
      const paintPoint = new fabric.Point(
        canvasOffset.left - imageWindowPoint.x + pageScroll.x,
        canvasOffset.top - imageWindowPoint.y + pageScroll.y
      );
      return { x: (webPoint.x + paintPoint.x) * factor, y: (webPoint.y + paintPoint.y) * factor };
    }

    getShapeId() {
      return shortid.generate();
    }

    getShapeById(id) {
      return this._shapes[id];
    }

    turnOnPenTool(options = this._penOptions) {
      const { strokeWidth, color } = options;
      this._fabricCanvas.isDrawingMode = true;
      this._fabricCanvas.freeDrawingBrush.width = strokeWidth;
      this._fabricCanvas.freeDrawingBrush.color = color;
      this._fabricCanvas.freeDrawingCursor = 'url("astria_assets/pencil.svg") 0 21, auto';
    }

    turnOffPenTool() {
      this._fabricCanvas.isDrawingMode = false;

      // Select all pen shapes that were just drawn
      const objs = this._fabricCanvas.getObjects();
      const penShapes = objs.filter((x) => x.get('justDrawn'));

      const selection = new fabric.ActiveSelection(penShapes, { canvas: this._fabricCanvas });
      this._fabricCanvas.setActiveObject(selection);

      penShapes.forEach((pen) => {
        pen.justDrawn = false;
      });
    }

    setDrawingShape(obj) {
      // reset selectable
      if (this._drawingShape) {
        this._drawingShape.set('selectable', this._drawingShape.get('_prevSelectable'));
      }

      // update the current drawing shape
      this._drawingShape = obj;

      // store selectability and disable
      if (this._drawingShape) {
        this._drawingShape.set('_prevSelectable', this._drawingShape.get('selectable'));
        this._drawingShape.set('selectable', false);
      }
    }

    addShape(options) {
      return new Promise((resolve, reject) => {
        const { shapeType } = options;
        let prom;

        switch (shapeType) {
          // case 'target':
          //   prom = this.addTargetShape(options);
          //   break;
          case 'trash':
            prom = this.addTrashShape(options);
            break;
          case 'rect-line':
            prom = this.addRectLineShape(options);
            break;
          case 'rectangle':
            prom = this.addRectShape(options);
            break;
          case 'ellipse':
            prom = this.addEllipseShape(options);
            break;
          case 'text':
            prom = this.addTextShape(options);
            break;
          case 'text-box':
            prom = this.addTextBoxShape(options);
            break;
          case 'line':
            prom = this.addLineShape(options);
            break;
          case 'polyline':
            prom = this.addPolylineShape(options);
            break;
          case 'polygon':
            prom = this.addPolygonShape(options);
            break;
          case 'arrow':
            prom = this.addArrowShape(options);
            break;
          case 'pen':
            prom = this.addPenShape(options);
            break;
          case 'image':
            prom = this.addImage(options);
            break;
          default:
            reject(new Error(`Unknown shape: ${shapeType}`));
        }

        if (prom) {
          prom
            .then((msg) => {
              resolve(msg);
              this.dispatch('shapeadded', msg);
            })
            .catch((err) => reject(err));
        }
      });
    }

    removeShapePoint(obj, pointIndex) {
      // set minimum number of points
      if (obj && ['polygon', 'polyline'].indexOf(obj.get('shapeType')) >= 0 && obj.points.length > 2) {
        obj.points.splice(pointIndex, 1);
        obj.lsPoints.splice(pointIndex, 1);
        obj.setCoords();
        obj._setPositionDimensions({});
        this._fabricCanvas.setActiveObject(obj);
        this._fabricCanvas.requestRenderAll();
        window.requestAnimationFrame(() => {
          if (typeof obj.onEdit === 'function') {
            obj.onEdit(obj);
          }
          this.startEditingShapePoints(obj);
        });
      }
    }

    removeShape(objOrId) {
      this.stopEditingShapePoints();

      // resolve group or id
      const obj = typeof objOrId === 'string' ? this._shapes[objOrId] : objOrId;
      if (obj && typeof obj === 'object') {
        // recursively remove children from our backing map
        if (obj.get('isGroup') || typeof obj.getObjects === 'function') {
          const children = obj.getObjects();
          children.forEach((c) => this.removeShape(c));
        }

        // remove the object from rendering
        this._fabricCanvas.remove(obj).requestRenderAll();

        // clear our backing map entry
        const shapeId = obj.get('shapeId');
        if (this._shapes[shapeId]) {
          const shape = this._shapes[shapeId];
          this._shapes[shapeId] = null;
          delete this._shapes[shapeId];

          this.dispatch('shaperemoved', shape);
        } else {
          telemetry.logWarning(`Id unknown to shape store: ${shapeId}`);
          console.warn(this._shapes, obj);
        }
      } else {
        telemetry.logWarning(`Could not remove object: ${objOrId}`);
        console.warn(obj);
      }
    }

    cloneShape(obj, add = true) {
      return new Promise((resolve) => {
        const shapeId = this.getShapeId();
        obj.clone((clone) => {
          clone.set('shapeId', shapeId);
          if (add) {
            this._fabricCanvas.add(clone);
            this._shapes[shapeId] = clone;
          }
          resolve(clone);
        });
      });
    }

    groupShapes(objsOrIds, groupParams = {}) {
      return new Promise((resolve, reject) => {
        Promise.all(
          objsOrIds.map((objId) => {
            // clone all the objects
            return new Promise((resolve1) => {
              let obj;

              if (typeof objId === 'string') {
                // just an id
                obj = this._shapes[objId];
              } else {
                // assume its the object itself
                obj = objId;
              }

              this._fabricCanvas.remove(obj);
              obj.clone((clone) => {
                this._shapes[clone.get('shapeId')] = clone;
                resolve1(clone);
              }, this._customFabricProperties);
            });
          })
        )
          .then((clones) => {
            // re-render
            this._fabricCanvas.renderAll();

            // group all the cloned objects
            const shapeId = groupParams.shapeId || this.getShapeId();
            const group = new fabric.Group(clones, {
              subTargetCheck: true,
              selectable: false,
              renderOnAddRemove: false,
              shapeId,
              isGroup: true,
              ...groupParams,
            });
            this._fabricCanvas.add(group);
            this._shapes[shapeId] = group;
            resolve(group);
          })
          .catch((err) => reject(err));
      });
    }

    addRectLineShape(options) {
      return new Promise((resolve) => {
        const shapeId = this.getShapeId();
        const { shapeType, coords, params, scaleInfo } = options;
        const { lsPoint1, lsPoint2 } = coords;
        const fabricPoint1 = this.lineSampleToFabric(lsPoint1.line, lsPoint1.sample);
        const fabricPoint2 = this.lineSampleToFabric(lsPoint2.line, lsPoint2.sample);

        /* Draw the fabric js line - in order to have this have an outline, it must be drawn as a rectangle. Calculate
         * the distance and angle between the points with the starting place at the first point */
        const p1x = fabricPoint1.x;
        const p1y = fabricPoint1.y;
        const dist = calc2dDistance(fabricPoint1, fabricPoint2);
        const angleDeg = angleBetween(fabricPoint1, fabricPoint2, true);
        const obj = new fabric.Rect({
          top: p1y,
          left: p1x,
          stroke: '#000000',
          strokeWidth: 0.5,
          strokeUniform: true,
          perPixelTargetFind: this.getPerPixelTargetFindByShape(shapeType),
          height: dist,
          width: 1,
          angle: angleDeg,
          fill: '#28FF7E',
          ...scaleInfo,
          lsPoint1,
          lsPoint2,
          shapeId,
          shapeType,
          annOpacityLimit: 1,
          objOpacityLimit: 1,
          ...params,
        });
        this._fabricCanvas.add(obj);

        this.rescaleShape(obj);

        this._fabricCanvas.requestRenderAll();
        this._shapes[shapeId] = obj;
        resolve(obj);
      });
    }

    addLineShape(options) {
      return new Promise((resolve) => {
        const shapeId = this.getShapeId();
        const { shapeType, coords, params, scaleInfo } = options;
        const { lsPoint1, lsPoint2 } = coords;
        const fabricPoint1 = this.lineSampleToFabric(lsPoint1.line, lsPoint1.sample);
        const fabricPoint2 = this.lineSampleToFabric(lsPoint2.line, lsPoint2.sample);

        // const obj = new fabric.Line([p1x, p1y, p2x, p2y], {
        const obj = new fabric.Polyline([fabricPoint1, fabricPoint2], {
          stroke: '#FFFE01',
          strokeWidth: 2,
          strokeUniform: true,
          hasControls: false, // disable for secondary editing
          fill: null, // explicitly useless
          perPixelTargetFind: this.getPerPixelTargetFindByShape(shapeType),
          ...scaleInfo,
          lsPoints: [lsPoint1, lsPoint2],
          shapeId,
          shapeType,
          annOpacityLimit: 1,
          objOpacityLimit: 1,
          ...params,
        });
        this._fabricCanvas.add(obj);

        this.rescaleShape(obj);

        this._fabricCanvas.requestRenderAll();
        this._shapes[shapeId] = obj;
        resolve(obj);
      });
    }

    addPolylineShape(options) {
      return new Promise((resolve) => {
        const shapeId = this.getShapeId();
        const { shapeType, coords, params, scaleInfo } = options;
        const { lsPoints } = coords;
        const fabricPoints = lsPoints.map((point) => this.lineSampleToFabric(point.line, point.sample));

        const obj = new fabric.Polyline(fabricPoints, {
          stroke: '#FFFE01',
          strokeWidth: 2,
          strokeUniform: true,
          hasControls: false, // disable for secondary editing
          fill: null, // explicitly useless
          perPixelTargetFind: this.getPerPixelTargetFindByShape(shapeType),
          ...scaleInfo,
          lsPoints,
          shapeId,
          shapeType,
          annOpacityLimit: 1,
          objOpacityLimit: 1,
          ...params,
        });
        this._fabricCanvas.add(obj);

        this.rescaleShape(obj);

        this._fabricCanvas.requestRenderAll();
        this._shapes[shapeId] = obj;
        resolve(obj);
      });
    }

    addPolygonShape(options) {
      return new Promise((resolve) => {
        const shapeId = this.getShapeId();
        const { shapeType, coords, params, scaleInfo } = options;
        const { lsPoints } = coords;
        const fabricPoints = lsPoints.map((point) => this.lineSampleToFabric(point.line, point.sample));

        const obj = new fabric.Polygon(fabricPoints, {
          stroke: '#00FF00',
          strokeWidth: 2,
          strokeUniform: true,
          hasControls: false, // disable for secondary editing
          perPixelTargetFind: this.getPerPixelTargetFindByShape(shapeType),
          fill: 'rgba(0,255,0,0.3)',
          originX: 'center',
          originY: 'center',
          ...scaleInfo,
          lsPoints,
          shapeId,
          shapeType,
          annOpacityLimit: 1,
          objOpacityLimit: 1,
          ...params,
        });
        this._fabricCanvas.add(obj);

        this.rescaleShape(obj);

        this._fabricCanvas.requestRenderAll();
        this._shapes[shapeId] = obj;
        resolve(obj);
      });
    }

    addArrowShape(options) {
      return new Promise((resolve) => {
        const shapeId = this.getShapeId();
        const { shapeType, coords, params, scaleInfo } = options;
        const { lsPoint1, lsPoint2 } = coords;
        const fabricPoint1 = this.lineSampleToFabric(lsPoint1.line, lsPoint1.sample);
        const fabricPoint2 = this.lineSampleToFabric(lsPoint2.line, lsPoint2.sample);
        const fabricMidPoint = findMidPoint(fabricPoint1, fabricPoint2);

        // add midpoint lsPoint to object to allow for reseting location. Cannot get start and end of line, but easier to
        // reset using the center like all other shapes
        const lsPoint = this.fabricToLineSample(fabricMidPoint);

        const { drawPoints } = this.calculateArrowPoints(lsPoint1, lsPoint2);

        const obj = new fabric.Polygon(drawPoints, {
          stroke: '#FFFE01',
          strokeWidth: 2,
          strokeUniform: true,
          fill: '#FFFE01',
          hasControls: false, // disable for secondary editing
          perPixelTargetFind: this.getPerPixelTargetFindByShape(shapeType),
          ...scaleInfo,
          lsPoint1,
          lsPoint2,
          lsPoint,
          shapeId,
          shapeType,
          annOpacityLimit: 1,
          objOpacityLimit: 1,
          ...params,
        });

        this._fabricCanvas.add(obj);

        this.rescaleShape(obj);

        this._fabricCanvas.requestRenderAll();
        this._shapes[shapeId] = obj;
        resolve(obj);
      });
    }

    addTextShape(options) {
      return new Promise((resolve) => {
        const shapeId = this.getShapeId();
        const { shapeType, text, coords, params, scaleInfo } = options;
        const { lsPoint } = coords;
        const fabricPoint = this.lineSampleToFabric(lsPoint.line, lsPoint.sample);
        const obj = new fabric.Text(text, {
          left: fabricPoint.x,
          top: fabricPoint.y,
          originX: 'center',
          originY: 'center',
          fontFamily: 'Inter',
          fontStyle: 'normal',
          fontWeight: '400',
          fontSize: 12,
          charSpacing: 8, //em
          fill: '#000000',
          ...scaleInfo,
          lsPoint,
          shapeId,
          shapeType,
          annOpacityLimit: 1,
          objOpacityLimit: 1,
          ...params,
        });
        this._fabricCanvas.add(obj);

        this.rescaleShape(obj);

        this._fabricCanvas.requestRenderAll();
        this._shapes[shapeId] = obj;
        resolve(obj);
      });
    }

    addTextBoxShape(options) {
      return new Promise((resolve) => {
        const shapeId = this.getShapeId();
        const { shapeType, text, coords, params, scaleInfo } = options;
        const { lsPoint } = coords;
        const fabricPoint = this.lineSampleToFabric(lsPoint.line, lsPoint.sample);
        const obj = new fabric.Textbox(text, {
          left: fabricPoint.x,
          top: fabricPoint.y,
          originX: 'center',
          originY: 'center',
          // lockScalingY: true,
          fontFamily: 'Inter',
          fontStyle: 'normal',
          fontWeight: '400',
          fontSize: 12,
          charSpacing: 8, //em
          editable: true,
          editingBorderColor: selectionStrokeBlue,
          ...scaleInfo,
          lsPoint,
          shapeId,
          shapeType,
          annOpacityLimit: 1,
          objOpacityLimit: 1,
          ...params,
        });
        this._fabricCanvas.add(obj);

        this.rescaleShape(obj);

        this._fabricCanvas.requestRenderAll();
        this._shapes[shapeId] = obj;
        resolve(obj);
      });
    }

    addRectShape(options) {
      return new Promise((resolve) => {
        const shapeId = this.getShapeId();
        const { shapeType, coords, params, scaleInfo } = options;
        const { lsPoint } = coords;
        const fabricPoint = this.lineSampleToFabric(lsPoint.line, lsPoint.sample);
        const obj = new fabric.Rect({
          left: fabricPoint.x,
          top: fabricPoint.y,
          perPixelTargetFind: this.getPerPixelTargetFindByShape(shapeType),
          width: 10,
          height: 10,
          rx: 0,
          ry: 0,
          stroke: '#00FF00',
          strokeWidth: 2,
          fill: 'rgba(0,255,0,0.3)',
          originX: 'center',
          originY: 'center',
          strokeUniform: true,
          ...scaleInfo,
          lsPoint,
          shapeId,
          shapeType,
          annOpacityLimit: 1,
          objOpacityLimit: 1,
          ...params,
        });
        this._fabricCanvas.add(obj);

        this.rescaleShape(obj);

        this._fabricCanvas.requestRenderAll();
        this._shapes[shapeId] = obj;
        resolve(obj);
      });
    }

    addEllipseShape(options) {
      return new Promise((resolve) => {
        const shapeId = this.getShapeId();
        const { shapeType, coords, params, scaleInfo } = options;
        const { lsPoint } = coords;
        const fabricPoint = this.lineSampleToFabric(lsPoint.line, lsPoint.sample);
        const obj = new fabric.Circle({
          left: fabricPoint.x,
          top: fabricPoint.y,
          perPixelTargetFind: this.getPerPixelTargetFindByShape(shapeType),
          radius: 1,
          stroke: '#00FF00',
          strokeWidth: 2,
          fill: 'rgba(0,255,0,0.3)',
          originX: 'center',
          originY: 'center',
          strokeUniform: true,
          ...scaleInfo,
          lsPoint,
          shapeId,
          shapeType,
          annOpacityLimit: 1,
          objOpacityLimit: 1,
          ...params,
        });
        this._fabricCanvas.add(obj);

        this.rescaleShape(obj);

        this._fabricCanvas.requestRenderAll();
        this._shapes[shapeId] = obj;
        resolve(obj);
      });
    }

    addTrashShape(options) {
      return new Promise((resolve) => {
        const shapeId = this.getShapeId();
        const { shapeType, coords, size, params, scaleInfo } = options;
        const { lsPoint } = coords;
        const fabricPoint = this.lineSampleToFabric(lsPoint.line, lsPoint.sample);
        fabric.loadSVGFromString(TrashIconString, (objects, objOptions) => {
          const obj = fabric.util.groupSVGElements(objects, objOptions);
          obj.set({
            left: fabricPoint.x,
            top: fabricPoint.y,
            originX: 'center',
            originY: 'center',
            ...scaleInfo,
            lsPoint,
            shapeId,
            shapeType,
            annOpacityLimit: 1,
            objOpacityLimit: 1,
            ...params,
          });
          obj.scaleToWidth(size);
          obj.scaleToHeight(size);
          this._fabricCanvas.add(obj);

          this.rescaleShape(obj);

          this._fabricCanvas.requestRenderAll();
          this._shapes[shapeId] = obj;
          resolve(obj);
        });
      });
    }

    addPenShape(options) {
      return new Promise((resolve) => {
        const shapeId = this.getShapeId();
        const { shapeType, path, coords, params, scaleInfo } = options;
        const { lsPoint } = coords;
        const fabricPoint = this.lineSampleToFabric(lsPoint.line, lsPoint.sample);
        const obj = new fabric.Path(path, {
          left: fabricPoint.x,
          top: fabricPoint.y,
          perPixelTargetFind: this.getPerPixelTargetFindByShape(shapeType),
          stroke: '#FFFFFF',
          strokeWidth: 1,
          fill: null, // explicitly useless
          originX: 'center',
          originY: 'center',
          strokeUniform: true,
          strokeLineCap: 'round',
          ...scaleInfo,
          lsPoint,
          shapeId,
          shapeType,
          annOpacityLimit: 1,
          objOpacityLimit: 1,
          ...params,
        });
        this._fabricCanvas.add(obj).requestRenderAll();
        this._shapes[shapeId] = obj;
        resolve(obj);
      });
    }

    addImage(options) {
      return new Promise(async (resolve, reject) => {
        const shapeId = this.getShapeId();
        const { shapeType, coords, params, scaleInfo, imagePath } = options;
        const { lsPoint } = coords;
        const fabricPoint = this.lineSampleToFabric(lsPoint.line, lsPoint.sample);
        try {
          const image = await this.getImage(imagePath);
          const obj = new fabric.Image(image, {
            left: fabricPoint.x,
            top: fabricPoint.y,
            perPixelTargetFind: this.getPerPixelTargetFindByShape(shapeType),
            width: 10,
            height: 10,
            originX: 'center',
            originY: 'center',
            ...scaleInfo,
            lsPoint,
            shapeId,
            shapeType,
            annOpacityLimit: 1,
            objOpacityLimit: 1,
            ...params,
          });
          this._fabricCanvas.add(obj);

          this.rescaleShape(obj);

          this._fabricCanvas.requestRenderAll();
          this._shapes[shapeId] = obj;
          resolve(obj);
        } catch (err) {
          reject(err);
        }
      });
    }

    createShadowObj(options = {}) {
      return new fabric.Shadow(options);
    }

    calculateArrowPoints(tailPoint, headPoint, fabricCoords = false) {
      // convert if needed
      if (!fabricCoords) {
        headPoint = this.lineSampleToFabric(headPoint.line, headPoint.sample);
        tailPoint = this.lineSampleToFabric(tailPoint.line, tailPoint.sample);
      }

      const angleDeg = (Math.atan2(headPoint.y - tailPoint.y, headPoint.x - tailPoint.x) * 180) / Math.PI - 90;
      const tipLen = 25;
      const alpha1 = deg2rad(angleDeg - 75);
      const alpha2 = deg2rad(angleDeg - 105);

      let x1, y1, x2, y2;
      x1 = headPoint.x + tipLen * Math.cos(alpha1);
      y1 = headPoint.y + tipLen * Math.sin(alpha1);
      x2 = headPoint.x + tipLen * Math.cos(alpha2);
      y2 = headPoint.y + tipLen * Math.sin(alpha2);

      const arrowPoint1 = { x: x1, y: y1 };
      const arrowPoint2 = { x: x2, y: y2 };
      const arrowMidPoint = findMidPoint(arrowPoint1, arrowPoint2);
      return {
        drawPoints: [tailPoint, arrowMidPoint, arrowPoint1, headPoint, arrowPoint2, arrowMidPoint],
        headPoint,
        tailPoint,
        arrowPoint1,
        arrowPoint2,
        arrowMidPoint,
      };
    }

    setSinglePointShapePosition(obj, coords) {
      const { lsPoint } = coords;
      const fabricPoint = this.lineSampleToFabric(lsPoint.line, lsPoint.sample);

      obj.set('top', fabricPoint.y);
      obj.set('left', fabricPoint.x);
      obj.setCoords();
    }

    rescaleSymbol(obj, zoom, ppp) {
      const targetSize = obj.get('targetSize') || 15;
      const breakScale = obj.get('breakScale');

      // use a break point to define a maximum scale limit e.g. do not scale beyond this point
      const scale = typeof breakScale !== 'undefined' ? Math.max(targetSize, ppp * breakScale) : targetSize;

      obj.scaleToWidth(scale);
      obj.scaleToHeight(scale);
    }

    rescaleRectLine(obj, zoom, ppp) {
      const targetSize = obj.get('targetSize') || 1;
      const breakScale = obj.get('breakScale');

      // use a break point to define a maximum scale limit e.g. do not scale beyond this point
      let width = typeof breakScale !== 'undefined' ? Math.max(targetSize, ppp * breakScale) : targetSize;

      width /= zoom;
      obj.set('width', width);
      obj.set('strokeWidth', width / 2);
    }

    rescaleText(obj, zoom, ppp) {
      const targetSize = obj.get('targetSize') || { fontSize: 12 };
      const { fontSize: targetFontSize, strokeWidth: targetStrokeWidth } = targetSize;
      const breakScale = obj.get('breakScale');

      // use a break point to define a maximum scale limit e.g. do not scale beyond this point
      const fontSize = typeof breakScale !== 'undefined' ? Math.max(targetFontSize, ppp * breakScale) : targetFontSize;
      obj.set('fontSize', fontSize / zoom);

      if (targetStrokeWidth) {
        const strokeWidth =
          typeof breakScale !== 'undefined' ? Math.max(targetStrokeWidth, ppp * breakScale) : targetStrokeWidth;
        obj.set('strokeWidth', strokeWidth / zoom);
      }
    }

    rescaleRect(obj, zoom, ppp) {
      const targetSize = obj.get('targetSize') || { width: 2, height: 2, strokeWidth: 1, cornerRadius: 0 };
      const {
        width: targetWidth,
        height: targetHeight,
        strokeWidth: targetStrokeWidth,
        cornerRadius: targetCornerRadius,
      } = targetSize;
      const breakScale = obj.get('breakScale');

      // use a break point to define a maximum scale limit e.g. do not scale beyond this point
      let height = typeof breakScale !== 'undefined' ? Math.max(targetHeight, ppp * breakScale) : targetHeight;
      let width = typeof breakScale !== 'undefined' ? Math.max(targetWidth, ppp * breakScale) : targetWidth;
      let strokeWidth =
        (typeof breakScale !== 'undefined' ? Math.max(targetStrokeWidth, ppp * breakScale) : targetStrokeWidth) || 1;

      height /= zoom;
      width /= zoom;
      strokeWidth /= zoom;
      const cornerR = targetCornerRadius / zoom;

      obj.set('strokeWidth', strokeWidth);
      obj.set('height', height);
      obj.set('width', width);
      obj.set('rx', cornerR);
      obj.set('ry', cornerR);
    }

    rescaleImage(obj, zoom, ppp) {
      const targetSize = obj.get('targetSize') || { scale: 1 };
      const { scale } = targetSize;

      obj.scale(scale / ppp);
    }

    rescaleEllipse(obj, zoom, ppp) {
      const targetSize = Object.assign({}, { radius: 5, strokeWidth: 1 }, obj.get('targetSize'));
      const { radius: targetRadius, strokeWidth: targetStrokeWidth } = targetSize;
      const breakScale = obj.get('breakScale');
      const noBreak = obj.get('noBreak') || [];

      // use a break point to define a maximum scale limit e.g. do not scale beyond this point
      let radius =
        typeof breakScale !== 'undefined' && noBreak.indexOf('radius') !== -1
          ? Math.max(targetRadius, ppp * breakScale)
          : targetRadius;
      let strokeWidth =
        typeof breakScale !== 'undefined' && noBreak.indexOf('strokeWidth') !== -1
          ? Math.max(targetStrokeWidth, ppp * breakScale)
          : targetStrokeWidth;

      radius /= zoom;
      strokeWidth /= zoom;

      obj.set('radius', radius);
      obj.set('strokeWidth', strokeWidth);
    }

    rescalePolygon(obj, zoom, ppp) {
      const targetSize = obj.get('targetSize') || { strokeWidth: 1 };
      const breakScale = obj.get('breakScale');

      const { strokeWidth: targetStrokeWidth, strokeDashArray: targetStrokeDashArray } = targetSize;

      // use a break point to define a maximum scale limit e.g. do not scale beyond this point
      let strokeWidth =
        typeof breakScale !== 'undefined' ? Math.max(targetStrokeWidth, ppp * breakScale) : targetStrokeWidth;

      strokeWidth /= zoom;
      obj.set('strokeWidth', strokeWidth);

      if (targetStrokeDashArray) {
        const strokeDashArray = targetStrokeDashArray.map((val) => {
          return (typeof breakScale !== 'undefined' ? Math.max(val, ppp * breakScale) : val) / zoom;
        });
        obj.set('strokeDashArray', strokeDashArray);
      }
    }

    rescaleLine(obj, zoom, ppp) {
      const targetSize = obj.get('targetSize') || { strokeWidth: 1 };
      const breakScale = obj.get('breakScale');

      const { strokeWidth: targetStrokeWidth, strokeDashArray: targetStrokeDashArray } = targetSize;

      // use a break point to define a maximum scale limit e.g. do not scale beyond this point
      let strokeWidth =
        typeof breakScale !== 'undefined' ? Math.max(targetStrokeWidth, ppp * breakScale) : targetStrokeWidth;

      strokeWidth /= zoom;
      obj.set('strokeWidth', strokeWidth);

      if (targetStrokeDashArray) {
        const strokeDashArray = targetStrokeDashArray.map((val) => {
          return (typeof breakScale !== 'undefined' ? Math.max(val, ppp * breakScale) : val) / zoom;
        });
        obj.set('strokeDashArray', strokeDashArray);
      }
    }

    rescaleShape(obj, zoom, ppp) {
      if (!zoom || !ppp) {
        const scaleInfo = this.getScaleFactor();
        zoom = scaleInfo.zoom;
        ppp = scaleInfo.ppp;
      }

      if (obj.get('scaleType') === 'scale') {
        const type = obj.get('shapeType');
        switch (type) {
          case 'target':
            this.rescaleSymbol(obj, zoom, ppp);
            break;
          case 'trash':
            this.rescaleSymbol(obj, zoom, ppp);
            break;
          case 'rect-line':
            this.rescaleRectLine(obj, zoom, ppp);
            break;
          case 'rectangle':
            this.rescaleRect(obj, zoom, ppp);
            break;
          case 'text':
            this.rescaleText(obj, zoom, ppp);
            break;
          case 'ellipse':
            this.rescaleEllipse(obj, zoom, ppp);
            break;
          case 'controlPoint':
            this.rescaleEllipse(obj, zoom, ppp);
            break;
          case 'polygon':
            this.rescalePolygon(obj, zoom, ppp);
            break;
          case 'line':
            this.rescaleLine(obj, zoom, ppp);
            break;
          case 'image':
            this.rescaleImage(obj, zoom, ppp);
            break;
          default:
            break;
        }

        if (typeof obj.get('onScale') === 'function') {
          obj.get('onScale')(obj);
        }
      }
      obj.setCoords(false);
    }

    rescaleRenderedShapes() {
      const shapeIds = Object.keys(this._shapes);

      // break apart groups for positioning
      const groupReset = {};
      shapeIds.forEach((shapeId) => {
        const obj = this._shapes[shapeId];
        if (obj.get('isGroup')) {
          const groupObjs = obj.getObjects();
          groupReset[shapeId] = { group: obj, shapes: groupObjs };
          // groupObjs.forEach((o) => obj.removeWithUpdate(o));
          groupObjs.forEach((o) => obj.remove(o));
          obj.setCoords();
          this._fabricCanvas.remove(obj);
        }
      });

      // rescale individual shapes
      shapeIds.forEach((shapeId) => {
        const obj = this._shapes[shapeId];
        this.rescaleShape(obj);
      });

      // recreate groupings
      const groupIds = Object.keys(groupReset);
      groupIds.forEach((shapeId) => {
        const groupInfo = groupReset[shapeId];
        const { group, shapes } = groupInfo;
        // shapes.forEach((shape) => group.addWithUpdate(shape));
        shapes.forEach((shape) => group.add(shape));
        group.setCoords();
        this._fabricCanvas.add(group);
      });

      this._fabricCanvas.renderAll();
    }

    getScaleFactor() {
      // resize symbols according to the zoom
      const zoom = this._fabricCanvas.getZoom();
      const base = this.osdViewer.world.getItemAt(0) || this.osdViewer.viewport;
      const scaledImageBounds = base.viewportToImageRectangle(this.osdViewer.viewport.getBounds());
      const containerSize = this.osdViewer.viewport._containerInnerSize;
      const ppp = containerSize.x / scaledImageBounds.width; // screen pixels per image pixel
      const imageZoom = base.viewportToImageZoom(this.osdViewer.viewport.getZoom());

      return { zoom, ppp, imageZoom };
    }

    recreateInternalShapeTrackers(_objects) {
      // Recreate shape map and shapeID state from the loaded shapes
      this._fabricCanvas.getObjects().forEach((shape) => {
        this._shapes[shape.shapeId] = shape;
      });
    }

    loadObject(obj) {
      return new Promise((resolve) => {
        const klass = fabric.util.getKlass(obj.type);
        // patch circle loading https://fabricjs.com/docs/old-docs/v5-breaking-changes/#circle-startangle-and-endangle
        if (parseInt(obj.version.slice(0, 1), 10) < 5) {
          if (obj.type === 'circle') {
            obj.startAngle = fabric.util.radiansToDegrees(obj.startAngle);
            obj.endAngle = fabric.util.radiansToDegrees(obj.endAngle);
          }
        }
        klass.fromObject(obj, (fabricObj) => {
          this._fabricCanvas.add(fabricObj);
          resolve(fabricObj);
        });
      });
    }

    getFabricObjectBounds(objs) {
      if (objs) {
        if (!Array.isArray(objs)) {
          objs = [objs];
        }
        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        objs.forEach((obj) => {
          const bounds = obj.getBoundingRect(true, true);
          if (bounds.left < minX) {
            minX = bounds.left;
          }
          if (bounds.top < minY) {
            minY = bounds.top;
          }

          if (bounds.left + bounds.width > maxX) {
            maxX = bounds.left + bounds.width;
          }
          if (bounds.top + bounds.height > maxY) {
            maxY = bounds.top + bounds.height;
          }
        });

        const topLeft = this.fabricToLineSample(minX, minY);
        const bottomRight = this.fabricToLineSample(maxX, maxY);

        return { topLeft, bottomRight };
      }
    }

    getTransformedPolygonPoints(polygon) {
      const matrix = polygon.calcTransformMatrix();
      const transformedPoints = polygon
        .get('points')
        .map((p) => {
          return new fabric.Point(p.x - polygon.pathOffset.x, p.y - polygon.pathOffset.y);
        })
        .map((p) => {
          return fabric.util.transformPoint(p, matrix);
        });

      const transformedLSPoints = transformedPoints.map((p) => this.fabricToLineSample(p.x, p.y));

      return { transformedPoints, transformedLSPoints };
    }

    getImage(imgPath) {
      return new Promise((resolve, reject) => {
        const cached = this._imageCache[imgPath];
        if (cached) {
          if (cached.complete) {
            resolve(cached);
          } else {
            cached.addEventListener('load', () => {
              resolve(cached);
            });
            cached.addEventListener('error', () => {
              reject(new Error('Failed to load image'));
            });
          }
        } else {
          const img = new Image();
          img.addEventListener('load', () => {
            this._imageCache[imgPath] = img;
            resolve(img);
          });
          img.addEventListener('error', () => {
            reject(new Error(`Failed to load image: ${imgPath}`));
          });
          img.src = imgPath;
        }
      });
    }
  };
