import booleanWithin from '@turf/boolean-within';
import { point } from '@turf/helpers';
import classNames from 'classnames';
import leaflet from 'leaflet';
import debounce from 'lodash.debounce';
import throttle from 'lodash.throttle';
import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import Modal from 'react-modal';
import { components } from 'react-select';
import MapView from 'src/components/activeProduct/MapView';
import Button from 'src/components/common/Button';
import { CheckIcon, CloseIcon, PencilIcon, WarningIcon } from 'src/components/common/Icons';
import Select from 'src/components/common/Select';
import Slider from 'src/components/common/Slider';
import Tip from 'src/components/common/Tip';
import MapViewContainer from 'src/containers/MapViewContainer';
import alertStyles from 'src/styles/Alert.module.css';
import FacetSearchStyles from 'src/styles/FacetSearch.module.css';
import FootprintFacetStyles from 'src/styles/FootprintFacet.module.css';
import FormsStyles from 'src/styles/Forms.module.css';
import TypographyStyles from 'src/styles/common/typography.module.css';
import { genWKTString, objAlphaSort } from 'src/utils';
import { getConfig } from 'src/utils/configRegistry';
import { getFootprintsForGeoJSON, padGeoJSONBoundingBox } from 'src/utils/dataQuery';
import { getAlias } from 'src/utils/sharedUtils';
import Wkt from 'wicket';

const DEFAULT_RMC_DISTANCE = 150;
class FootprintFacet extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      footprints: [],
      loadingFootprints: false,
      isModalOpen: false,
      geoJSON: null,
      editingShape: false,
      editorValue: '',
      rmcDistance: DEFAULT_RMC_DISTANCE, // max distance from rmc image location to search shape
      rmcShape: null,
      instrumentAggs: [],
      selectedInstruments: [],
      range: [0, 360],
      angle: 0,
    };

    this.dirtyValues = {};
    this.closeModal = this.closeModal.bind(this);
    this.modalTargetEl = document.getElementById('genericModalPortalTarget');
    this.miniMapRef = React.createRef();
    this.mapRef = React.createRef();
    this.debouncedGetFootprints = debounce(this.getFootprints.bind(this), 500, {
      // leading: true,
      trailing: true,
    });
    this.throttledStyleWaypoints = throttle(this.styleWaypoints.bind(this), 50, {
      leading: true,
      trailing: true,
    });
    this.footprintsAbortController = null;
    this.aggsAbortController = null;
  }

  componentDidMount() {
    this.setStateFromValues();
  }

  async componentDidUpdate(prevProps, prevState) {
    const { inverted, onChange, values } = this.props;

    // If values have changed, set internal state values
    if (JSON.stringify(prevProps.values) !== JSON.stringify(this.props.values)) {
      this.setStateFromValues();
    }

    if (prevProps.inverted !== inverted) {
      const query = await this.getQuery(values);
      onChange(query, values);
    }

    if (JSON.stringify(prevState.geoJSON) !== JSON.stringify(this.state.geoJSON)) {
      this.setState({ editorValue: this.state.geoJSON ? JSON.stringify(this.state.geoJSON) : '' });
    }

    const geoJSONDiff = JSON.stringify(prevState.geoJSON) !== JSON.stringify(this.state.geoJSON);
    if (
      geoJSONDiff ||
      JSON.stringify(prevState.selectedInstruments) !== JSON.stringify(this.state.selectedInstruments) ||
      JSON.stringify(prevState.range) !== JSON.stringify(this.state.range) ||
      (prevState.rmcDistance !== this.state.rmcDistance &&
        !(isNaN(prevState.rmcDistance) && isNaN(this.state.rmcDistance))) ||
      (prevState.angle !== this.state.angle && !(isNaN(prevState.angle) && isNaN(this.state.angle)))
    ) {
      this.throttledStyleWaypoints();

      // Immediate trigger footprint search if user has just drawn geoJSON
      if (geoJSONDiff) this.getFootprints(this.state.geoJSON);
      else this.debouncedGetFootprints(this.state.geoJSON);
    }
  }

  setStateFromValues() {
    const { geoJSON, rmcDistance, rmcShape, selectedInstruments, range, angle } = this.parseValues(this.props.values);
    this.setState({ geoJSON, rmcDistance, rmcShape, selectedInstruments, range, angle });
  }

  parseValues(values = []) {
    let geoJSON = null;
    let rmcDistance = DEFAULT_RMC_DISTANCE;
    let rmcShape = null;
    let range = this.state.range;
    let angle = this.state.angle;
    let selectedInstruments = [];
    try {
      // Check for case of legacy lon lat values
      if (values.length === 2 && !isNaN(values[0]) && !isNaN(values[1])) {
        const wkt = genWKTString({
          coords: [[parseFloat(values[0]), parseFloat(values[1])]],
          shape: 'point',
        });
        geoJSON = this.wktToGeoJSON(wkt);
      } else {
        if (values.length > 0) {
          geoJSON = this.parseGeoJSONFromValue(values[0]);
        }
        if (values.length > 1 && geoJSON) {
          const rmcDistanceParsed = parseInt(values[1]);
          rmcDistance = !isNaN(rmcDistanceParsed) ? rmcDistanceParsed : DEFAULT_RMC_DISTANCE;
        }
        if (values.length > 2) {
          // selectedInstruments = values[2].split('_');
          const [rangeMin, rangeMax] = values[2].split('_');
          const rangeMinParsed = parseInt(rangeMin);
          const rangeMaxParsed = parseInt(rangeMax);
          if (!isNaN(rangeMinParsed)) range[0] = rangeMinParsed;
          if (!isNaN(rangeMaxParsed)) range[1] = rangeMaxParsed;
          range = [!isNaN(rangeMinParsed) ? rangeMinParsed : 0, !isNaN(rangeMaxParsed) ? rangeMaxParsed : 360];
        }
        if (values.length > 3) {
          const angleParsed = parseInt(values[3]);
          if (!isNaN(angleParsed)) angle = angleParsed;
        }
        if (values.length > 4 && values[4]) {
          selectedInstruments = values[4].split('_');
        }
      }
    } catch (err) {
      console.log(err);
    }
    rmcShape = padGeoJSONBoundingBox(geoJSON, rmcDistance, range, angle);
    return { geoJSON, rmcDistance, rmcShape, selectedInstruments, range, angle };
  }

  closeModal() {
    this.setState({ isModalOpen: false });
  }

  transformLayerToGeoJSON(layer) {
    return layer.toGeoJSON().geometry;
  }

  wktToGeoJSON(wktString) {
    try {
      return new Wkt.Wkt().read(wktString.replaceAll('_', ',')).toJson();
    } catch (_err) {
      return null;
    }
  }

  geoJSONtoWKT(geoJSON) {
    try {
      return new Wkt.Wkt().fromObject(geoJSON).write();
    } catch (_err) {
      return '';
    }
  }

  getQuery(values, freshSearch = true) {
    const { footprints: stateFootprints, loadingFootprints } = this.state;
    const { inverted } = this.props;
    return new Promise(async (resolve) => {
      try {
        if (!values) {
          resolve(null);
          return;
        }
        const { geoJSON, rmcShape, selectedInstruments } = this.parseValues(values);
        if (geoJSON) {
          this.setState({ loadingFootprints: true });
          // get footprints that overlap the search values
          let footprints = [];
          if (!freshSearch && !loadingFootprints) {
            footprints = stateFootprints;
          } else {
            footprints = (await getFootprintsForGeoJSON(geoJSON, null, rmcShape?.geometry, selectedInstruments))
              .footprints;
          }
          this.setState({ loadingFootprints: false });

          // query all the matching images the footprints were derived from
          const filenames = footprints.map((x) => x.footprint_for_edr.replace('.VIC', '.IMG'));
          const query = {
            terms: {
              ocs_name: filenames,
            },
          };

          const mustOrMustNot = inverted ? 'must_not' : 'must';
          const finalQuery = {
            bool: {
              [mustOrMustNot]: query,
            },
          };
          resolve(finalQuery);
        } else {
          this.setState({ loadingFootprints: false });
          resolve(null);
        }
      } catch (err) {
        console.log(err);
        this.setState({ loadingFootprints: false });
        resolve(null);
      }
    });
  }

  parseGeoJSONFromValue(value) {
    if (!value) return null;
    try {
      let geoJSON;
      // Assume WKT if string
      if (typeof value === 'string') {
        geoJSON = this.wktToGeoJSON(value);
      } else {
        geoJSON = value;
      }
      return geoJSON;
    } catch (err) {
      console.log(err);
      return null;
    }
  }

  parseEditorValue = () => {
    // Look for WKT string, GeoJSON, or comma separated lon/lats

    const { editorValue } = this.state;
    let geoJSON;
    let error = '';

    // GeoJSON
    try {
      geoJSON = JSON.parse(editorValue);
      // TODO check for multipolygon...
    } catch (_err) {
      // WKT
      try {
        geoJSON = this.wktToGeoJSON(editorValue);
        if (!geoJSON) throw new Error('Unable to parse WKT');
      } catch (_err2) {
        try {
          const splits = editorValue.split(',');
          if (splits.length) {
            const entries = splits.map((x) => parseFloat(x)).filter((x) => !isNaN(x) && typeof x === 'number');
            if (entries.length < 2) throw new Error('Unable to parse string');

            const coords = [];
            for (let i = 0; i < entries.length; i += 2) {
              coords.push([entries[i], entries[i + 1]]);
            }
            const wkt = genWKTString({ coords, forceCircle: true, shape: coords.length === 1 ? 'point' : 'polygon' });
            geoJSON = this.wktToGeoJSON(wkt);
          } else {
            error = 'Could not parse geometry';
          }
        } catch (_err3) {
          error = 'Could not parse geometry';
        }
      }
    }
    if (geoJSON && typeof geoJSON === 'object') {
      if (geoJSON.geometry) geoJSON = geoJSON.geometry; // Ensure we're only looking at the geometry part of the object
      const rmcShape = geoJSON
        ? padGeoJSONBoundingBox(geoJSON, this.state.rmcDistance, this.state.range, this.state.angle)
        : null;
      this.setState({ geoJSON, rmcShape }, () => {
        this.centerMapOnShapes(this.mapRef.current);
      });
    }

    if (error) {
      console.warn(error);
    }
  };

  styleWaypoints = () => {
    try {
      if (this.mapRef && this.mapRef.current) {
        const waypoints = this.mapRef.current.roverWaypoints;
        if (waypoints) {
          waypoints.setStyle((feature) => {
            const [lng, lat] = feature.geometry.coordinates;
            const wPoint = point([lng, lat]);
            const within = this.state.rmcShape ? booleanWithin(wPoint, this.state.rmcShape) : false;
            return {
              fillColor: within ? 'red' : 'white',
            };
          });
        }
      }
    } catch (err) {
      console.log(err);
    }
  };

  setRMCDistance(value) {
    if (!this.state.geoJSON) return;
    this.setState({
      rmcDistance: value,
      rmcShape: padGeoJSONBoundingBox(this.state.geoJSON, value, this.state.range, this.state.angle),
    });
  }

  setFOV(min = 0, max = 360) {
    if (!this.state.geoJSON) return;
    const range = [min, max];
    this.setState({
      range: range,
      rmcShape: padGeoJSONBoundingBox(this.state.geoJSON, this.state.rmcDistance, range, this.state.angle),
    });
  }

  setViewAngle(value) {
    if (!this.state.geoJSON) return;
    this.setState({
      angle: value,
      rmcShape: padGeoJSONBoundingBox(this.state.geoJSON, this.state.rmcDistance, this.state.range, value),
    });
  }

  getShapes() {
    const { geoJSON, rmcShape } = this.state;
    return geoJSON
      ? [
          {
            geoJSON,
            style: {
              interactive: false,
              color: 'rgb(255, 0, 0)',
            },
          },
          {
            geoJSON: rmcShape,
            style: {
              interactive: false,
              color: 'rgb(255, 255, 255)',
              opacity: 0.5,
              dashArray: '4 8',
            },
          },
        ]
      : [];
  }

  CustomMultiValueLabel = (props) => {
    const { data } = props;
    return <div className={FacetSearchStyles.selectValueLabel}>{this.getMultiSelectResultLabel(data.value)}</div>;
  };

  CustomOption = (props) => {
    const { data, children: _children, ...rest } = props;
    return (
      <components.Option {...rest}>
        {this.getMultiSelectResultLabel(data.value)}
        <span className={FacetSearchStyles.selectOptionCount}>{data.label}</span>
      </components.Option>
    );
  };

  getMultiSelectResultLabel(value) {
    return getAlias('instrument_id', value);
  }

  renderInstrumentDropdown() {
    const { instrumentAggs, selectedInstruments, loadingFootprints, geoJSON } = this.state;
    const options = objAlphaSort(
      instrumentAggs.map((result) => {
        return { value: result.value, label: result.count };
      }),
      'value'
    );
    const selectedValues = selectedInstruments.map((value) => {
      return { value, label: value };
    });

    return (
      <Select
        menuPlacement="top"
        className={FootprintFacetStyles.select}
        multi
        clearable
        components={{ MultiValueLabel: this.CustomMultiValueLabel, Option: this.CustomOption }}
        placeholder="Select..."
        isLoading={loadingFootprints}
        disabled={!geoJSON}
        closeMenuOnSelect={false}
        label="Instruments"
        labelWidth="80px"
        labelPosition="left"
        value={selectedValues}
        options={options}
        onChange={(selectedOptions) => {
          this.setState({ selectedInstruments: (selectedOptions || []).map((o) => o.value) });
        }}
      />
    );
  }

  renderModal() {
    const config = getConfig();
    const { loadingFootprints, isModalOpen, geoJSON, rmcDistance, footprints, range, angle } = this.state;
    const { openHelpArticle } = this.props;

    const shapes = this.getShapes();

    const modalClass = classNames({
      [alertStyles.alert]: true,
      [FootprintFacetStyles.modal]: true,
    });
    const modalHeaderClass = classNames({
      [alertStyles.headerContainer]: true,
      [FootprintFacetStyles.headerContainer]: true,
    });
    const modalActionRowClass = classNames({
      [alertStyles.actionRow]: true,
      [FootprintFacetStyles.actionRow]: true,
    });
    const textareaClass = classNames({
      [FootprintFacetStyles.textarea]: true,
      [FormsStyles.textarea]: true,
      [FormsStyles.input]: true,
    });
    const sliderInputClass = classNames({
      [FormsStyles.autosuggestInputContainer]: true,
      [FormsStyles.textInput]: true,
      [FootprintFacetStyles.sliderInput]: true,
    });

    return (
      <Modal
        overlayClassName={{
          // TODO move these into a diff stylesheet, maybe abstract this into generic modal
          base: alertStyles.overlayBase,
          afterOpen: alertStyles.afterOpen,
          beforeClose: alertStyles.beforeClose,
        }}
        className={modalClass}
        isOpen={isModalOpen}
        onRequestClose={this.closeModal}
        shouldCloseOnOverlayClick
        shouldCloseOnEsc
      >
        <div className={modalHeaderClass}>
          <div className={alertStyles.title}>Map Area Search</div>
          <Button aria-label="Close" variant="icon" icon={<CloseIcon />} onClick={this.closeModal} />
        </div>
        <div className={FootprintFacetStyles.modalContent}>
          <div className={FootprintFacetStyles.message}>
            <Tip>
              Draw an area on the map to search for images that intersect that area. Filter the images by instrument and
              by the location at which the images were acquired.&nbsp;
              <button
                type="button"
                onClick={() => openHelpArticle('search_for_images/search_image_by_geospatial_location')}
                className={TypographyStyles.learnMore}
              >
                Learn More
              </button>
            </Tip>
          </div>
          <MapViewContainer
            ref={this.mapRef}
            enableOpenInCAMP={false}
            enableZoomToRover={false}
            enableFootprintVisualization={false}
            enableDraw
            waypointDotHideZoomLevel={0}
            shapes={shapes}
            onShapeDrawn={(shape) => {
              const geoJSON = this.transformLayerToGeoJSON(shape);
              const rmcShape = geoJSON
                ? padGeoJSONBoundingBox(geoJSON, this.state.rmcDistance, this.state.range, this.state.angle)
                : null;
              this.setState({ geoJSON, rmcShape });
            }}
            onZoomEnd={this.styleWaypoints}
            instanceName="footprintFacetMapArea"
          />
          {this.state.editingShape && (
            <div className={FootprintFacetStyles.editor}>
              <textarea
                disabled={loadingFootprints}
                className={textareaClass}
                placeholder='E.g. POINT(77.42949486 18.44126304) or 77.42949486,18.44126304 or {"type":"Point","coordinates":[77.42949486,18.44126304]}'
                type="string"
                value={this.state.editorValue}
                onChange={(evt) => this.setState({ editorValue: evt.target.value })}
              />
              <div className={FootprintFacetStyles.editorBottomRow}>
                <Tip>Draw on the map or paste in GeoJSON, WKT, or Lat/Lon coordinates.</Tip>
                <Button text="Set shape" variant="secondary" onClick={this.parseEditorValue} />
              </div>
            </div>
          )}
        </div>
        <div className={FootprintFacetStyles.row}>
          <div className={FootprintFacetStyles.instrumentsSelectContainer}>{this.renderInstrumentDropdown()}</div>
          <Button
            variant="secondary"
            text={`${this.state.editingShape ? 'Hide' : 'Show'} Shape Editor`}
            onClick={() => this.setState({ editingShape: !this.state.editingShape })}
          />
        </div>
        <div className={FootprintFacetStyles.row}>
          <div className={FootprintFacetStyles.sliderInputs}>
            <div className={FootprintFacetStyles.sliderInputGroup}>
              <div className={FootprintFacetStyles.sliderLabel}>Image Acquisition Distance (m)</div>
              <Slider
                disabled={!geoJSON}
                wrapperClassName={FootprintFacetStyles.slider}
                value={Math.log(rmcDistance)}
                min={Math.log(1)}
                max={Math.log(100000)}
                step={0.1}
                showTooltip={false}
                onChange={(value) => {
                  if (!geoJSON) return;
                  const roundedValue = parseFloat(Math.exp(value).toFixed(0));
                  this.setRMCDistance(roundedValue);
                }}
              />
              <input
                disabled={!geoJSON}
                className={sliderInputClass}
                placeholder="E.g. 150m"
                aria-label="Distance in meters"
                type="number"
                max={100000}
                min={0}
                step={5}
                value={isNaN(rmcDistance) ? '' : rmcDistance}
                onChange={(evt) => this.setRMCDistance(parseInt(evt.target.value))}
              />
            </div>
            <div className={FootprintFacetStyles.sliderInputGroup}>
              <div className={FootprintFacetStyles.sliderLabel}>Field of View</div>
              <input
                aria-label="Field of view"
                disabled={!geoJSON}
                className={sliderInputClass}
                type="number"
                max={isNaN(range[1]) ? 360 : range[1]}
                min={0}
                step={2}
                value={isNaN(range[0]) ? '' : range[0]}
                onChange={(evt) => this.setFOV(parseInt(evt.target.value), this.state.range[1])}
              />
              <Slider
                disabled={!geoJSON}
                wrapperClassName={FootprintFacetStyles.slider}
                type="range"
                value={range}
                min={0}
                max={360}
                step={2}
                allowCross={false}
                showTooltip={false}
                onChange={(value) => this.setFOV(value[0], value[1])}
              />
              <input
                aria-label="Field of view range"
                disabled={!geoJSON}
                className={sliderInputClass}
                type="number"
                max={360}
                min={Math.max(isNaN(range[0]) ? 0 : range[0], 4)}
                step={2}
                value={isNaN(range[1]) ? '' : range[1]}
                onChange={(evt) => this.setFOV(this.state.range[0], parseInt(evt.target.value))}
              />
            </div>
            <div className={FootprintFacetStyles.sliderInputGroup}>
              <div className={FootprintFacetStyles.sliderLabel}>View Angle</div>
              <Slider
                disabled={!geoJSON}
                wrapperClassName={FootprintFacetStyles.slider}
                value={angle}
                min={0}
                max={360}
                step={1}
                allowCross={false}
                showTooltip={false}
                onChange={(value) => this.setViewAngle(value)}
              />
              <input
                aria-label="View angle range"
                disabled={!geoJSON}
                className={sliderInputClass}
                type="number"
                min={0}
                max={360}
                step={1}
                value={isNaN(angle) ? '' : angle}
                onChange={(evt) => this.setViewAngle(parseInt(evt.target.value))}
              />
            </div>
          </div>
        </div>
        <div className={modalActionRowClass}>
          <div className={FootprintFacetStyles.footprintCountContainer}>
            {geoJSON && !loadingFootprints && (
              <>
                {footprints.length > 999 ? (
                  <div className={FootprintFacetStyles.footprintCount}>
                    <WarningIcon />
                    Found {footprints.length}+ footprints, narrow your area filters to ensure all footprints can be
                    included in the main {config.app_title} search.
                    <button
                      type="button"
                      onClick={() => openHelpArticle('search_for_images/search_image_by_geospatial_location')}
                      className={TypographyStyles.learnMore}
                    >
                      Learn More
                    </button>
                  </div>
                ) : footprints.length === 0 ? (
                  <div className={FootprintFacetStyles.footprintCount}>
                    <WarningIcon />
                    No footprints found, try expanding your search and image acquisition areas.
                  </div>
                ) : (
                  <div className={FootprintFacetStyles.footprintCount}>
                    <CheckIcon />
                    {footprints.length} matching footprints
                  </div>
                )}
              </>
            )}
            <div className={FootprintFacetStyles.footprintCount}>
              {loadingFootprints && 'Searching for image footprints...'}
            </div>
          </div>
          {!geoJSON && !loadingFootprints && (
            <div className={FootprintFacetStyles.footprintCount}>
              <PencilIcon /> Draw an area using the controls in the top left of the map
            </div>
          )}
          <Button variant="secondary" text="Cancel" onClick={this.closeModal} />
          <Button
            variant="secondary"
            text="Clear Shape"
            onClick={async () => {
              this.abortInFlightRequests();
              this.setState({ geoJSON: null, rmcShape: null, loadingFootprints: false, footprints: [] });
              await this.onChange(null, false);
              this.closeModal();
            }}
          />
          <Button
            className={FootprintFacetStyles.submitButton}
            variant="primary"
            text="Submit"
            disabled={loadingFootprints || !geoJSON}
            onClick={async () => {
              if (geoJSON) {
                await this.onChange(geoJSON, false);
                this.closeModal();
              }
            }}
          />
        </div>
      </Modal>
    );
  }

  async onChange(geoJSON, freshSearch = true) {
    const wktString = this.geoJSONtoWKT(geoJSON);
    const escapedWktString = wktString.replaceAll(',', '_');
    let valueArray = [];
    if (!escapedWktString) valueArray = null;
    else {
      // Encoded as [<escapedWKTString>,rmcDistance,[fovMin, fovMax],viewAngle,[instrument1,...]]
      valueArray.push(escapedWktString);
      valueArray.push(this.state.rmcDistance);
      valueArray.push(`${this.state.range[0]}_${this.state.range[1]}`);
      valueArray.push(this.state.angle);
      valueArray.push(this.state.selectedInstruments.join('_'));
    }
    const query = await this.getQuery(valueArray, freshSearch);
    this.props.onChange(query, valueArray);
    this.centerMapOnShapes();
  }

  centerMapOnShapes(mapViewRef = this.miniMapRef.current) {
    try {
      if (mapViewRef) {
        const { geoJSON, rmcShape } = this.state;
        const shapes = new leaflet.FeatureGroup([leaflet.geoJSON(geoJSON), leaflet.geoJSON(rmcShape)]);
        mapViewRef.centerMapOnShapes(shapes);
      }
    } catch (e) {
      console.log(e);
    }
  }

  abortInFlightRequests() {
    if (this.footprintsAbortController) {
      this.footprintsAbortController.abort();
    }
    if (this.aggsAbortController) {
      this.aggsAbortController.abort();
    }
  }

  async getFootprints(geoJSON) {
    const { rmcShape, selectedInstruments } = this.state;
    if (geoJSON) {
      this.setState({ loadingFootprints: true });
      try {
        this.abortInFlightRequests();
        this.footprintsAbortController = new AbortController();
        this.aggsAbortController = new AbortController();

        const footprintsSignal = this.footprintsAbortController.signal;
        const aggsSignal = this.aggsAbortController.signal;

        const results = await Promise.all([
          await getFootprintsForGeoJSON(geoJSON, null, rmcShape?.geometry, selectedInstruments, footprintsSignal),
          await getFootprintsForGeoJSON(geoJSON, null, rmcShape?.geometry, [], null, 0, aggsSignal),
        ]);

        if (results[0].aborted || results[1].aborted) return;
        const { footprints } = results[0];
        const { aggs } = results[1];
        this.setState({ loadingFootprints: false, footprints, instrumentAggs: aggs });
      } catch (err) {
        // TODO what to do here?
        if (err.name !== 'AbortError') {
          console.log('Error fetching footprints', err);
          this.setState({ loadingFootprints: false, footprints: [], instrumentAggs: [] });
        }
      }
    }
  }

  render() {
    const { geoJSON } = this.state;
    const shapes = this.getShapes();

    return (
      <div className={FootprintFacetStyles.facet}>
        <div className={FacetSearchStyles.selectionStatusMessage}>
          {geoJSON && (
            <>
              <span>Shape selected</span>
              <Button variant="text" text="Clear" onClick={() => this.onChange()} />
            </>
          )}
          {!geoJSON && <span>No area selected</span>}
        </div>
        {geoJSON && (
          <div className={FootprintFacetStyles.map}>
            <MapView
              ref={this.miniMapRef}
              shapes={shapes}
              hideUI
              interactive={false}
              instanceName="footprintFacetMinimap"
            />
          </div>
        )}
        <Button variant="secondary" text="Open Map" onClick={() => this.setState({ isModalOpen: true })} />
        {ReactDOM.createPortal(this.renderModal(), this.modalTargetEl)}
      </div>
    );
  }
}

FootprintFacet.defaultProps = {
  values: [],
  baseQueries: [],
};

FootprintFacet.propTypes = {
  facet: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  baseQueries: PropTypes.array,
  values: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string])),
  openHelpArticle: PropTypes.func.isRequired,
  inverted: PropTypes.bool,
};

export default FootprintFacet;
