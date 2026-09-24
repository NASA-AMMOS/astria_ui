import { Point } from 'openseadragon';
import ReactDOM from 'react-dom/client';
import { CrosshairsFineOutlinedIcon, WarningIcon } from 'src/components/common/Icons';
import Tooltip from 'src/components/common/Tooltip';

import { getConfig } from 'src/utils/configRegistry';
export const OSDDataCursorMixin = (base) =>
  class extends base {
    addDataCursor(options) {
      const { lsPoint, cursorOrigin } = options;

      // Update Data Cursor
      if (this.osdViewer.world.getItemCount() > 0) {
        const baseImage = this.osdViewer.world.getItemAt(0);
        const imagePoint = new Point(lsPoint.sample - 0.5, lsPoint.line - 0.5); // convert back to normal pixel space
        const roundedViewportPoint = baseImage.imageToViewportCoordinates(imagePoint);

        window.requestAnimationFrame(() => {
          const overlay = this.osdViewer.getOverlayById('cursor-overlay-container');
          if (overlay) this.osdViewer.removeOverlay('cursor-overlay-container');

          const cursorContainer = document.createElement('div');
          cursorContainer.id = 'cursor-overlay-container';
          const cursor = document.createElement('div');
          cursorContainer.appendChild(cursor);
          cursor.className = `cursorOverlay${options.cursorOrigin === 'MAP' ? ' cursorOverlayMap' : ''}`;

          const el = (
            <>
              <CrosshairsFineOutlinedIcon
                style={{
                  width: '27px',
                  height: '27px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
              {cursorOrigin === 'MAP' && (
                <Tooltip overlay="Position estimated from orbital coordinates" placement="top">
                  <WarningIcon className="cursorUncertaintyWarning" />
                </Tooltip>
              )}
            </>
          );

          const root = ReactDOM.createRoot(cursor);
          root.render(el);

          this.osdViewer.addOverlay({
            element: cursorContainer,
            location: roundedViewportPoint,
          });
        });
      }
    }

    handleMouseMove(event) {
      super.handleMouseMove(event);
      // this.placeCursorFromEvent(event); // Disable DN Streaming for 7.1
    }

    handleClickEvent(event) {
      super.handleClickEvent(event);
      this.placeCursorFromEvent(event);
    }

    removeDataCursor() {
      if (this.osdViewer.getOverlayById('cursor-overlay-container')) {
        this.osdViewer.removeOverlay('cursor-overlay-container');
      }
    }

    placeCursorFromEvent(event) {
      // check that we have a base image
      if (
        !event.originalEvent.ctrlKey ||
        this.osdViewer.world.getItemCount() === 0 ||
        this._viewMode !== getConfig().interaction_modes.view_only
      ) {
        return;
      }

      // Retrieve current coordinates
      // The canvas-click event gives us a position in web coordinates. Convert to viewport
      const webPoint = event.position;
      const viewportPoint = this.osdViewer.viewport.pointFromPixel(webPoint);

      const baseImage = this.osdViewer.world.getItemAt(0);
      if (baseImage.getBounds().containsPoint(viewportPoint)) {
        const lsPoint = this.osdToLineSample(webPoint.x, webPoint.y, true, false);

        this.addDataCursor({ lsPoint });

        this.dispatch('datacursoradded', { lsPoint, valid: true });
      } else {
        this.removeDataCursor();

        this.dispatch('datacursoradded', { valid: false });
      }
    }
  };
