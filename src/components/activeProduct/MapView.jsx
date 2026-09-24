import classNames from 'classnames';
import { Field, Form, Formik } from 'formik';
import leaflet from 'leaflet';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw/dist/leaflet.draw.js';
import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom/client';
import Button from 'src/components/common/Button';
import ControlsOverlay from 'src/components/common/ControlsOverlay';
import EmptyState from 'src/components/common/EmptyState';
import {
  CAMPLogo,
  CheckIcon,
  CloseIcon,
  CopyIcon,
  CrosshairsFineOutlinedIcon,
  CrosshairsLooseIcon,
  InfoIcon,
  LayersIcon,
  MinusIcon,
  NavcamIcon,
  PinIcon,
  PlusIcon,
  RoverIcon,
  RoverMapIconString,
  WarningIcon,
} from 'src/components/common/Icons';
import Scalebar from 'src/components/common/Scalebar';
import Toggle from 'src/components/common/Toggle';
import Tooltip from 'src/components/common/Tooltip';
import FormsStyles from 'src/styles/Forms.module.css';
import MapViewStyles from 'src/styles/MapView.module.css';
import renderedImagePaneStyles from 'src/styles/RenderedImagePane.module.css';
import { isHeli, metersToDegrees, openInNewTab } from 'src/utils';
import { getConfig } from 'src/utils/configRegistry';
import {
  getFootprintForImage,
  getLatLonForXYZ,
  getMatchingRdrPriority,
  getOrbitalCoordsForLineSample,
  getOrientationForProduct,
  projectLatLonIntoImage,
} from 'src/utils/dataQuery';
import { CAMPGetLinkForLatLon, CAMPGetLinkForSiteDrive, datadriveGetOCSObjectDownloadPath } from 'src/utils/endpoints';
import 'src/utils/leafletlib/leaflet-imagetransform';
import { getPropFromProduct } from 'src/utils/sharedUtils';
import { logError } from 'src/utils/telemetryUtils';
import urljoin from 'url-join';
import { v4 as uuidv4 } from 'uuid';

const PIN_ICON = leaflet.icon({
  iconUrl: 'astria_assets/map-pin-icon.svg',
  iconSize: [32, 321],
  iconAnchor: [16, 31],
});

export class MapView extends React.Component {
  constructor(props) {
    super(props);

    this.mapRef = React.createRef();
    this.iconBarContainerNodeRef = React.createRef();
    this.LOCALSTORAGE_LAYER_ROVER_TRAVERSE = props.instanceName + '_mapView_layer_visible__rover_traverse';
    this.LOCALSTORAGE_LAYER_ROVER_WAYPOINTS = props.instanceName + '_mapView_layer_visible__rover_waypoints';
    this.LOCALSTORAGE_LAYER_STRATEGIC_ANNOTATION = props.instanceName + '_mapView_layer_visible__strategic_annotation';
    this.LOCALSTORAGE_LAYER_STRATEGIC_TRAVERSE = props.instanceName + '_mapView_layer_visible__strategic_traverse';
    this.LOCALSTORAGE_LAYER_PLANNED_TARGETS = props.instanceName + '_mapView_layer_visible__planned_targets';
    this.leafletMapId = `leaflet_map_${uuidv4()}`;
    this.roverDot = null;
    this.roverTraverse = null;
    this.roverWaypoints = null;
    this.mapInitCallbacks = [];
    this.drawnItems = null;

    this.state = {
      initialized: false,
      initializationSuccess: false,
      cursorPoint: null,
      footprintPolygon: null,
      fetchingFootprint: false,
      copied: false,
      pixelsPerMeter: 0,
      latLng: [0, 0],
      dnLatLng: null,
      translatingCursorLocation: false,
      compactWidth: true,
      mapConfig: null,
    };
  }

  async componentDidMount() {
    const config = getConfig();
    let mapConfig;
    try {
      // Fetch map view configuration
      let configPath = config.map_view_config_S3_path;
      if (!configPath) {
        this.setState({ initialized: true, initializationSuccess: false });
        return;
      }
      // If this is an s3 path and not a local URL (for development purposes), get the real download path
      if (configPath.indexOf('s3:') > -1) {
        configPath = datadriveGetOCSObjectDownloadPath({ ocs_url: config.map_view_config_S3_path });
      }

      let mapConfigJSON = await fetch(configPath, { mode: 'cors', credentials: 'include' });
      mapConfig = await mapConfigJSON.json();

      this.setState({
        mapConfig,
      });
    } catch (err) {
      logError('Unable to fetch map config', err);
      this.setState({ initialized: true, initializationSuccess: false });
      return;
    }

    // Bail if map view is not enabled
    if (!mapConfig.enabled) {
      this.setState({ initialized: true, initializationSuccess: false });
      return;
    }

    try {
      // Wait until the mapRef is found which appears to not always be on mount
      requestAnimationFrame(() => {
        if (!this.mapRef.current) {
          this.pollRefUntilFound(this.mapRef, () => this.initializeMap(mapConfig));
        } else {
          this.initializeMap(mapConfig);
        }
      });
      this.setState({ initialized: true, initializationSuccess: true });
    } catch (err) {
      logError('Unable to initialize map', err);
      this.setState({ initialized: true, initializationSuccess: false });
    }
    this.connectResizeObserver();

    window.addEventListener('keydown', (evt) => {
      if (evt.ctrlKey) {
        if (this.mapRef.current) {
          this.mapRef.current.style.cursor = 'crosshair';
        }
      }
    });

    window.addEventListener('keyup', () => {
      if (this.mapRef.current) {
        this.mapRef.current.style.cursor = '';
      }
    });
  }

  componentWillUnmount() {
    this.disconnectResizeObserver();
  }

  pollRefUntilFound(ref, callback) {
    if (ref.current) {
      callback();
    } else {
      setTimeout(() => {
        this.pollRefUntilFound(ref, callback);
      }, 100);
    }
  }

  connectResizeObserver() {
    this.resizeObserver = new ResizeObserver((entries) => {
      window.requestAnimationFrame(() => {
        if (entries[0].contentRect.width < 512) {
          if (!this.state.compactWidth) {
            this.setState({ compactWidth: true });
          }
        } else {
          if (this.state.compactWidth) {
            this.setState({ compactWidth: false });
          }
        }
        if (this.map) {
          this.map.invalidateSize();
        }
      });
    });

    // Observe our wrapper element for changes in size
    if (this.mapRef.current) {
      this.resizeObserver.observe(this.mapRef.current);
    }
  }

  disconnectResizeObserver() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  componentDidUpdate(prevProps) {
    const config = getConfig();
    const { product, cursor: propCursor, fetchingGroups: propFetchingGroups } = this.props;
    const { cursor: prevCursor, product: prevProduct, fetchingGroups: prevFetchingGroups } = prevProps;

    const productID = product ? getPropFromProduct(product, config.es_mappings.id, null) : null;
    const prevProductID = prevProduct ? getPropFromProduct(prevProduct, config.es_mappings.id, null) : null;

    if ((productID && !prevProductID) || productID !== prevProductID) {
      if (!this.map) this.mapInitCallbacks.push(() => this.visualizeProductOnMap(product));
      else this.visualizeProductOnMap(product);
    }

    const prevCursorDiff =
      propCursor.line !== prevCursor.line ||
      propCursor.sample !== prevCursor.sample ||
      propCursor.mapLat !== prevCursor.mapLat ||
      propCursor.mapLon !== prevCursor.mapLon;
    const fetchingGroupsDiff = !propFetchingGroups && propFetchingGroups !== prevFetchingGroups;
    if (prevCursorDiff || fetchingGroupsDiff) {
      if (!this.map) this.mapInitCallbacks.push(() => this.visualizeCursorOnMap());
      else this.visualizeCursorOnMap();
    }

    if (JSON.stringify(prevProps.shapes) !== JSON.stringify(this.props.shapes)) {
      // TODO catch clearing of shape
      this.setShapesFromGeoJSON(this.props.shapes);
    }
  }

  getLSLayerVisible(layer, defaultHidden = false) {
    if (layer._astria_ls_key) {
      const lsValue = localStorage.getItem(layer._astria_ls_key);
      if (lsValue) return lsValue !== 'false';
      else return !defaultHidden;
    } else return true;
  }

  getLayerURL(layer) {
    return urljoin(getConfig().api_endpoints.CAMP.base, layer.url);
  }

  getDrawMarkerIconStyle() {
    return {
      icon: PIN_ICON,
    };
  }

  initializeMap(mapConfig) {
    // Return if map is already initialized from previous component mount
    if (this.map) {
      return;
    }

    try {
      // get tile layers from config
      const tileLayers = mapConfig.layers
        .filter((l) => l.type === 'tile')
        .map((l) => {
          const options = {
            bounds: leaflet.latLngBounds([leaflet.latLng(l.bounds[0]), leaflet.latLng(l.bounds[1])]),
            tms: true,
            maxNativeZoom: l.maxNativeZoom,
            maxZoom: l.maxZoom,
            minZoom: l.minZoom,
          };
          return leaflet.tileLayer(this.getLayerURL(l), options);
        });

      // create map
      this.map = leaflet.map(this.mapRef.current, {
        center: mapConfig.center,
        zoom: mapConfig.zoom,
        minZoom: mapConfig.minZoom,
        zoomControl: false,
        layers: tileLayers,
      });

      if (!this.props.interactive) {
        this.map._handlers.forEach(function (handler) {
          handler.disable();
        });
      }

      // FeatureGroup is to store editable layers
      // Add any initial shapes if we have them
      this.drawnItems = new leaflet.FeatureGroup();
      this.map.addLayer(this.drawnItems);
      if (this.props.shapes && this.props.shapes.length) {
        this.setShapesFromGeoJSON(this.props.shapes);
        this.centerMapOnShapes();
      }
      if (this.props.enableDraw) {
        const drawControl = new leaflet.Control.Draw({
          edit: false, // TODO would be nice to allow editing but not working yet
          draw: {
            polyline: false,
            circlemarker: false,
            circle: false,
            polygon: {
              shapeOptions: {
                color: 'rgb(255,0,0)',
                weight: 3,
              },
            },
            rectangle: {
              shapeOptions: {
                color: 'rgb(255,0,0)',
                weight: 3,
              },
              showArea: false,
            },

            marker: this.getDrawMarkerIconStyle(),
          },
        });

        // Add shape if one exists from props
        if (this.props.shapes.length) {
          this.setShapesFromGeoJSON(this.props.shapes);

          // Center on shapes
          this.centerMapOnShapes();
        }

        this.map.addControl(drawControl);
        this.map.on(leaflet.Draw.Event.CREATED, (event) => {
          // event.layer is deprecated but the "propagatedfrom" property does not seem to
          // exist on this event might be since the plugin is old
          // Also note, Leaflet-Geoman was acting very strange in terms of performance, would need more work to determine
          // if those issues can be resolved.

          this.props.onShapeDrawn(event.layer);
        });
      }

      this.map.on('zoomend', this.onZoomEnd);
      this.map.on('moveend', this.setScaleBars);
      this.map.on('mousemove', this.onMouseMove);
      this.map.on('click', this.onMouseClick);
      this.map.on('contextmenu', this.onMouseClick);
      this.setScaleBars();

      mapConfig.layers
        .filter((l) => l.type === 'vector')
        .forEach((l) => {
          switch (l.id) {
            case 'strategic_annotation':
              this.loadStrategicAnnotation(l);
              break;
            case 'strategic_traverse':
              this.loadStrategicTraverse(l);
              break;
            case 'rover_waypoints':
              this.loadRoverWaypoints(l);
              break;
            case 'rover_traverse':
              this.loadRoverTraverse(l);
              break;
            case 'planned_targets':
              this.loadPlannedTargets(l);
              break;

            default:
              break;
          }
        });

      if (this.props.cursor) {
        this.visualizeCursorOnMap();
      }

      // Call any callbacks waiting on map load
      if (this.mapInitCallbacks.length) {
        this.mapInitCallbacks.forEach((fn) => fn());
        this.mapInitCallbacks = [];
      }
    } catch (err) {
      console.error(err);
    }
  }

  onZoomEnd = () => {
    this.setScaleBars();

    // Zoom dependent rendering
    const currentZoom = this.map.getZoom();
    if (currentZoom < this.props.waypointDotHideZoomLevel) {
      if (this.roverWaypoints) this.roverWaypoints.setStyle({ opacity: 0, fillOpacity: 0 });
    } else {
      if (this.roverWaypoints) this.roverWaypoints.setStyle({ opacity: 0.7, fillOpacity: 1 });
    }

    if (this.shouldShowRoverDot()) {
      if (this.roverDot) this.roverDot._icon.classList.remove(MapViewStyles.roverIconHidden);
    } else {
      if (this.roverDot) this.roverDot._icon.classList.add(MapViewStyles.roverIconHidden);
    }
    this.props.onZoomEnd();
  };

  centerMapOnShapes = (layer = this.drawnItems) => {
    this.map.fitBounds(layer.getBounds(), { animate: false });
  };

  setShapesFromGeoJSON(shapes) {
    this.drawnItems.clearLayers();
    shapes.forEach(({ geoJSON, style }) => {
      try {
        const layer = leaflet.geoJSON(geoJSON, {
          markersInheritOptions: true,
          pointToLayer: function (feature) {
            const latlng = new leaflet.LatLng(feature.coordinates[1], feature.coordinates[0]);
            return leaflet.marker(latlng, { icon: PIN_ICON });
          },
          ...style,
        });
        this.drawnItems.addLayer(layer);
      } catch (err) {
        console.log(err, geoJSON);
      }
    });
  }

  async loadRoverTraverse(layer) {
    try {
      const response = await fetch(this.getLayerURL(layer) + `?layer=${layer.layer_name}&type=geojson`, {
        mode: 'cors',
        credentials: 'include',
      });

      const json = await response.json();
      if (!json.status === 'success' || !json.features || !json.features.length) return;
      this.roverTraverse = new leaflet.geoJSON(null, {
        style: { color: 'rgb(255, 255, 255)', opacity: 0.5, interactive: false },
      });
      json.features.forEach((feature) => {
        if (feature.type === 'Feature' && feature.geometry) {
          this.roverTraverse.addData(feature.geometry);
        }
      });

      this.roverTraverse._astria_ls_key = this.LOCALSTORAGE_LAYER_ROVER_TRAVERSE;
      if (this.getLSLayerVisible(this.roverTraverse, layer.defaultHidden)) this.roverTraverse.addTo(this.map);
      this.orderLayers();
    } catch (err) {
      console.log(err);
    }
  }

  async loadRoverWaypoints(layer) {
    const { interactive } = this.props;
    try {
      const response = await fetch(this.getLayerURL(layer) + `?layer=${layer.layer_name}&type=geojson`, {
        mode: 'cors',
        credentials: 'include',
      });

      const geoJSON = await response.json();
      this.roverWaypoints = new leaflet.geoJSON(null, {
        pointToLayer: function (feature, latlng) {
          const l = leaflet.circleMarker(latlng, {
            radius: 4,
            fillOpacity: 1,
            opacity: 0.7,
            color: 'rgb(0, 0, 0)',
            fillColor: 'rgb(255, 255, 255)',
            weight: 1,
            stroke: true,
            interactive,
          });
          if (interactive) l.bindTooltip(`RMC: ${feature.properties.RMC}`, { opacity: 1, offset: leaflet.point(4, 0) });
          return l;
        },
      });
      geoJSON.features.forEach((feature) => {
        if (feature.type === 'Feature' && feature.geometry) {
          this.roverWaypoints.addData({ ...feature.geometry, properties: feature.properties });
        }
      });

      this.roverWaypoints._astria_ls_key = this.LOCALSTORAGE_LAYER_ROVER_WAYPOINTS;
      if (this.getLSLayerVisible(this.roverWaypoints, layer.defaultHidden)) this.roverWaypoints.addTo(this.map);

      // Call zoomEnd to handle initial zoom styling for waypoints
      this.onZoomEnd();
      this.orderLayers();
    } catch (err) {
      console.log(err);
    }
  }

  async loadPlannedTargets(layer) {
    const { interactive } = this.props;
    try {
      const response = await fetch(this.getLayerURL(layer) + `?layer=${layer.layer_name}&type=geojson`, {
        mode: 'cors',
        credentials: 'include',
      });

      const geoJSON = await response.json();
      this.plannedTargets = new leaflet.geoJSON(null, {
        pointToLayer: (feature, latlng) => {
          const l = leaflet.circleMarker(latlng, {
            radius: 4,
            fillOpacity: 1,
            opacity: 0.7,
            color: 'rgb(0, 0, 0)',
            fillColor: '#d9ffb3',
            weight: 1,
            stroke: true,
            interactive,
          });
          if (interactive) {
            l.bindTooltip(`Name: ${feature.properties.Name}, Sol: ${feature.properties.sol}`, {
              opacity: 1,
              offset: leaflet.point(4, 0),
            });
            l.on('click', (e) => {
              try {
                const t = e.target.feature.geometry.properties;
                const target = {
                  dbContent: {
                    version: t.ver,
                    creationDate: '',
                    updateDate: '',
                    uuid: t.data?.uuid,
                  },
                  content: {
                    imageId: t.ImageId,
                    id: t.data?.uuid,
                    azimuth: t.Azimuth,
                    elevation: t.Elevation,
                    x: t.X,
                    y: t.U,
                    z: t.Z,
                    i: t.I,
                    j: t.J,
                    sol: t.sol,
                    owner: t.owner,

                    name: t.Name,
                    type: t.feattype,
                    frame: t.FRAME,
                    rmc: `${t.site},${t.drive}`,
                  },
                };
                this.props.setTargetMetadataOpen(target);
              } catch (err) {
                console.error('Unable to retrieve Map View target info:', err);
              }
            });
          }
          return l;
        },
      });
      geoJSON.features.forEach((feature) => {
        if (feature.type === 'Feature' && feature.geometry) {
          this.plannedTargets.addData({ ...feature.geometry, properties: feature.properties });
        }
      });

      this.plannedTargets._astria_ls_key = this.LOCALSTORAGE_LAYER_PLANNED_TARGETS;
      if (this.getLSLayerVisible(this.plannedTargets, layer.defaultHidden)) {
        this.plannedTargets.addTo(this.map);
      }
      this.orderLayers();
    } catch (err) {
      console.log(err);
    }
  }

  async loadStrategicAnnotation(layer) {
    try {
      const response = await fetch(this.getLayerURL(layer), {
        headers: {
          accept: '*/*',
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: `intent=${layer.layer_name}&quick_published=true`,
        method: 'POST',
        mode: 'cors',
        credentials: 'include',
      });

      const json = await response.json();
      if (!json.status === 'success' || !json.body.features || !json.body.features.length) return;
      const features = json.body.features;
      this.strategicAnnotation = new leaflet.geoJSON(null, {
        style: function (feature) {
          if (feature.geometry.properties.style) {
            const style = JSON.parse(JSON.stringify(feature.geometry.properties.style));
            return style;
          }
        },
        pointToLayer: function (feature, _latlng) {
          if (feature.type === 'Point') {
            if (feature.properties.annotation) {
              const s = feature.properties.style;
              const styleString =
                (s.color != null
                  ? 'text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000; '
                  : '') +
                (s.fillColor != null ? 'color: ' + s.fillColor + '; ' : '') +
                (s.fontSize != null ? 'font-size: ' + s.fontSize + '; ' : '') +
                (s.rotation != null
                  ? 'transform: rotateZ(' + parseInt(!isNaN(s.rotation) ? s.rotation : 0) * -1 + 'deg); '
                  : '');
              const popup = leaflet
                .popup({
                  className: 'leaflet-popup-annotation no-pointer-events',
                  closeButton: false,
                  autoClose: false,
                  closeOnEscapeKey: false,
                  closeOnClick: false,
                  autoPan: false,
                  offset: new leaflet.point(0, 3),
                })
                .setLatLng(new leaflet.LatLng(feature.coordinates[1], feature.coordinates[0]))
                .setContent(
                  `<div class='map-view-annotation-text' style='${styleString}'>${feature.properties.name.replace(
                    /[<>;{}]/g,
                    ''
                  )}</div>`
                );

              return popup;
            }
          }
        },
      });
      features.forEach((feature) => {
        if (feature.geometry) {
          this.strategicAnnotation.addData({ ...feature.geometry, properties: feature.properties });
        }
      });

      this.strategicAnnotation._astria_ls_key = this.LOCALSTORAGE_LAYER_STRATEGIC_ANNOTATION;
      if (this.getLSLayerVisible(this.strategicAnnotation, layer.defaultHidden)) {
        this.strategicAnnotation.addTo(this.map);
      }
      this.orderLayers();
    } catch (err) {
      console.log(err);
    }
  }

  async loadStrategicTraverse(layer) {
    try {
      const response = await fetch(this.getLayerURL(layer), {
        headers: {
          accept: '*/*',
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: `intent=${layer.layer_name}&quick_published=true`,
        method: 'POST',
        mode: 'cors',
        credentials: 'include',
      });

      const json = await response.json();
      if (!json.status === 'success' || !json.body.features || !json.body.features.length) return;
      const features = json.body.features;
      this.strategicTraverse = new leaflet.geoJSON(null, {
        style: function (feature) {
          if (feature.geometry.properties.style) {
            const style = JSON.parse(JSON.stringify(feature.geometry.properties.style));
            style.interactive = false;
            return style;
          }
        },
      });
      features.forEach((feature) => {
        if (feature.geometry) {
          this.strategicTraverse.addData({ ...feature.geometry, properties: feature.properties });
        }
      });

      this.strategicTraverse._astria_ls_key = this.LOCALSTORAGE_LAYER_STRATEGIC_TRAVERSE;
      if (this.getLSLayerVisible(this.strategicTraverse, layer.defaultHidden)) this.strategicTraverse.addTo(this.map);
      this.orderLayers();
    } catch (err) {
      console.log(err);
    }
  }

  async fetchFootprint() {
    const config = getConfig();
    try {
      if (!this.props.product) return;
      const productID = this.props.product ? getPropFromProduct(this.props.product, config.es_mappings.id, null) : null;
      this.setState({ fetchingFootprint: true });
      const footprint = await getFootprintForImage(this.props.product, this.props.ocsPackages);
      this.setState({ fetchingFootprint: false });

      const currentProductID = this.props.product
        ? getPropFromProduct(this.props.product, config.es_mappings.id, null)
        : null;

      // Catch the case where the footprint applies to an old product
      if (productID !== currentProductID) return;

      // Ensure footprint has valid data
      if (!footprint.footprint || !footprint.footprint.coordinates || !footprint.footprint.coordinates.length) return;
      return footprint;
    } catch (err) {
      console.log(err);
      this.setState({ fetchingFootprint: false });
      return;
    }
  }

  orderLayers() {
    if (this.strategicAnnotation) this.strategicAnnotation.bringToBack();
    if (this.strategicTraverse) this.strategicTraverse.bringToBack();
    if (this.plannedTargets) this.plannedTargets.bringToBack();
    if (this.roverWaypoints) this.roverWaypoints.bringToBack();
    if (this.roverTraverse) this.roverTraverse.bringToBack();
    if (this.state.footprintPolygon) this.state.footprintPolygon.bringToBack();
  }

  async visualizeProductOnMap() {
    // Fetch and load the footprint for the product if one exists
    this.clearFootprintFromMap();
    const footprint = await this.fetchFootprint();
    if (footprint) this.addFootprint(footprint);

    // Display rover position and orientation
    // Zoom to the RMC if there is no footprint found
    this.clearRMCFromMap();
    await this.visualizeRMC(!footprint);

    this.orderLayers();

    if (footprint) this.centerMapOnFootprint();
  }

  async visualizeCursorOnMap() {
    const { product, groups, cursor, fetchingGroups } = this.props;
    try {
      // Clear old cursor
      this.clearCursorFromMap();

      if (!cursor.active) return;

      let latLon = { latitude: 0, longitude: 0 };

      // If the cursor originated from the map we will plot the location using the map lon/lat from the user's click
      if (cursor.cursorOrigin === 'MAP') {
        latLon.latitude = cursor.mapLat;
        latLon.longitude = cursor.mapLon;
      } else {
        // don't try to do anything if we're still waiting on groups
        if (fetchingGroups || !product) {
          return;
        }
        // Otherwise if the cursor originated from the image we will derive lon/lat from the line/sample
        if (!cursor || cursor.line === -1 || cursor.sample === -1) {
          this.setState({ translatingCursorLocation: false });
          return;
        }

        // Skip translation if no XYZ product exists
        const xyzProduct = getMatchingRdrPriority(product, groups, ['XYZ', 'XYM', 'XOZ']);
        if (!xyzProduct) return;

        this.setState({ translatingCursorLocation: true });
        const { line, sample } = cursor;
        const orbitalData = await getOrbitalCoordsForLineSample(product, groups, { line, sample });
        latLon = orbitalData.latLon;

        // Catch the case where this request applies to a stale cursor
        if (
          !this.props.cursor ||
          cursor.line !== this.props.cursor.line ||
          cursor.sample !== this.props.cursor.sample
        ) {
          return;
        }
      }

      this.setState({ dnLatLng: latLon, translatingCursorLocation: false });

      const cursorDivID = this.leafletMapId + '_cursor';
      const cursorIcon = leaflet.divIcon({
        html: `<div id=${cursorDivID}></div>`,
        iconSize: [24, 24], // size of the icon
        iconAnchor: [12, 12], // point of the icon which will correspond to marker's location
      });

      const cursorPoint = leaflet.marker([latLon.latitude, latLon.longitude], { icon: cursorIcon });
      cursorPoint.addTo(this.map);
      this.setState({ cursorPoint });

      const cursorDiv = document.getElementById(cursorDivID);
      const el = (
        <>
          <CrosshairsFineOutlinedIcon
            style={{
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
          {cursor.cursorOrigin === 'IMAGE' && (
            <div style={{ pointerEvents: 'all' }}>
              <Tooltip overlay="Position estimated from orbital coordinates" placement="top">
                <WarningIcon className="cursorUncertaintyWarning" />
              </Tooltip>
            </div>
          )}
        </>
      );
      const root = ReactDOM.createRoot(cursorDiv);
      root.render(el);
    } catch (err) {
      console.error(err);
      this.setState({ dnLatLng: null, translatingCursorLocation: false });
    }
  }

  renderCursorLocation() {
    const { cursor } = this.props;
    const { dnLatLng, copied, translatingCursorLocation } = this.state;
    if (!dnLatLng) {
      if (cursor && cursor.line !== -1 && cursor.sample !== -1 && !translatingCursorLocation) {
        return (
          <div className={MapViewStyles.dnLocation}>
            <CrosshairsFineOutlinedIcon />
            <div className={MapViewStyles.mouseLocationUnknown}>Lon,Lat : Unknown</div>
          </div>
        );
      } else return;
    }

    const buttonClass = classNames({
      [MapViewStyles.dnLocationButton]: true,
      [MapViewStyles.dnLocationButtonCopied]: copied,
    });

    return (
      <div className={MapViewStyles.dnLocation}>
        <CrosshairsFineOutlinedIcon />
        <div className={MapViewStyles.mouseLocation}>
          Lon,Lat : <span>{`${dnLatLng.longitude.toFixed(7)}°, ${dnLatLng.latitude.toFixed(7)}°`}</span>
        </div>
        <div className={MapViewStyles.dnLocationButtons}>
          <Tooltip overlay="Copy Lon/Lat" placement="top" invisible={copied}>
            <Button
              aria-label="Copy Lon/Lat"
              className={buttonClass}
              variant="icon"
              icon={copied ? <CheckIcon /> : <CopyIcon />}
              onClick={() => {
                navigator.clipboard.writeText(`${dnLatLng.longitude}, ${dnLatLng.latitude}`);
                this.setState({ copied: true });
                setTimeout(() => {
                  this.setState({ copied: false });
                }, 1500);
              }}
            />
          </Tooltip>
          <Tooltip overlay="Clear Cursor" placement="top">
            <Button
              aria-label="Clear Cursor"
              className={MapViewStyles.dnLocationButton}
              variant="icon"
              icon={<CloseIcon />}
              onClick={() => this.props.clearDataCursor()}
            />
          </Tooltip>
        </div>
      </div>
    );
  }

  renderProductVisualizationNotAvailable(message) {
    return (
      <div className={MapViewStyles.productUnavailable}>
        <InfoIcon />
        <div className={MapViewStyles.mouseLocation}>{message}</div>
      </div>
    );
  }

  productHasSiteAndDrive(product) {
    const config = getConfig();
    const site = getPropFromProduct(product, config.es_mappings.site);
    const drive = getPropFromProduct(product, config.es_mappings.drive);
    return (
      (typeof site === 'number' || typeof site === 'string') && (typeof drive === 'number' || typeof drive === 'string')
    );
  }

  async visualizeRMC(zoomTo = false) {
    const config = getConfig();
    const { product } = this.props;

    if (!product) return;

    try {
      // Find orbital position of the RMC
      const site = getPropFromProduct(product, config.es_mappings.site);
      const drive = getPropFromProduct(product, config.es_mappings.drive);
      if (
        (typeof site !== 'number' && typeof site !== 'string') ||
        site === '' ||
        (typeof drive !== 'number' && typeof drive !== 'string') ||
        drive === ''
      ) {
        return;
      }

      let queryFrame = `rover(${site},${drive})`;
      const { latLon } = await getLatLonForXYZ(0, 0, 0, queryFrame);

      const orientation = getOrientationForProduct(product);

      if (orientation.roll !== 0 && orientation.pitch !== 0 && orientation.yaw !== 0) {
        this.showRover(latLon.latitude, latLon.longitude, orientation, zoomTo);
      }
      this.showRoverDot(latLon.latitude, latLon.longitude, zoomTo);
    } catch (err) {
      console.error(err);
    }
  }

  // https://github.com/NASA-AMMOS/MMGIS/blob/58fc382ad26557a0cd18ca7cb9385e50fbb34990/src/essence/Basics/Formulae_/Formulae_.js#L131
  // 2D rotate a point about another point a certain angle
  // pt is {x: ,y: }  center is [x,y]  angle in radians
  rotatePoint(pt, center, angle) {
    var cosAngle = Math.cos(angle);
    var sinAngle = Math.sin(angle);
    var dx = pt.x - center[0];
    var dy = pt.y - center[1];
    var newPt = {};
    newPt['x'] = center[0] + dx * cosAngle - dy * sinAngle;
    newPt['y'] = center[1] + dx * sinAngle + dy * cosAngle;

    return newPt;
  }

  shouldShowRoverDot() {
    if (this.map) {
      const roverDotAppliesToZoom = this.map.getZoom() < 19;
      if (this.rmcOverlay) return roverDotAppliesToZoom;
      else return true;
    }
    return false;
  }

  showRoverDot(lat, lng, zoomTo = false) {
    const config = getConfig();
    const { product } = this.props;

    // Find orbital position of the RMC
    const site = getPropFromProduct(product, config.es_mappings.site);
    const drive = getPropFromProduct(product, config.es_mappings.drive);

    try {
      const icon = leaflet.divIcon({
        className: this.shouldShowRoverDot() ? '' : MapViewStyles.roverIconHidden,
        html: RoverMapIconString,
        iconSize: [12, 12], // size of the icon
        iconAnchor: [12, 12], // point of the icon which will correspond to marker's location
      });

      this.roverDot = leaflet.marker([lat, lng], { icon });
      this.roverDot.bindTooltip(`RMC: ${site}_${drive}`, { opacity: 1, offset: leaflet.point(12, 0) });
      this.roverDot.addTo(this.map);
      if (zoomTo) this.centerMapOnRMC();
    } catch (err) {
      console.log(err);
    }
  }

  showRover(lat, lng, orientation, zoomTo = false) {
    let widthMeters = 2.7; // TODO need more exact numbers?
    let widthPixels = 420; // Image width
    let heightPixels = 600; // Image width
    let lngMeters = metersToDegrees(widthMeters) / 2;
    let latMeters = lngMeters * (heightPixels / widthPixels);
    let center = [lng, lat];
    let angle = orientation.yaw;

    var topLeft = this.rotatePoint(
      {
        y: lat + latMeters,
        x: lng - lngMeters,
      },
      center,
      angle
    );
    var topRight = this.rotatePoint(
      {
        y: lat + latMeters,
        x: lng + lngMeters,
      },
      center,
      angle
    );
    var bottomRight = this.rotatePoint(
      {
        y: lat - latMeters,
        x: lng + lngMeters,
      },
      center,
      angle
    );
    var bottomLeft = this.rotatePoint(
      {
        y: lat - latMeters,
        x: lng - lngMeters,
      },
      center,
      angle
    );
    var anchors = [
      [topLeft.y, topLeft.x],
      [topRight.y, topRight.x],
      [bottomRight.y, bottomRight.x],
      [bottomLeft.y, bottomLeft.x],
    ];
    try {
      // leaflet.imageTransform
      this.rmcOverlay = leaflet.imageTransform('PerseveranceTopDown.png', anchors, {
        opacity: 1,
        clip: anchors,
      });
      this.rmcOverlay.addTo(this.map);
      if (zoomTo) this.centerMapOnRMC();
    } catch (err) {
      console.log(err);
    }
  }

  clearFootprintFromMap() {
    try {
      if (this.state.footprintPolygon) this.state.footprintPolygon.removeFrom(this.map);
      this.setState({ footprintPolygon: null });
    } catch (err) {
      console.error(err);
    }
  }

  clearCursorFromMap = () => {
    try {
      if (this.state.cursorPoint) this.state.cursorPoint.removeFrom(this.map);
      this.setState({ dnLatLng: null, cursorPoint: null });
    } catch (err) {
      console.error(err);
    }
  };

  clearRMCFromMap() {
    try {
      if (this.rmcOverlay) this.rmcOverlay.removeFrom(this.map);
      if (this.roverDot) this.roverDot.removeFrom(this.map);
      this.rmcOverlay = null;
      this.roverDot = null;
    } catch (err) {
      console.error(err);
    }
  }

  setScaleBars = () => {
    if (!this.mapRef.current) return;

    // Adapted from https://github.com/NASA-AMMOS/MMGIS/blob/1d0698ceb312255e60b7a0a2c758ae0d8a74676a/src/essence/Ancillary/ScaleBar.js#L35
    let mapRect = this.mapRef.current.getBoundingClientRect();

    //Find center of map
    const wOffset = mapRect.width / 2;
    const hOffset = mapRect.height / 2;

    //Find distance between two neighboring points
    const leftLatLong = this.map.containerPointToLatLng([wOffset, hOffset]);
    const rightLatLong = this.map.containerPointToLatLng([wOffset + 1, hOffset]);

    //Create appropriate scales by measuring distance between above points
    const singlePixelDistance = this.lngLatDistBetween(
      leftLatLong['lng'],
      leftLatLong['lat'],
      rightLatLong['lng'],
      rightLatLong['lat']
    );
    const pixelsPerMeter = 1 / singlePixelDistance;
    this.setState({ pixelsPerMeter });
  };

  onMouseMove = (e) => {
    if (this.props.interactive) {
      this.setState({ latLng: [e.latlng.lng.toFixed(7), e.latlng.lat.toFixed(7)] });
    }
  };

  onMouseClick = async (e) => {
    if (this.props.interactive && e.originalEvent.ctrlKey) {
      e.originalEvent.preventDefault();

      let pixelLoc;
      try {
        pixelLoc = await projectLatLonIntoImage(
          { latitude: e.latlng.lat, longitude: e.latlng.lng },
          this.props.product
        );
      } catch (_err) {
        console.warn('Failed to convert lat/lon to line/sample');
        // this.props.clearDataCursor();
      }
      this.props.setDataCursorExternally({
        active: true,
        sample: pixelLoc ? pixelLoc.pixel.x : -1,
        line: pixelLoc ? pixelLoc.pixel.y : -1,
        mapLon: e.latlng.lng,
        mapLat: e.latlng.lat,
        cursorOrigin: 'MAP',
      });
    }
  };

  // TODO move to utils
  //Uses haversine to calculate distances over arcs
  // From https://github.com/NASA-AMMOS/MMGIS/blob/58fc382ad26557a0cd18ca7cb9385e50fbb34990/src/essence/Basics/Formulae_/Formulae_.js#L67
  lngLatDistBetween(lon1, lat1, lon2, lat2) {
    var R = getConfig().constants.body_radius;
    var φ1 = lat1 * (Math.PI / 180);
    var φ2 = lat2 * (Math.PI / 180);
    var Δφ = (lat2 - lat1) * (Math.PI / 180);
    var Δλ = (lon2 - lon1) * (Math.PI / 180);

    var a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  addFootprint(footprint) {
    try {
      const footprintPolygon = leaflet
        .polygon(
          footprint.footprint.coordinates[0].map((coords) => [coords[1], coords[0]]),
          { fillColor: '#5cff8e', color: '#5cff8e', interactive: false }
        )
        .addTo(this.map);
      this.setState({ footprintPolygon });
    } catch (err) {
      console.error(err);
    }
  }

  centerMapOnFootprint = () => {
    try {
      if (this.state.footprintPolygon) {
        const latLngs = [this.state.footprintPolygon.getBounds()];
        if (this.roverDot) latLngs.push(this.roverDot.getLatLng());
        if (this.rmcOverlay) {
          latLngs.push(this.rmcOverlay.getCenter().toBounds(7)); // pad rover bounds by 7 meters
        }
        this.map.fitBounds(new leaflet.latLngBounds(latLngs), { animate: false });
      }
    } catch (err) {
      console.error(err);
    }
  };

  centerMapOnRMC = () => {
    try {
      if (this.rmcOverlay) {
        this.map.setView(this.rmcOverlay.getCenter(), 20);
      } else if (this.roverDot) {
        this.map.setView(this.roverDot.getLatLng(), 20);
      }
    } catch (err) {
      console.error(err);
    }
  };

  centerMapOnCursor = () => {
    try {
      if (this.state.cursorPoint) {
        this.map.setView(this.state.cursorPoint.getLatLng(), 20);
      }
    } catch (err) {
      console.error(err);
    }
  };

  resetView = () => {
    if (this.state.footprintPolygon) this.centerMapOnFootprint();
    else this.centerMapOnRMC();
  };

  zoomIn = () => {
    this.map.zoomIn();
  };

  zoomOut = () => {
    this.map.zoomOut();
  };

  openInCAMP = () => {
    const config = getConfig();
    const { dnLatLng } = this.state;
    const { product } = this.props;

    if (dnLatLng) {
      openInNewTab(
        CAMPGetLinkForLatLon({
          latLon: {
            latitude: dnLatLng.latitude,
            longitude: dnLatLng.longitude,
          },
          text: `point in ${getPropFromProduct(product, config.es_mappings.filename, null)}`,
        })
      );
    } else {
      openInNewTab(CAMPGetLinkForSiteDrive(this.props.product));
    }
  };

  toggleLayer = (layer) => {
    if (!layer) return;
    try {
      if (layer._map) {
        layer.removeFrom(this.map);
        if (layer._astria_ls_key) localStorage.setItem(layer._astria_ls_key, false);
      } else {
        layer.addTo(this.map);
        if (layer._astria_ls_key) localStorage.setItem(layer._astria_ls_key, true);
      }
    } catch (err) {
      console.error(err);
    }
    this.orderLayers();
    this.forceUpdate();
  };

  renderMapLayersControl = () => {
    const toggleableLayers = this.state.mapConfig.layers.filter((l) => l.toggleable).map((l) => l.id);
    return (
      <div className={renderedImagePaneStyles.settingsMenu}>
        <div className={renderedImagePaneStyles.zoomInputLabel}>Map Layers</div>
        <div className={renderedImagePaneStyles.settingsMenuContent}>
          {toggleableLayers.indexOf('rover_waypoints') > -1 && toggleableLayers.indexOf('rover_traverse') > -1 && (
            <Toggle
              on={this.roverTraverse ? !!this.roverTraverse._map : false}
              label="Show Rover Traverse"
              onChange={() => {
                this.toggleLayer(this.roverTraverse);
                this.toggleLayer(this.roverWaypoints);
              }}
            />
          )}
          {toggleableLayers.indexOf('planned_targets') > -1 && (
            <Toggle
              on={this.plannedTargets ? !!this.plannedTargets._map : false}
              label="Show Planned Targets"
              onChange={() => this.toggleLayer(this.plannedTargets)}
            />
          )}
          {toggleableLayers.indexOf('strategic_annotation') > -1 && (
            <Toggle
              on={this.strategicAnnotation ? !!this.strategicAnnotation._map : false}
              label="Show Strategic Annotation"
              onChange={() => this.toggleLayer(this.strategicAnnotation)}
            />
          )}
          {toggleableLayers.indexOf('strategic_traverse') > -1 && (
            <Toggle
              on={this.strategicTraverse ? !!this.strategicTraverse._map : false}
              label="Show Strategic Traverse"
              onChange={() => this.toggleLayer(this.strategicTraverse)}
            />
          )}
        </div>
      </div>
    );
  };

  renderRMCControl() {
    const inputClasses = classNames({
      [FormsStyles.textInput]: true,
    });

    const submit = (values) => {
      if (this.roverWaypoints) {
        const waypoint = this.roverWaypoints.getLayers().find((l) => {
          const { site, drive } = l.feature.geometry.properties;
          return site === values.site && drive === values.drive;
        });
        if (waypoint) {
          this.map.setView(waypoint.getLatLng(), 20);
        }
      }
    };

    const onKeyDown = (event, values) => {
      // fire our on change when we see enter key pressed
      if (event.keyCode === 13) {
        submit(values);
      }
    };

    return (
      <div className={renderedImagePaneStyles.settingsMenu}>
        <div className={renderedImagePaneStyles.zoomInputLabel}>Go to RMC</div>
        <div className={renderedImagePaneStyles.settingsMenuContent}>
          <Formik
            enableReinitialize
            initialValues={{ site: '', drive: '' }}
            onSubmit={(values, { setSubmitting }) => {
              // Search
              submit(values);
              setSubmitting(false);
            }}
          >
            {({ values }) => (
              <Form noValidate autoComplete="off" className={MapViewStyles.rmcControlForm}>
                <div className={FormsStyles.inlineLabelChildren}>
                  <div className={FormsStyles.label}>Site:</div>
                  <Field name="site">
                    {({ field }) => {
                      const { value, onChange, ...otherFieldProps } = field;
                      return (
                        <>
                          <input
                            aria-label="Site"
                            type="number"
                            min={0}
                            className={inputClasses}
                            value={value}
                            onKeyDown={(e) => onKeyDown(e, values)}
                            onChange={(e) => {
                              // submit(values);
                              onChange(e);
                            }}
                            {...otherFieldProps}
                          />
                        </>
                      );
                    }}
                  </Field>
                </div>
                <div className={FormsStyles.inlineLabelChildren}>
                  <div className={FormsStyles.label}>Drive:</div>
                  <Field name="drive">
                    {({ field }) => {
                      const { value, onChange, ...otherFieldProps } = field;
                      return (
                        <>
                          <input
                            aria-label="Drive"
                            type="number"
                            min={0}
                            className={inputClasses}
                            value={value}
                            onKeyDown={(e) => onKeyDown(e, values)}
                            onChange={(e) => {
                              // this.debouncedNotesChange(e.target.value);
                              onChange(e);
                            }}
                            {...otherFieldProps}
                          />
                        </>
                      );
                    }}
                  </Field>
                </div>
                <Button
                  type="button"
                  disabled={false}
                  variant="secondary"
                  text="Go"
                  full
                  onClick={() => submit(values)}
                />
              </Form>
            )}
          </Formik>
        </div>
      </div>
    );
  }

  renderMouseLocation() {
    const { latLng, compactWidth } = this.state;
    const rootClasses = classNames({
      [MapViewStyles.mouseLocation]: true,
      [MapViewStyles.mouseLocationCompact]: compactWidth,
    });
    return (
      <div className={rootClasses}>
        Lon,Lat : <span>{`${latLng[0]}°, ${latLng[1]}°`}</span>
      </div>
    );
  }

  render() {
    const { product, fetchingInitialData, hideUI, enableZoomToRover, enableFootprintVisualization, enableOpenInCAMP } =
      this.props;
    const {
      pixelsPerMeter,
      fetchingFootprint,
      footprintPolygon,
      compactWidth,
      mapConfig,
      initializationSuccess,
      initialized,
      dnLatLng,
    } = this.state;

    // Config escape hatch in case something changes from the CAMP side that
    // causes issues that ASTRIA cannot gracefully handle.
    if (!initialized) return <EmptyState text="Loading..." />;

    if (mapConfig && !mapConfig.enabled) return <EmptyState text="Map Capabilities Disabled" icon={<WarningIcon />} />;

    if (!initializationSuccess) return <EmptyState text="Unable to load map" icon={<WarningIcon />} />;

    let productVisualizationUnavailableMessage = '';
    if (!fetchingInitialData) {
      if (!product) {
        productVisualizationUnavailableMessage = 'Select an Image';
      }
      // If the product does not have a footprint or has no RMC or is a heli product
      // show a message
      else if ((!footprintPolygon || !this.productHasSiteAndDrive(product) || isHeli(product)) && !fetchingFootprint) {
        productVisualizationUnavailableMessage = 'Product Visualization Not Available';
      }
    }

    const toolbarClasses = classNames({
      [renderedImagePaneStyles.controlButtonsContainer]: true,
      [MapViewStyles.controlButtonsContainer]: true,
      [MapViewStyles.controlButtonsCompact]: compactWidth,
    });

    if (hideUI) {
      return (
        <div className={MapViewStyles.root}>
          <div className={MapViewStyles.mapContainer}>
            <div ref={this.mapRef} id={this.leafletMapId}></div>
          </div>
        </div>
      );
    }

    return (
      <div className={MapViewStyles.root}>
        <div className={MapViewStyles.mapContainer}>
          <div ref={this.mapRef} id={this.leafletMapId}></div>
          {this.renderCursorLocation()}
          {enableFootprintVisualization &&
            productVisualizationUnavailableMessage &&
            !dnLatLng &&
            this.renderProductVisualizationNotAvailable(productVisualizationUnavailableMessage)}
          <div className={MapViewStyles.scalebarContainer}>
            <Scalebar className={MapViewStyles.scalebar} size={70} pixelsPerMeter={pixelsPerMeter} draggable={false} />
          </div>
        </div>
        <div className={toolbarClasses} ref={this.iconBarContainerNodeRef}>
          {compactWidth && this.renderMouseLocation()}
          <div className={compactWidth ? MapViewStyles.controlButtonSegmentCompact : ''}>
            <div className={renderedImagePaneStyles.controlButtonSegment}>
              <div className={renderedImagePaneStyles.controlButton}>
                <Tooltip overlay="Zoom In" placement="top">
                  <Button
                    aria-label="Zoom In"
                    className={renderedImagePaneStyles.controlButton}
                    icon={<PlusIcon />}
                    variant="icon"
                    onClick={this.zoomIn}
                  />
                </Tooltip>
              </div>
              <div className={renderedImagePaneStyles.spacer} />
              <Tooltip overlay="Zoom Out" placement="top">
                <Button
                  aria-label="Zoom Out"
                  className={renderedImagePaneStyles.controlButton}
                  icon={<MinusIcon />}
                  variant="icon"
                  onClick={this.zoomOut}
                />
              </Tooltip>
              <div className={renderedImagePaneStyles.divider} />
              <Tooltip overlay="Zoom to Cursor" placement="top">
                <Button
                  aria-label="Zoom to Cursor"
                  disabled={!this.state.cursorPoint}
                  className={renderedImagePaneStyles.controlButton}
                  icon={<CrosshairsLooseIcon />}
                  variant="icon"
                  onClick={this.centerMapOnCursor}
                />
              </Tooltip>
              {enableZoomToRover && (
                <>
                  <div className={renderedImagePaneStyles.spacer} />
                  <Tooltip overlay="Zoom to Rover" placement="top">
                    <Button
                      aria-label="Zoom to Rover"
                      className={renderedImagePaneStyles.controlButton}
                      icon={<RoverIcon />}
                      variant="icon"
                      onClick={this.centerMapOnRMC}
                    />
                  </Tooltip>
                </>
              )}
              {enableFootprintVisualization && (
                <>
                  <div className={renderedImagePaneStyles.spacer} />
                  <Tooltip overlay="Zoom to Footprint" placement="top">
                    <Button
                      aria-label="Zoom to Footprint"
                      disabled={!footprintPolygon}
                      className={renderedImagePaneStyles.controlButton}
                      icon={<NavcamIcon />}
                      variant="icon"
                      onClick={this.centerMapOnFootprint}
                    />
                  </Tooltip>
                </>
              )}
              <div className={renderedImagePaneStyles.spacer} />

              <ControlsOverlay
                disabled={!this.roverWaypoints}
                overlayPlacement="top"
                full={false}
                noPadding={true}
                className={renderedImagePaneStyles.controlButton}
                icon={<PinIcon />}
                tooltipProps={{
                  placement: 'top',
                  overlay: 'Go to RMC',
                  trigger: ['click', 'hover'],
                  getTooltipContainer: () => this.iconBarContainerNodeRef.current,
                }}
              >
                {this.renderRMCControl()}
              </ControlsOverlay>
              <div className={renderedImagePaneStyles.spacer} />

              {enableOpenInCAMP && (
                <Tooltip overlay="Open in CAMP" placement="top">
                  <Button
                    aria-label="Open in CAMP"
                    disabled={!product}
                    style={{ opacity: product ? 1 : 0.5 }}
                    className={renderedImagePaneStyles.controlButton}
                    icon={<CAMPLogo />}
                    variant="icon"
                    onClick={this.openInCAMP}
                  />
                </Tooltip>
              )}

              <div className={renderedImagePaneStyles.divider} />
              <ControlsOverlay
                overlayPlacement="top"
                full={false}
                noPadding={true}
                className={renderedImagePaneStyles.controlButton}
                icon={<LayersIcon />}
                tooltipProps={{
                  placement: 'top',
                  overlay: 'Map Layers',
                  trigger: ['click', 'hover'],
                  getTooltipContainer: () => this.iconBarContainerNodeRef.current,
                }}
              >
                {this.renderMapLayersControl()}
              </ControlsOverlay>
              <div className={renderedImagePaneStyles.divider} />
              {!compactWidth && this.renderMouseLocation()}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

MapView.defaultProps = {
  groups: [],
  cursor: {},
  fetchingInitialData: false,
  isCustomProduct: false,
  hasPartialMetadata: false,
  fetchingGroups: false,
  onShapeDrawn: () => {},
  setDataCursorExternally: () => {},
  setTargetMetadataOpen: () => {},
  clearDataCursor: () => {},
  onZoomEnd: () => {},
  shapes: [],
  enableDraw: false,
  hideUI: false,
  interactive: true,
  enableFootprintVisualization: true,
  enableZoomToRover: true,
  enableOpenInCAMP: true,
  waypointDotHideZoomLevel: 14,
};

MapView.propTypes = {
  instanceName: PropTypes.string,
  product: PropTypes.object,
  cursor: PropTypes.object,
  groups: PropTypes.arrayOf(PropTypes.object),
  hasPartialMetadata: PropTypes.bool,
  fetchingGroups: PropTypes.bool,
  isCustomProduct: PropTypes.bool,
  fetchingInitialData: PropTypes.bool,
  setDataCursorExternally: PropTypes.func,
  setTargetMetadataOpen: PropTypes.func,
  onShapeDrawn: PropTypes.func,
  onZoomEnd: PropTypes.func,
  clearDataCursor: PropTypes.func,
  enableDraw: PropTypes.bool,
  shapes: PropTypes.arrayOf(PropTypes.object),
  hideUI: PropTypes.bool,
  interactive: PropTypes.bool,
  enableFootprintVisualization: PropTypes.bool,
  enableZoomToRover: PropTypes.bool,
  enableOpenInCAMP: PropTypes.bool,
  waypointDotHideZoomLevel: PropTypes.number,
};

export default MapView;
