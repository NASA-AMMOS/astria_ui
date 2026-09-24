// import OpenSeaDragon from '../../externals/openseadragon/openseadragon-custom';
import OpenSeaDragon from 'openseadragon';
import { getConfig } from 'src/utils/configRegistry';
import { getPropFromProduct } from 'src/utils/sharedUtils';
// NOTE: requires OSDAzElRulersMixin(OSDViewer)

export const OSDAzElRulersMixin = (base) =>
  class extends base {
    constructor(options) {
      super(options);

      this.rulersActive = false;
      this._rulerWidth = 24;
    }

    setRulerWidth(width) {
      this._rulerWidth = width;
    }

    getRulerWidth() {
      return this._rulerWidth;
    }

    addRulers() {
      this.removeRulers();
      this.rulersActive = true;

      this.osdViewer.addHandler('update-viewport', this.renderRulers);
      this.setRulerMargin(true);
      this.osdViewer.forceRedraw();
    }

    removeRulers() {
      this.rulersActive = false;
      this.osdViewer.removeHandler('update-viewport', this.renderRulers);
      this.setRulerMargin(false);
      this.osdViewer.forceRedraw();
    }

    setRulerMargin(on) {
      const margin = on ? this._rulerWidth : 0;
      this.osdViewer.viewport.setMargins({ top: margin, left: margin });
    }

    renderRulers = () => {
      const config = getConfig();
      const baseImage = this.baseImage;

      // Check that there is a source before drawing rulers
      if (
        !baseImage ||
        !this.rulersActive ||
        !this.osdViewer.source ||
        !this.osdViewer.source.width ||
        !this.osdViewer.source.height
      ) {
        return;
      }

      // check if we can resolve the base images
      const osdBaseImage = this.osdViewer.world.getItemAt(0);
      if (!osdBaseImage) return;

      const MAP_RESOLUTION = parseFloat(getPropFromProduct(baseImage, config.es_mappings.map_resolution, -1));
      const START_AZIMUTH = parseFloat(getPropFromProduct(baseImage, config.es_mappings.start_azimuth, -1));
      const ZERO_ELEVATION_LINE = parseFloat(getPropFromProduct(baseImage, config.es_mappings.zero_elevation_line, -1));

      // Get relevant dimensions
      const imgBounds = new OpenSeaDragon.Rect(0, 0, this.osdViewer.source.width, this.osdViewer.source.height);
      const topLeft = osdBaseImage.imageToViewerElementCoordinates(imgBounds.getTopLeft());
      const bottomRight = osdBaseImage.imageToViewerElementCoordinates(imgBounds.getBottomRight());

      // We only want the visible portion so we have to 'clip' the sizes to the area of the canvas
      topLeft.x = Math.max(0, topLeft.x);
      topLeft.y = Math.max(0, topLeft.y);
      const containerSize = this.osdViewer.viewport.getContainerSize();
      bottomRight.x = Math.min(containerSize.x - 1, bottomRight.x);
      bottomRight.y = Math.min(containerSize.y - 1, bottomRight.y);

      // Must scale for device pixel ratio but maintain original values to use to convert between viewport and image
      // coordinate systems.
      const scale = window.devicePixelRatio;

      const canvas = this.osdViewer.drawer.canvas;

      this.drawRulers({
        canvas,
        scale,
        unscaledRulerWidth: this._rulerWidth,
        topLeft,
        bottomRight,
        MAP_RESOLUTION,
        START_AZIMUTH,
        ZERO_ELEVATION_LINE,
        azTransform: (az) => osdBaseImage.viewerElementToImageCoordinates(new OpenSeaDragon.Point(az, 0)),
        elTransform: (el) => osdBaseImage.viewerElementToImageCoordinates(new OpenSeaDragon.Point(0, el)),
      });
    };

    drawRulers(options) {
      let {
        canvas,
        elTransform,
        azTransform,
        scale,
        unscaledRulerWidth,
        fontSize,
        topLeft,
        bottomRight,
        MAP_RESOLUTION,
        START_AZIMUTH,
        ZERO_ELEVATION_LINE,
      } = options;

      const ctx = canvas.getContext('2d');

      unscaledRulerWidth = unscaledRulerWidth || this._rulerWidth;
      const rulerWidth = unscaledRulerWidth * scale;
      const scaledTopLeft = { x: topLeft.x * scale, y: topLeft.y * scale };
      const scaledBottomRight = { x: bottomRight.x * scale, y: bottomRight.y * scale };
      const scaledWidth = scaledBottomRight.x - scaledTopLeft.x;
      const scaledHeight = scaledBottomRight.y - scaledTopLeft.y;
      const width = bottomRight.x - topLeft.x;
      const height = bottomRight.y - topLeft.y;

      // styling
      fontSize = fontSize || Math.round(unscaledRulerWidth * 0.45);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 1 * scale;
      ctx.font = 'normal bold ' + fontSize * scale + 'px Inter';

      // Draw ruler
      ctx.fillStyle = '#252C30';
      ctx.beginPath();
      ctx.fillRect(0, 0, rulerWidth, canvas.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.fillRect(0, 0, canvas.width, rulerWidth);
      ctx.stroke();

      // Draw ruler top left edges
      ctx.strokeStyle = '#444C50';
      ctx.beginPath();
      ctx.moveTo(0, rulerWidth);
      ctx.lineTo(rulerWidth, rulerWidth);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(rulerWidth, 0);
      ctx.lineTo(rulerWidth, rulerWidth);
      ctx.stroke();

      // Draw ruler border lines
      ctx.strokeStyle = '#515151'; // stroke
      ctx.beginPath();
      ctx.moveTo(rulerWidth, rulerWidth);
      ctx.lineTo(canvas.width, rulerWidth);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(rulerWidth, rulerWidth);
      ctx.lineTo(rulerWidth, canvas.height);
      ctx.stroke();

      // Decide how many ticks to draw
      const tickLength = Math.min(5, fontSize / 2) * scale;
      const tickLabelLocation = Math.round(fontSize * scale);
      const minTickSpacing = 50;
      const increment_x = Math.max(Math.round(scaledWidth / 10), minTickSpacing * scale);
      const increment_y = Math.max(Math.round(scaledHeight / 10), minTickSpacing * scale);

      //
      // Draw tick marks and labels
      //
      ctx.strokeStyle = '#C4C4C4';
      ctx.fillStyle = '#A8AAAB';
      ctx.lineWidth = 1 * scale;
      // AZIMUTH
      let unscaled_i = Math.max(topLeft.x, unscaledRulerWidth); // don't include image cut off by rulers
      const unscaled_i_increment = Math.max(Math.round(width / 10), minTickSpacing);
      const i_start = Math.max(scaledTopLeft.x, rulerWidth); // don't include image cut off by rulers
      let azimuth_values = [];
      for (let i = i_start; i < scaledTopLeft.x + scaledWidth; i += increment_x) {
        // draw tick
        ctx.beginPath();
        ctx.moveTo(i, rulerWidth - 1.5);
        ctx.lineTo(i, rulerWidth - tickLength);
        ctx.stroke();

        // calculate azimuth and add to list
        const imgCoord = azTransform ? azTransform(unscaled_i) : unscaled_i;
        const azimuth = imgCoord.x / MAP_RESOLUTION + START_AZIMUTH;
        azimuth_values.push({ pixel: i, az: parseFloat(azimuth).toFixed(1) });
        unscaled_i += unscaled_i_increment;
      }
      // If the user is zoomed to a small az range, keep one decimal place to avoid repeated integers.
      // If not, round off the decimal.
      if (azimuth_values.length <= 2 || Math.abs(azimuth_values[0].az - azimuth_values[1].az) > 1.5) {
        azimuth_values.forEach((x) => (x.az = Math.round(x.az)));
      }
      // draw labels
      azimuth_values.forEach((x) => {
        const label = x.az + '°';
        ctx.fillText(label, x.pixel, tickLabelLocation);
      });

      // ELEVATION
      let unscaled_j = Math.max(topLeft.y, unscaledRulerWidth);
      const unscaled_j_increment = Math.max(Math.round(height / 10), minTickSpacing);
      const j_start = Math.max(scaledTopLeft.y, rulerWidth); // don't include image cut off by rulers
      const elevation_values = [];
      ctx.fillStyle = '#C4C4C4';
      for (let j = j_start; j < scaledTopLeft.y + scaledHeight; j += increment_y) {
        // draw tick
        ctx.beginPath();
        ctx.moveTo(rulerWidth - 1.5, j);
        ctx.lineTo(rulerWidth - tickLength, j);
        ctx.stroke();

        // calculate elevation and add to list
        const imgCoord = elTransform ? elTransform(unscaled_j) : unscaled_j;
        const elevation = (ZERO_ELEVATION_LINE - imgCoord.y) / MAP_RESOLUTION;
        elevation_values.push({ pixel: j, el: parseFloat(elevation).toFixed(1) });
        unscaled_j += unscaled_j_increment;
      }
      // If the user is zoomed to a small elevation range, keep one decimal place to avoid repeated integers.
      // If not, round off the decimal.
      if (elevation_values.length <= 2 || Math.abs(elevation_values[0].el - elevation_values[1].el) > 1.5) {
        elevation_values.forEach((x) => (x.el = Math.round(x.el)));
      }
      // draw labels
      elevation_values.forEach((x) => {
        const label = x.el + '°';
        // rotate labels and draw
        ctx.save();
        ctx.translate(tickLabelLocation, x.pixel);
        ctx.rotate((Math.PI / 2) * 3);
        ctx.translate(tickLabelLocation * -1, x.pixel * -1);
        ctx.fillStyle = '#A8AAAB';
        ctx.fillText(label, tickLabelLocation, x.pixel);
        ctx.restore();
      });
    }
  };
