import classNames from 'classnames';
import config from 'config.js';
import { Field, Form, Formik } from 'formik';
import React, { Component } from 'react';
import PrismaZoom from 'react-prismazoom';
import OpenSeaDragonWrapper from 'src/components/OpenSeaDragonWrapper';
import PDFViewer from 'src/components/activeProduct/PDFViewer';
import Button from 'src/components/common/Button';
import ControlsOverlay from 'src/components/common/ControlsOverlay';
import {
  CheckIcon,
  CloudDownloadIcon,
  CollapseIcon,
  HomeIcon,
  MaximizeIcon,
  MinusIcon,
  PlusIcon,
  RotateCCWIcon,
  RotateCWIcon,
  SettingsIcon,
  SpinnerIcon,
  SwitchIcon,
  ThreeDotIcon,
} from 'src/components/common/Icons';
import Toggle from 'src/components/common/Toggle';
import Tooltip from 'src/components/common/Tooltip';
import renderedImagePaneStyles from 'src/styles/RenderedImagePane.module.css';
import TypographyStyles from 'src/styles/common/typography.module.css';
import {
  enterFullscreen,
  exitFullscreen,
  getProductFileType,
  isCustomProduct,
  isFullscreen,
  isOSDViewableFileType,
  isTarget,
  round,
} from 'src/utils';
import { scaleDataSupported } from 'src/utils/dataQuery';
import { datadriveGetOCSObjectDownloadPath } from 'src/utils/endpoints';
import { getPropFromProduct } from 'src/utils/sharedUtils';

class RenderedImagePane extends Component {
  constructor(props) {
    super(props);
    this.containerNodeRef = React.createRef();
    this.gifRendererRef = React.createRef();
    this.osdRef = React.createRef();
    this.controlsToolbarRef = React.createRef();
    this.LOCALSTORAGE_ENABLE_NAVIGATOR_KEY = 'enableNavigator';
    this.LOCALSTORAGE_ENABLE_IMAGE_SMOOTHING_KEY = 'enableImageSmoothing';
    this.LOCALSTORAGE_ENABLE_SCALEBAR = 'enableScalebar';
    this.LOCALSTORAGE_ENABLE_RULERS = 'enableRulers';
    this.state = {
      rulersActive: localStorage.getItem(this.LOCALSTORAGE_ENABLE_RULERS) !== 'false',
      scalebarActive: localStorage.getItem(this.LOCALSTORAGE_ENABLE_SCALEBAR) !== 'false',
      navigatorActive: localStorage.getItem(this.LOCALSTORAGE_ENABLE_NAVIGATOR_KEY) !== 'false',
      enableImageSmoothing: localStorage.getItem(this.LOCALSTORAGE_ENABLE_IMAGE_SMOOTHING_KEY) === 'true', // default to false
      isFullscreen: false,
      mouseAzEl: false,
    };
  }

  componentDidMount() {
    document.addEventListener('fullscreenchange', this.updateIsFullscreen);
    document.addEventListener('mozfullscreenchange', this.updateIsFullscreen);
    document.addEventListener('webkitfullscreenchange', this.updateIsFullscreen);
    document.addEventListener('msfullscreenchange', this.updateIsFullscreen);
    window.addEventListener('keydown', (evt) => {
      if (evt.target.tagName.toUpperCase() !== 'INPUT' && evt.target.tagName.toUpperCase() !== 'TEXTAREA') {
        if (evt.keyCode === 48) {
          // 0
          this.setOSDZoom(-1);
        } else if (evt.keyCode === 49) {
          // 1
          this.setOSDZoom(100);
        }
      }
    });
    this.connectResizeObserver();

    // Initialize listeners for GIF renderer
    document.addEventListener('keyup', (event) => {
      const { isGIF } = getProductFileType(this.props.baseImage);
      if (isGIF) {
        if (event.target.nodeName === 'INPUT' || event.target.nodeName === 'TEXTAREA') return; // ignore events coming from inputs
        if (event.key === '-') this.zoomOut();
        if (event.key === '=') this.zoomIn();
        if (event.key === '0') this.resetView();
      }
    });
  }

  componentDidUpdate(prevProps, prevState) {
    // TODO - restructure so that this is not called on zoom/pan
    let { rulersActive, scalebarActive, enableImageSmoothing, isFullscreen } = this.state;
    const { baseImage, groups, resetViewOnlyMode } = this.props;

    const baseImageChanged =
      !getPropFromProduct(prevProps.baseImage, config.es_mappings.id, null) ||
      !getPropFromProduct(baseImage, config.es_mappings.id, null) ||
      getPropFromProduct(prevProps.baseImage, config.es_mappings.overlay_id, null) !==
        getPropFromProduct(baseImage, config.es_mappings.overlay_id, null);

    const groupIDChanged =
      !getPropFromProduct(prevProps.baseImage, config.es_mappings.group_id, null) ||
      !getPropFromProduct(baseImage, config.es_mappings.group_id, null) ||
      getPropFromProduct(prevProps.baseImage, config.es_mappings.group_id, null) !==
        getPropFromProduct(baseImage, config.es_mappings.group_id, null);

    if (this.osdRef) {
      // add/remove rulers if rulersActive state changes or if base image changes
      if (rulersActive !== prevState.rulersActive || baseImageChanged) {
        if (rulersActive && getPropFromProduct(baseImage, config.es_mappings.projection) === 'Cylindrical') {
          this.osdRef.current.addRulers();
        } else {
          this.osdRef.current.removeRulers();
        }
      }

      if (
        getPropFromProduct(baseImage, config.es_mappings.projection) !==
        getPropFromProduct(prevProps.baseImage, config.es_mappings.projection)
      ) {
        // When projection changes, use mouseAzEl for mouse position label if projection is Cylindrical
        this.setState({ mouseAzEl: getPropFromProduct(baseImage, config.es_mappings.projection) === 'Cylindrical' });
      }

      // reset the scalebar, clear measurements, and shapes when we switch the overlay_id group
      if (baseImageChanged) {
        this.osdRef.current.resetScalebars();
        this.osdRef.current.clearAllMeasurements();
        this.osdRef.current.clearAllShapes();
      }

      // add/remove scalebar
      // TODO this is currently being done every time this function runs which is bad
      // but the fix involves adding the scalebar after the base image has loaded into OSD
      // (not to be confused with all the tile requests being complete). If this fix is made
      // we also will need to add the scalebar, if needed, on first image load.

      // if (scalebarActive !== prevState.scalebarActive || baseImageChanged) {
      if (scalebarActive && scaleDataSupported(baseImage, groups)) {
        this.osdRef.current.showScalebars();
      } else {
        this.osdRef.current.hideScalebars();
      }
      // }

      // start/stop measuring/annotating
      if (this.props.interactionMode !== prevProps.interactionMode) {
        const activeAnnotation = this.props.activeAnnotation;
        const activeAnnotationId = activeAnnotation.annotation_id;
        const activeAnnotationOpacity = activeAnnotation.opacity;
        switch (this.props.interactionMode) {
          case config.interaction_modes.view_only:
            this.osdRef.current.stopMeasuring();
            this.osdRef.current.stopDrawing();
            this.osdRef.current.disableShapeInteractions();
            this.osdRef.current.enableFootprintInteractions();
            break;
          case config.interaction_modes.measure:
            this.osdRef.current.stopDrawing();
            this.osdRef.current.disableShapeInteractions();
            this.osdRef.current.disableFootprintInteractions();
            this.osdRef.current.startMeasuring();
            break;
          case config.interaction_modes.edit:
            this.osdRef.current.stopMeasuring();
            this.osdRef.current.stopDrawing();
            this.osdRef.current.enableShapeInteractions(activeAnnotationId);
            this.osdRef.current.disableFootprintInteractions();
            break;
          default:
            // drawing
            // this.osdRef.current.enableShapeInteractions(activeAnnotationId);
            this.osdRef.current.stopMeasuring();
            this.osdRef.current.startDrawing(this.props.interactionMode, activeAnnotationId, activeAnnotationOpacity);
            this.osdRef.current.disableFootprintInteractions();
        }
      }

      // clear the data cursor
      if (!this.props.cursorActive && prevProps.cursorActive) {
        this.osdRef.current.removeDataCursor();
      }

      if (enableImageSmoothing !== prevState.enableImageSmoothing) {
        this.osdRef.current.setImageSmoothingEnabled(enableImageSmoothing);
      }

      // handle fullscreen
      if (isFullscreen !== prevState.isFullscreen) {
        resetViewOnlyMode();
      }

      // Handle image change by resetting rotation
      if (groupIDChanged) {
        this.osdRef.current.osdWrapper.resetRotation();
      }
    }
  }

  connectResizeObserver() {
    this.resizeObserver = new ResizeObserver((entries) => {
      window.requestAnimationFrame(() => {
        const width = entries[0].contentRect.width;
        let toolbarOverflowLevel = 0;
        const { isGIF } = getProductFileType(this.props.baseImage);
        const level1Width = isGIF ? 210 : 760;
        const level2Width = isGIF ? 195 : 610;
        if (width < level1Width) {
          if (width < level2Width) toolbarOverflowLevel = 2;
          else toolbarOverflowLevel = 1;
        }
        this.setState({ toolbarOverflowLevel });
      });
    });

    // Observe our wrapper element for changes in size
    this.resizeObserver.observe(this.controlsToolbarRef.current);
  }

  setOSDZoom(zoom, center, immediately = false) {
    zoom = (zoom || -1) / 100;
    this.props.updateViewport({ zoom, center }, true, immediately);
  }

  setDefaultZoom() {
    if (this.props.defaultZoom === null) {
      this.setOSDZoom(100);
    }
    this.props.setDefaultZoom(typeof this.props.defaultZoom === 'number' ? null : 1);
  }

  renderZoomControlsMenu() {
    const { zoom } = this.props;
    return (
      <div className={renderedImagePaneStyles.zoomMenu}>
        <Formik
          enableReinitialize
          initialValues={{ zoom: round((zoom || 0) * 100, 2) }}
          onSubmit={(values, { setSubmitting }) => {
            this.setOSDZoom(values.zoom);
            setSubmitting(false);
          }}
        >
          {() => (
            <Form noValidate autoComplete="off" className={renderedImagePaneStyles.zoomInputForm}>
              <Field name="zoom">
                {({ field }) => {
                  const { value, ...otherFieldProps } = field;
                  return (
                    <>
                      <div className={renderedImagePaneStyles.zoomInputLabel}>zoom settings</div>
                      <div className={renderedImagePaneStyles.zoomInputContainer}>
                        <input
                          aria-label="Zoom percentage"
                          min={0}
                          max={5000}
                          step="5"
                          type="number"
                          className={renderedImagePaneStyles.zoomInput}
                          value={value}
                          {...otherFieldProps}
                        />
                        <span className={renderedImagePaneStyles.inputIconRight}>%</span>
                      </div>
                    </>
                  );
                }}
              </Field>
            </Form>
          )}
        </Formik>
        <Button
          full
          text="Zoom to Fit"
          variant="menuItem"
          rightIcon={<span>0</span>}
          onClick={() => {
            this.setOSDZoom(-1);
          }}
        />
        <Button
          full
          text="Zoom to 50%"
          variant="menuItem"
          onClick={() => {
            this.setOSDZoom(50);
          }}
        />
        <Button
          full
          text="Zoom to 100%"
          variant="menuItem"
          rightIcon={<span>1</span>}
          onClick={() => {
            this.setOSDZoom(100);
          }}
        />
        <Button
          full
          text="Zoom to 200%"
          variant="menuItem"
          onClick={() => {
            this.setOSDZoom(200);
          }}
        />
        <Button
          full
          text="Zoom to 500%"
          variant="menuItem"
          onClick={() => {
            this.setOSDZoom(500);
          }}
        />

        <div className={renderedImagePaneStyles.zoomDefault}>
          <div className={TypographyStyles.label}>Default 100% Zoom</div>
          <Toggle on={typeof this.props.defaultZoom === 'number'} onChange={() => this.setDefaultZoom()} />
        </div>
      </div>
    );
  }

  renderSettingsMenu() {
    const { baseImage, groups } = this.props;
    const { enableImageSmoothing, scalebarActive, rulersActive, navigatorActive } = this.state;

    const azElSupported = getPropFromProduct(baseImage, config.es_mappings.projection) === 'Cylindrical';
    const scalebarSupported = scaleDataSupported(baseImage, groups);

    return (
      <div className={renderedImagePaneStyles.settingsMenu}>
        <div className={renderedImagePaneStyles.zoomInputLabel}>Image Viewer Settings</div>
        <div className={renderedImagePaneStyles.settingsMenuContent}>
          <Toggle on={navigatorActive} label="Show Navigator" onChange={this.toggleNavigator} />
          {azElSupported && <Toggle on={rulersActive} label="Show Az/El Guides" onChange={this.toggleRulers} />}
          {scalebarSupported && <Toggle on={scalebarActive} label="Show Scalebar" onChange={this.toggleScalebar} />}
          <Toggle on={enableImageSmoothing} label="Enable Image Smoothing" onChange={this.toggleImageSmoothing} />
        </div>
      </div>
    );
  }

  toggleFullscreen = () => {
    if (isFullscreen()) {
      exitFullscreen();
    } else if (this.containerNodeRef) {
      enterFullscreen(this.containerNodeRef.current);
    }
  };

  updateIsFullscreen = () => {
    this.setState({ isFullscreen: isFullscreen() });
  };

  toggleScalebar = () => {
    const { scalebarActive } = this.state;
    localStorage.setItem(this.LOCALSTORAGE_ENABLE_SCALEBAR, !scalebarActive);
    this.setState({ scalebarActive: !scalebarActive });
  };

  toggleRulers = () => {
    const { rulersActive } = this.state;
    localStorage.setItem(this.LOCALSTORAGE_ENABLE_RULERS, !rulersActive);
    this.setState({ rulersActive: !rulersActive });
  };

  toggleImageSmoothing = () => {
    const { enableImageSmoothing } = this.state;
    localStorage.setItem(this.LOCALSTORAGE_ENABLE_IMAGE_SMOOTHING_KEY, !enableImageSmoothing);
    this.setState({ enableImageSmoothing: !enableImageSmoothing });
  };

  toggleNavigator = () => {
    const { navigatorActive } = this.state;
    localStorage.setItem(this.LOCALSTORAGE_ENABLE_NAVIGATOR_KEY, !navigatorActive);
    this.setState({ navigatorActive: !navigatorActive });
  };

  zoomIn = () => {
    const { isGIF } = getProductFileType(this.props.baseImage);
    if (isGIF && this.gifRendererRef.current) {
      const zoom = this.gifRendererRef.current.getZoom();
      this.gifRendererRef.current.zoomIn(zoom / 2);
    } else if (this.osdRef) this.osdRef.current.osdWrapper.zoomIn();
  };

  zoomOut = () => {
    const { isGIF } = getProductFileType(this.props.baseImage);
    if (isGIF && this.gifRendererRef.current) {
      const zoom = this.gifRendererRef.current.getZoom();
      this.gifRendererRef.current.zoomOut(zoom / 2);
    } else if (this.osdRef) this.osdRef.current.osdWrapper.zoomOut();
  };

  rotateLeft = () => {
    if (this.osdRef) this.osdRef.current.osdWrapper.rotateLeft();
  };

  rotateRight = () => {
    if (this.osdRef) this.osdRef.current.osdWrapper.rotateRight();
  };

  resetView = () => {
    const { isGIF } = getProductFileType(this.props.baseImage);
    if (isGIF && this.gifRendererRef.current) {
      this.gifRendererRef.current.reset();
    } else if (this.osdRef) this.osdRef.current.osdWrapper.resetView();
  };

  onFirstImageLoaded = () => {
    const {
      onFirstImageLoaded,
      initialZoom,
      initialRotation,
      initialCenter,
      initialMeasurements,
      initialScalebars,
      cursorActive,
      cursorLine,
      cursorSample,
      cursorOrigin,
    } = this.props;
    if (this.osdRef) {
      if (initialZoom) {
        this.setOSDZoom(initialZoom * 100, initialCenter, true);
      }

      if (initialRotation) {
        this.osdRef.current.osdWrapper.setRotation(initialRotation);
      }

      if (initialMeasurements) {
        initialMeasurements.forEach((m) => {
          this.osdRef.current.addMeasurement(m.point1, m.point2);
        });
      }

      if (initialScalebars) {
        initialScalebars.forEach((s) => {
          this.osdRef.current.addScalebar(s.point, s.pinToScreen);
        });
        this.osdRef.current.osdWrapper.autoAddScalebar = true;
      }

      if (cursorActive) {
        this.osdRef.current.addDataCursor({ line: cursorLine, sample: cursorSample }, cursorOrigin);
      }
    }
    onFirstImageLoaded();
  };

  onViewportChange = (viewport) => {
    this.props.updateViewport(viewport, false, false);
  };

  addDataCursor = (product, imageX, imageY) => {
    this.props.addDataCursor(product, imageX, imageY);
  };

  onMouseMove = (imageX, imageY) => {
    this.props.onMouseMove(imageX, imageY);
  };

  // Local stretching on image - this happens every time resetWorld is called
  brightnessStretchTransform = (inputImage) => {
    const { stretchMin, stretchMax, stretchMode } = this.props;

    // if image is being stretched on backend, local stretch is 0-255
    let localStretchMin = stretchMin;
    let localStretchMax = stretchMax;
    if (stretchMode !== 'local') {
      localStretchMin = 0;
      localStretchMax = 255;
    }

    for (let i = 0, n = inputImage.length; i < n; i += 4) {
      inputImage[i] = this.stretchBrightness(inputImage[i], localStretchMin, localStretchMax);
      inputImage[i + 1] = this.stretchBrightness(inputImage[i + 1], localStretchMin, localStretchMax);
      inputImage[i + 2] = this.stretchBrightness(inputImage[i + 2], localStretchMin, localStretchMax);
    }

    return inputImage;
  };

  stretchBrightness(color, minRange, maxRange) {
    return ((color - minRange) / (maxRange - minRange)) * 255;
  }

  renderMobileMetadataDisplay() {
    const { baseImage } = this.props;
    const productFilename = baseImage ? getPropFromProduct(baseImage, config.es_mappings.filename, null) : null;
    const isImageCustomProduct = isCustomProduct(baseImage);
    const productTitle = isImageCustomProduct
      ? getPropFromProduct(baseImage, config.es_mappings.filename)
      : getPropFromProduct(baseImage, config.es_mappings.instrument_id);
    const time1 = getPropFromProduct(baseImage, config.es_mappings.time1);
    const site = getPropFromProduct(baseImage, config.es_mappings.site);
    const drive = getPropFromProduct(baseImage, config.es_mappings.drive);
    const flight = getPropFromProduct(baseImage, config.es_mappings.flight);
    const createdBy = getPropFromProduct(baseImage, config.es_mappings.created_by);
    const metadataItems = [];

    if (typeof time1 === 'number')
      metadataItems.push(
        <div key={`${productFilename}_sol`} className={renderedImagePaneStyles.metadataItem}>
          {/* TODO make the name of time1 configurable */}
          Sol: <span className={renderedImagePaneStyles.mobileImageMetadataItemValue}>{time1}</span>
        </div>
      );

    if (isImageCustomProduct) {
      if (typeof createdBy === 'string')
        metadataItems.push(
          <div key={`${productFilename}_owner`} className={renderedImagePaneStyles.metadataItem}>
            Owner: <span className={renderedImagePaneStyles.mobileImageMetadataItemValue}>{createdBy}</span>
          </div>
        );
    } else {
      if (typeof site === 'number')
        metadataItems.push(
          <div key={`${productFilename}_site`} className={renderedImagePaneStyles.metadataItem}>
            Site: <span className={renderedImagePaneStyles.mobileImageMetadataItemValue}>{site}</span>
          </div>
        );
      if (typeof drive === 'number')
        metadataItems.push(
          <div key={`${productFilename}_drive`} className={renderedImagePaneStyles.metadataItem}>
            Drive: <span className={renderedImagePaneStyles.mobileImageMetadataItemValue}>{drive}</span>
          </div>
        );
      if (typeof flight === 'number')
        metadataItems.push(
          <div key={`${productFilename}_flight`} className={renderedImagePaneStyles.metadataItem}>
            Flight: <span className={renderedImagePaneStyles.mobileImageMetadataItemValue}>{flight}</span>
          </div>
        );
    }
    if (!productFilename) return <></>;
    return (
      <div className={renderedImagePaneStyles.mobileImageMetadata}>
        <div className={renderedImagePaneStyles.mobileImageMetadataTitle}>{productTitle}</div>
        <div className={renderedImagePaneStyles.mobileImageMetadataRow}>{metadataItems}</div>
        <div className={renderedImagePaneStyles.mobileImageMetadataFilename}>{productFilename}</div>
      </div>
    );
  }

  renderMousePosition() {
    const { mouseAzEl } = this.state;
    const { baseImage, currentLine, currentSample } = this.props;

    const MAP_RESOLUTION = parseFloat(getPropFromProduct(baseImage, config.es_mappings.map_resolution, -1));
    const START_AZIMUTH = parseFloat(getPropFromProduct(baseImage, config.es_mappings.start_azimuth, -1));
    const ZERO_ELEVATION_LINE = parseFloat(getPropFromProduct(baseImage, config.es_mappings.zero_elevation_line, -1));

    const azimuth = (line) => line / MAP_RESOLUTION + START_AZIMUTH;
    const elevation = (sample) => (ZERO_ELEVATION_LINE - sample) / MAP_RESOLUTION;

    const mousePositionLabelUnits = !mouseAzEl ? 'L/S' : 'Az/El';
    const mousePositionLabelRoundTo = 3;
    const mousePositionLabel = !mouseAzEl
      ? `${round(currentLine, mousePositionLabelRoundTo)}, ${round(currentSample, mousePositionLabelRoundTo)}`
      : `${parseFloat(azimuth(currentSample)).toFixed(mousePositionLabelRoundTo) + '°'}, ${
          parseFloat(elevation(currentLine)).toFixed(mousePositionLabelRoundTo) + '°'
        }`;

    return (
      <span>
        {getPropFromProduct(baseImage, config.es_mappings.projection) === 'Cylindrical' && (
          <Tooltip
            overlay={this.state.mouseAzEl ? 'Use Line/Sample' : 'Use Az/El'}
            placement="top"
            getTooltipContainer={() => this.containerNodeRef.current}
          >
            <Button
              aria-label={this.state.mouseAzEl ? 'Use Line/Sample' : 'Use Az/El'}
              className={renderedImagePaneStyles.controlButton}
              icon={<SwitchIcon />}
              type="button"
              variant="icon"
              onClick={() => this.setState({ mouseAzEl: !this.state.mouseAzEl })}
            />
          </Tooltip>
        )}
        <div className={renderedImagePaneStyles.spacer} />
        <div className={renderedImagePaneStyles.mousePositionLabel}>
          <div className={renderedImagePaneStyles.mousePositionLabelUnits}>{mousePositionLabelUnits} :&nbsp;</div>
          <div className={renderedImagePaneStyles.mousePositionLabelValue}>{mousePositionLabel}</div>
        </div>
      </span>
    );
  }

  renderLoadingIndicator() {
    const { activeOverlays, layerLoadingStates } = this.props;

    // Separate out tile based layers
    const imageLayers = activeOverlays.filter((overlay) => !isTarget(overlay));

    const tooltipOverlay = (
      <div className={renderedImagePaneStyles.loadingTooltipInner}>
        <div className={renderedImagePaneStyles.loadingTooltipTitle}>Layers Loading</div>
        <div className={renderedImagePaneStyles.loadingTooltipContent}>
          {imageLayers.map((layer, i) => {
            const isLoaded = layerLoadingStates[getPropFromProduct(layer, config.es_mappings.id)];
            const prefix = i === 0 ? 'Base Image' : 'RDR';
            const label = getPropFromProduct(layer, config.es_mappings.product_type);

            const iconClasses = classNames({
              [renderedImagePaneStyles.loadingTooltipItemIcon]: true,
              [renderedImagePaneStyles.loadingTooltipItemIconDone]: isLoaded,
            });
            return (
              <div key={`image_loading_${i}`} className={renderedImagePaneStyles.loadingTooltipItem}>
                <div className={iconClasses}>{isLoaded ? <CheckIcon /> : <CloudDownloadIcon />}</div>
                <div className={renderedImagePaneStyles.loadingTooltipItemPrefix}>{prefix}</div>
                <div className={renderedImagePaneStyles.loadingTooltipItemSeparator}>/</div>
                <div className={renderedImagePaneStyles.loadingTooltipItemLabel}>{label}</div>
              </div>
            );
          })}
        </div>
      </div>
    );

    return (
      <Tooltip
        className={renderedImagePaneStyles.loadingTooltip}
        placement="top"
        overlay={tooltipOverlay}
        mouseEnterDelay={0.5}
        mouseLeaveDelay={0.25}
      >
        <div className={renderedImagePaneStyles.loadingWrapper}>
          <div className={renderedImagePaneStyles.loadingIndicator}>
            <SpinnerIcon />
          </div>
          <div className={renderedImagePaneStyles.loadingText}>Loading Tiles...</div>
        </div>
      </Tooltip>
    );
  }

  render() {
    const { toolbarOverflowLevel, navigatorActive, enableImageSmoothing, isFullscreen } = this.state;
    const { zoom, rotation, anyAnnotationsActive, baseImage, viewerLoading } = this.props;

    const containerClass = classNames({
      [renderedImagePaneStyles.osdContainer]: true,
      [renderedImagePaneStyles.osdNavigatorHidden]: !navigatorActive,
    });

    const collapseLeftClass = classNames({
      [renderedImagePaneStyles.rotate180]: this.props.productSearchSidebarOpen,
    });
    const collapseRightClass = classNames({
      [renderedImagePaneStyles.rotate180]: !this.props.productDetailsSidebarOpen,
    });

    const productIsOSDViewable = isOSDViewableFileType(baseImage);
    const filename = getPropFromProduct(baseImage, config.es_mappings.filename);
    const imageActive = !!getPropFromProduct(baseImage, config.es_mappings.id, null);

    const { isPDF, isGIF } = getProductFileType(baseImage);

    // Controls
    const controlGroups = [
      // Zoom controls
      <span key="control-group-zoom">
        <Tooltip
          overlay="Zoom Out"
          shortcut="-"
          placement="top"
          getTooltipContainer={() => this.containerNodeRef.current}
        >
          <Button
            aria-label="Zoom Out"
            className={renderedImagePaneStyles.controlButton}
            icon={<MinusIcon />}
            onClick={this.zoomOut}
            type="button"
            variant="icon"
          />
        </Tooltip>
        <div className={renderedImagePaneStyles.spacer} />
        {!isGIF && (
          <ControlsOverlay
            overlayPlacement="top"
            full={false}
            noPadding={true}
            className={renderedImagePaneStyles.controlButton}
            label={<span className={renderedImagePaneStyles.zoomButtonLabel}>{`${round((zoom || 0) * 100, 0)}%`}</span>}
            tooltipProps={{
              placement: 'top',
              overlay: 'Set Zoom',
              trigger: ['click', 'hover'],
              getTooltipContainer: () => this.containerNodeRef.current,
            }}
          >
            {this.renderZoomControlsMenu()}
          </ControlsOverlay>
        )}
        <div className={renderedImagePaneStyles.spacer} />
        <Tooltip
          overlay="Zoom In"
          shortcut="+"
          placement="top"
          getTooltipContainer={() => this.containerNodeRef.current}
        >
          <Button
            aria-label="Zoom In"
            className={renderedImagePaneStyles.controlButton}
            icon={<PlusIcon />}
            onClick={this.zoomIn}
            type="button"
            variant="icon"
          />
        </Tooltip>
        <div className={renderedImagePaneStyles.divider} />
      </span>,
      // Home control
      <span key="control-group-home">
        <Tooltip
          overlay="Reset View"
          shortcut="0"
          placement="top"
          getTooltipContainer={() => this.containerNodeRef.current}
        >
          <Button
            aria-label="Reset View"
            className={renderedImagePaneStyles.controlButton}
            icon={<HomeIcon />}
            onClick={this.resetView}
            key="home-button"
            type="button"
            variant="icon"
          />
        </Tooltip>
        {!isGIF && <div className={renderedImagePaneStyles.divider} />}
      </span>,
    ];

    if (!isGIF) {
      controlGroups.push(
        // Rotation controls
        <span key="control-group-rotation">
          <Tooltip
            overlay={anyAnnotationsActive ? 'Turn off drawings and bounding boxes to rotate image' : 'Rotate Left'}
            placement="top"
            getTooltipContainer={() => this.containerNodeRef.current}
          >
            <span className={anyAnnotationsActive ? renderedImagePaneStyles.controlButtonDisabledWrapper : ''}>
              <Button
                aria-label={
                  anyAnnotationsActive ? 'Turn off drawings and bounding boxes to rotate image' : 'Rotate Left'
                }
                disabled={anyAnnotationsActive}
                className={renderedImagePaneStyles.controlButton}
                icon={<RotateCCWIcon />}
                onClick={this.rotateLeft}
                type="button"
                variant="icon"
              />
            </span>
          </Tooltip>
          <div className={renderedImagePaneStyles.spacer} />
          <div className={renderedImagePaneStyles.rotationValue}>{rotation}˚</div>
          <div className={renderedImagePaneStyles.spacer} />
          <Tooltip
            overlay={anyAnnotationsActive ? 'Turn off drawings and bounding boxes to rotate image' : 'Rotate Right'}
            placement="top"
            getTooltipContainer={() => this.containerNodeRef.current}
          >
            <span className={anyAnnotationsActive ? renderedImagePaneStyles.controlButtonDisabledWrapper : ''}>
              <Button
                aria-label={
                  anyAnnotationsActive ? 'Turn off drawings and bounding boxes to rotate image' : 'Rotate Right'
                }
                disabled={anyAnnotationsActive}
                className={renderedImagePaneStyles.controlButton}
                icon={<RotateCWIcon />}
                onClick={this.rotateRight}
                type="button"
                variant="icon"
              />
            </span>
          </Tooltip>
          <div className={renderedImagePaneStyles.divider} />
        </span>
      );
      controlGroups.push(
        // Full screen and settings
        <span key="control-group-misc">
          <Tooltip overlay="Full Screen" placement="top" getTooltipContainer={() => this.containerNodeRef.current}>
            <Button
              aria-label="Full Screen"
              className={renderedImagePaneStyles.controlButton}
              icon={<MaximizeIcon />}
              onClick={this.toggleFullscreen}
              type="button"
              variant="icon"
            />
          </Tooltip>
          <div className={renderedImagePaneStyles.spacer} />
          <ControlsOverlay
            overlayPlacement="top"
            full={false}
            noPadding={true}
            className={renderedImagePaneStyles.controlButton}
            icon={<SettingsIcon />}
            tooltipProps={{
              placement: 'top',
              overlay: 'Image Viewer Settings',
              trigger: ['click', 'hover'],
              getTooltipContainer: () => this.containerNodeRef.current,
            }}
          >
            {this.renderSettingsMenu()}
          </ControlsOverlay>
        </span>
      );
    }

    // Handle control overflow into three dot menu
    let visibleControlGroups = controlGroups;
    let overflowControlGroups = [];
    if (toolbarOverflowLevel > 0) {
      if (toolbarOverflowLevel === 1) {
        visibleControlGroups = controlGroups.slice(0, 1);
        overflowControlGroups = controlGroups.slice(1);
      } else {
        visibleControlGroups = [];
        overflowControlGroups = controlGroups;
      }
      const overflowMenu = (
        <ControlsOverlay
          key="overflow-menu"
          overlayPlacement="top"
          full={false}
          noPadding={true}
          className={renderedImagePaneStyles.controlButton}
          icon={<ThreeDotIcon />}
          tooltipProps={{
            placement: 'top',
            overlay: 'More',
            trigger: ['click', 'hover'],
            getTooltipContainer: () => this.containerNodeRef.current,
          }}
        >
          <div className={renderedImagePaneStyles.overflowMenu}>{overflowControlGroups}</div>
        </ControlsOverlay>
      );
      visibleControlGroups.unshift(<div key="divider" className={renderedImagePaneStyles.divider} />);
      visibleControlGroups.unshift(overflowMenu);
    } else {
      visibleControlGroups.push(<div key="divider" className={renderedImagePaneStyles.divider} />);
    }

    return (
      <div ref={this.containerNodeRef} className={containerClass}>
        {isPDF && <PDFViewer pdfUrl={datadriveGetOCSObjectDownloadPath(baseImage)} />}
        {isGIF && (
          <div className={renderedImagePaneStyles.gifContainer}>
            <PrismaZoom
              ref={this.gifRendererRef}
              key={filename}
              maxZoom={20}
              className={renderedImagePaneStyles.prismaZoom}
            >
              <img alt={filename} src={datadriveGetOCSObjectDownloadPath(baseImage)} />
            </PrismaZoom>
          </div>
        )}
        {!imageActive && (
          <div className={renderedImagePaneStyles.mobileNoImageWarning}>
            {config.app_title} does not currently support image selection from mobile devices. Please use a larger
            device to access all {config.app_title} features.
          </div>
        )}
        <OpenSeaDragonWrapper
          ref={this.osdRef}
          osdHidden={!productIsOSDViewable}
          transformImage={this.brightnessStretchTransform}
          enableImageSmoothing={enableImageSmoothing}
          setViewerLoading={this.props.setViewerLoading}
          addDataCursor={this.addDataCursor}
          onMouseMove={this.onMouseMove}
          onViewportChange={this.onViewportChange}
          onFirstImageLoaded={this.onFirstImageLoaded}
          debugMode={this.props.debugMode}
          activeSearchProduct={this.props.activeSearchProduct}
          baseImage={this.props.baseImage}
          groups={this.props.groups}
          resetViewOnlyMode={this.props.resetViewOnlyMode}
          addMeasurement={this.props.addMeasurement}
          updateMeasurement={this.props.updateMeasurement}
          removeMeasurement={this.props.removeMeasurement}
          clearAllMeasurements={this.props.clearAllMeasurements}
          addScalebar={this.props.addScalebar}
          updateScalebar={this.props.updateScalebar}
          removeScalebar={this.props.removeScalebar}
          shapeSelected={this.props.shapeSelected}
          shapeDeselected={this.props.shapeDeselected}
          shapeClicked={this.props.shapeClicked}
          noShapeClicked={this.props.noShapeClicked}
          targetSelected={this.props.targetSelected}
          setOSDRefs={this.props.setOSDRefs}
          stretchMin={this.props.stretchMin}
          stretchMax={this.props.stretchMax}
          preferredImageForType={this.props.preferredImageForType}
          showAlert={this.props.showAlert}
          hideAlert={this.props.hideAlert}
          footprintSelected={this.props.footprintSelected}
          footprintDeselected={this.props.footprintDeselected}
        />
        {this.renderMobileMetadataDisplay()}
        <div className={renderedImagePaneStyles.controlButtonsContainer} ref={this.controlsToolbarRef}>
          <div className={renderedImagePaneStyles.controlButtonSegment}>
            {!isFullscreen && (
              <>
                <div className={renderedImagePaneStyles.controlButton}>
                  <Tooltip
                    overlay={this.props.productSearchSidebarOpen ? 'Collapse Search' : 'Show Search'}
                    placement="topLeft"
                  >
                    <Button
                      aria-label={this.props.productSearchSidebarOpen ? 'Collapse Search' : 'Show Search'}
                      className={collapseLeftClass}
                      icon={<CollapseIcon />}
                      variant="icon"
                      onClick={() => this.props.setProductSearchSidebarOpen(!this.props.productSearchSidebarOpen)}
                    />
                  </Tooltip>
                </div>
                {!isPDF && <div className={renderedImagePaneStyles.divider} />}
              </>
            )}
            {!isPDF && visibleControlGroups}
            {productIsOSDViewable && this.renderMousePosition()}
          </div>
          <div className={renderedImagePaneStyles.rightButtonSegment}>
            {viewerLoading ? this.renderLoadingIndicator() : null}
            {!isFullscreen && (
              <Tooltip
                overlay={this.props.productDetailsSidebarOpen ? 'Collapse Details' : 'Show Details'}
                placement="topRight"
              >
                <div>
                  <Button
                    aria-label={this.props.productDetailsSidebarOpen ? 'Collapse Details' : 'Show Details'}
                    className={collapseRightClass}
                    icon={<CollapseIcon />}
                    variant="icon"
                    onClick={() => this.props.setProductDetailsSidebarOpen(!this.props.productDetailsSidebarOpen)}
                  />
                </div>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    );
  }
}

// TODO add prop types

export default RenderedImagePane;
