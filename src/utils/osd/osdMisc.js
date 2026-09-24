import { parseWKTString } from 'src/utils';
import { getConfig } from 'src/utils/configRegistry';
// NOTE: requires OSDMiscMixin(OSDFabricMixin(OSDViewer))

export const OSDMiscMixin = (base) =>
  class extends base {
    constructor(options) {
      super(options);

      this._miscShapes = {};

      this.loadAllColorIcons();
    }

    loadAllColorIcons() {
      const config = getConfig();
      config.drawing_presets.colors.forEach((colorStr) => {
        const path = this.getDotIconPathForColor(colorStr, false);
        const invPath = this.getDotIconPathForColor(colorStr, true);
        try {
          this.getImage(path);
        } catch (err) {
          console.warn(`Failed to load icon: ${path}`, err);
        }

        try {
          this.getImage(invPath);
        } catch (err) {
          console.warn(`Failed to load icon: ${invPath}`, err);
        }
      });
    }

    genAreaId(lsBox, prefix = '', suffix = '') {
      return `${prefix}_${lsBox.join(',')}_${suffix}`;
    }

    getPointMark(lsPoint, idSuffix = '') {
      return this._miscShapes[this.genAreaId([lsPoint.sample, lsPoint.line], 'point', idSuffix)];
    }

    getPointMarks(filter) {
      if (!filter) return this._miscShapes;
      const filteredPointMarks = {};
      Object.entries(this._miscShapes).forEach(([key, value]) => {
        if (filter(value)) filteredPointMarks[key] = value;
      });
      return filteredPointMarks;
    }

    addAreaBox(lsBox, blankFill = true, params = {}) {
      const id = this.genAreaId(lsBox, 'area');

      // check for redundance
      if (this._miscShapes[id]) {
        return;
      }

      // placeholder
      this._miscShapes[id] = true;

      this.addShape({
        shapeType: 'polygon',
        params: {
          evented: false,
          selectable: false,
          stroke: '#FFFFFF',
          strokeWidth: 2,
          strokeDashArray: [10, 5],
          fill: `rgba(255,255,255,${blankFill ? '0' : '0.2'})`,
          isNonDrawing: true,
          ...params,
        },
        coords: {
          lsPoints: [
            { sample: lsBox[0], line: lsBox[1] }, // TL
            { sample: lsBox[0], line: lsBox[3] }, // BL
            { sample: lsBox[2], line: lsBox[3] }, // BR
            { sample: lsBox[2], line: lsBox[1] }, // TR
            { sample: lsBox[0], line: lsBox[1] }, // TL
          ],
        },
        scaleInfo: {
          scaleType: 'scale',
          targetSize: {
            strokeWidth: 2,
            strokeDashArray: [10, 5],
          },
        },
      })
        .then((obj) => {
          this._miscShapes[id] = obj;
        })
        .catch((err) => {
          throw err;
        });
    }

    removeAreaBox(lsBox) {
      const id = this.genAreaId(lsBox, 'area');
      const obj = this._miscShapes[id];
      if (obj) {
        this.removeShape(obj);
        delete this._miscShapes[id];
      }
    }

    addPolygonOutlineWKT(wktString, params = {}) {
      const id = wktString;

      // check for redundance
      if (this._miscShapes[id]) {
        return;
      }

      // placeholder
      this._miscShapes[id] = true;

      const geometry = parseWKTString(wktString);
      const lsPoints = geometry.coords.map((x) => {
        return { sample: x[0], line: x[1] };
      });

      this.addShape({
        shapeType: 'polygon',
        params: {
          evented: false,
          selectable: false,
          stroke: '#FFFFFF',
          strokeWidth: 1,
          strokeDashArray: [10, 5],
          fill: 'rgba(255,255,255,0.2)',
          isNonDrawing: true,
          ...params,
        },
        coords: {
          lsPoints,
        },
        scaleInfo: {
          scaleType: 'scale',
          targetSize: {
            strokeWidth: 1,
            strokeDashArray: [10, 5],
          },
        },
      })
        .then((obj) => {
          this._miscShapes[id] = obj;
        })
        .catch((err) => {
          throw err;
        });
    }

    removePolygonOutlineWKT(wktString) {
      const obj = this._miscShapes[wktString];
      if (obj) {
        this.removeShape(obj);
        delete this._miscShapes[wktString];
      }
    }

    outlineLayer(layerId) {
      const osdLayer = this.getLayerById(layerId);
      const baseImage = this.osdViewer.world.getItemAt(0);
      const imageBounds = (baseImage || osdLayer).viewportToImageRectangle(osdLayer.getBounds(true));
      const { x, y, width, height } = imageBounds;
      this.addAreaBox([x, y, x + width, y + height]);
    }

    addPointMark(options) {
      const { lsPoint, opacity = 1, color = '#000000', params = {}, idSuffix = '', size = 10, maxSize = 100 } = options;
      const { line, sample } = lsPoint;
      const id = this.genAreaId([sample, line], 'point', idSuffix);

      // check for redundance
      if (this._miscShapes[id]) {
        return;
      }

      // handle out-of-bounds sizes
      let renderSize = size;
      if (isNaN(size) || size <= 0 || !isFinite(size)) {
        renderSize = maxSize;
      }

      // enforce an overridable max size
      // model the coverage as a square and divide by 2.1 to get the length of each arm with a little margin
      let offsetLen = Math.sqrt(Math.min(renderSize, maxSize)) / 2.1;

      // stroke width is just for visibility
      let strokeWidth = Math.min(offsetLen / 4, 1);

      // placeholder
      this._miscShapes[id] = true;

      // plus-sign points
      const lsPoints = [
        {
          // top
          sample: sample,
          line: line - offsetLen,
        },
        {
          // center
          sample: sample,
          line: line,
        },
        {
          // right
          sample: sample + offsetLen,
          line: line,
        },
        {
          // center
          sample: sample,
          line: line,
        },
        {
          // bottom
          sample: sample,
          line: line + offsetLen,
        },
        {
          // center
          sample: sample,
          line: line,
        },
        {
          // left
          sample: sample - offsetLen,
          line: line,
        },
      ];

      this.addShape({
        shapeType: 'polyline',
        params: {
          strokeWidth: strokeWidth,
          stroke: color,
          opacity,
          colorStr: color,
          evented: true,
          disableShapeEdit: true,
          hasControls: false,
          selectable: false,
          isNonDrawing: true,
          originX: 'center',
          originY: 'center',
          lsPoint: lsPoint, // for center reference
          ...params,
        },
        coords: {
          lsPoints,
        },
      })
        .then((obj) => {
          this._miscShapes[id] = obj;
        })
        .catch((err) => {
          throw err;
        });
    }

    removePointMark(lsPoint, idSuffix = '') {
      const { line, sample } = lsPoint;
      const id = this.genAreaId([sample, line], 'point', idSuffix);
      const obj = this._miscShapes[id];
      if (obj) {
        this.removeShape(obj);
        delete this._miscShapes[id];
      }
    }

    selectPointMark(lsPoint, idSuffix = '') {
      const { line, sample } = lsPoint;
      const id = this.genAreaId([sample, line], 'point', idSuffix);
      const obj = this._miscShapes[id];
      if (obj) {
        this.handleShapeClicked(obj);
      }
    }

    zoomToPointMark(lsPoint, idSuffix = '') {
      const { line, sample } = lsPoint;
      const id = this.genAreaId([sample, line], 'point', idSuffix);
      const obj = this._miscShapes[id];
      if (obj) {
        this.zoomToLineSample(lsPoint);
      }
    }

    setPointMarkColor(lsPoint, colorStr, rerender = true, idSuffix = '') {
      const { line, sample } = lsPoint;
      const id = this.genAreaId([sample, line], 'point', idSuffix);
      const obj = this._miscShapes[id];
      if (obj) {
        obj.set('stroke', colorStr);
        obj.set('colorStr', colorStr);
        obj.moveTo(-1);
        if (rerender) {
          this._fabricCanvas.requestRenderAll();
        }
      }
    }

    async highlightPointMark(lsPoint, idSuffix = '') {
      const { line, sample } = lsPoint;
      const id = this.genAreaId([sample, line], 'point', idSuffix);
      const cloneId = this.genAreaId([sample, line], 'point', `${idSuffix}_clone`);
      const obj = this._miscShapes[id];
      if (obj) {
        // create white outline shape
        let cloneObj = this._miscShapes[cloneId];
        if (!cloneObj) {
          cloneObj = await this.cloneShape(obj);
          cloneObj.set('stroke', '#F8F8F8');
          cloneObj.set('evented', false);
          cloneObj.set('disableShapeEdit', true);
          cloneObj.set('hasControls', false);
          cloneObj.set('selectable', false);
          cloneObj.set('isNonDrawing', true);
          this._miscShapes[cloneId] = cloneObj;
        }

        const scaler = 2;
        const baseStroke = obj.get('strokeWidth');

        // scale up
        cloneObj.scale(scaler + scaler / 8); // extend past points
        cloneObj.set('strokeWidth', baseStroke * scaler);

        // scale up
        obj.scale(scaler);

        // move index to top
        cloneObj.moveTo(-1);
        obj.moveTo(-1);
        this._fabricCanvas.requestRenderAll();
      }
    }

    unhighlightPointMark(lsPoint, idSuffix = '') {
      const { line, sample } = lsPoint;
      const id = this.genAreaId([sample, line], 'point', idSuffix);
      const cloneId = this.genAreaId([sample, line], 'point', `${idSuffix}_clone`);
      const obj = this._miscShapes[id];
      if (obj) {
        // scale down
        obj.scale(1);

        // remove black outline
        const clone = this._miscShapes[cloneId];
        this.removeShape(clone);
        delete this._miscShapes[cloneId];
        this._fabricCanvas.requestRenderAll();
      }
    }

    getDotIconPathForColor(hexColorStr, inverse = false) {
      // image name format: dot_[HEX_COLOR_VALUE].png or dot_[HEX_COLOR_VALUE]_inv.png
      // Capitalize hexColorStr to ensure it matches with filenames
      return `astria_assets/pointicons/dot_${hexColorStr.toUpperCase().replace('#', '').substring(0, 6)}${
        inverse ? '_inv' : ''
      }.png`;
    }
  };
