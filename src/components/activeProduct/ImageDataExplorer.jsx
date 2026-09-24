import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import ImageDataResult from 'src/components/activeProduct/ImageDataResult';
import Button from 'src/components/common/Button';
import { ExternalLinkOutlined } from 'src/components/common/Icons';
import Toggle from 'src/components/common/Toggle';
import DataCursorControlContainer from 'src/containers/DataCursorControlContainer';
import { default as TypographyStyles, default as typographyStyles } from 'src/styles/common/typography.module.css';
import imageDataExplorerStyles from 'src/styles/ImageDataExplorer.module.css';
import panelStyles from 'src/styles/Panel.module.css';
import ProductDetailsStyles from 'src/styles/ProductDetails.module.css';
import ProductSummaryStyles from 'src/styles/ProductSummary.module.css';
import { lsToAzEl, objAlphaSort, openInNewTab, round } from 'src/utils';
import { getConfig } from 'src/utils/configRegistry';
import { fetchDataForProduct, getLatestVersionsByType, getOrbitalCoordsForLineSample } from 'src/utils/dataQuery';
import { CAMPGetLinkForLatLon } from 'src/utils/endpoints';
import { getDescendantProp, getPropFromProduct } from 'src/utils/sharedUtils';
import * as telemetry from 'src/utils/telemetryUtils';

const productLoadingLabel = <div className={imageDataExplorerStyles.productResultLoading}>Loading</div>;
const productErrorLabel = <div className={imageDataExplorerStyles.productResultError}>Request Failed</div>;
const noXYZLabel = <div className={imageDataExplorerStyles.productResultNoData}>No XYZ Data</div>;

export class ImageDataExplorer extends React.Component {
  constructor(props) {
    super(props);

    this.cursorPosition = {
      label: 'Cursor Position',
      permanent: true,
      data: {},
    };

    this.orbitalPosition = {
      label: 'Orbital Position',
      permanent: true,
      data: {},
    };

    this.dnControllers = {};

    this.dataStore = {
      line: -1,
      sample: -1,
      dataMap: {},
    };
  }

  componentDidMount() {
    this.syncDataStore();
    this.updateDataStore(true);
  }

  componentWillUnmount() {
    this.clearDataStore();
  }

  componentDidUpdate(prevProps) {
    const config = getConfig();
    const {
      product: prevProduct,
      cursor: prevCursor,
      activeOverlays: prevActiveOverlays,
      fetchingGroups: prevFetchingGroups,
      autoAddRDRs: prevAutoAddRDRs,
    } = prevProps;
    const { product, cursor, activeOverlays, fetchingGroups, autoAddRDRs } = this.props;

    const { line, sample } = cursor;
    const { line: prevLine, sample: prevSample } = prevCursor;

    // determine if the datastore may need to be cleared
    const newOverlayId =
      getPropFromProduct(product, config.es_mappings.overlay_id) !==
      getPropFromProduct(prevProduct, config.es_mappings.overlay_id);
    const groupLoadingDone = !fetchingGroups && prevFetchingGroups;
    const shouldClear = newOverlayId || groupLoadingDone;

    // determine if the datastore needs to be resynced
    const autoAdd = autoAddRDRs && !prevAutoAddRDRs;
    const newProduct =
      getPropFromProduct(product, config.es_mappings.id) !== getPropFromProduct(prevProduct, config.es_mappings.id);

    const prevOverlayIds = prevActiveOverlays.map((prod) => getPropFromProduct(prod, config.es_mappings.id));
    const newOverlays =
      prevActiveOverlays.length !== activeOverlays.length || // something was added OR removed
      activeOverlays.reduce((acc, prod) => {
        // something was added AND removed
        if (prevOverlayIds.indexOf(getPropFromProduct(prod, config.es_mappings.id)) === -1) {
          return true;
        }
        return acc;
      }, false);
    const shouldSync = (newProduct && !newOverlayId) || newOverlays || autoAdd;

    // determine if the datastore is for a stale point
    const newPoint = line !== prevLine || sample !== prevSample;
    const shouldUpdate = newPoint;

    if (shouldClear) {
      this.clearDataStore();
      this.syncDataStore();
      this.updateDataStore(true);
    } else if (shouldSync) {
      this.syncDataStore();
      this.updateDataStore(false);
    } else if (shouldUpdate) {
      this.updateDataStore(true);
    }
  }

  openCAMPLink = () => {
    const { product } = this.props;
    const { data } = this.orbitalPosition;
    openInNewTab(
      CAMPGetLinkForLatLon({
        latLon: {
          latitude: data.Latitude,
          longitude: data.Longitude,
        },
        text: `point in ${getPropFromProduct(product, getConfig().es_mappings.filename, null)}`,
      })
    );
  };

  // Adds product to the dataStore
  addProductToDataStore(product) {
    const config = getConfig();
    const { dataMap } = this.dataStore;
    const id = getPropFromProduct(product, config.es_mappings.id);
    const label = getPropFromProduct(product, config.es_mappings.product_type);

    let entry = dataMap[id];
    if (!entry) {
      // create a new entry for this product
      entry = {
        label,
        product,
        data: {},
      };
      this.dataStore.dataMap[id] = entry;
    }
  }

  removeProductFromDataStore(productOrId) {
    const config = getConfig();
    const { dataMap } = this.dataStore;
    const id = typeof productOrId === 'string' ? productOrId : getPropFromProduct(productOrId, config.es_mappings.id);
    const entry = dataMap[id];
    if (entry) {
      // abort any query that might be pending
      this.abortRequest(id);

      dataMap[id] = undefined;
      delete dataMap[id];
    }
  }

  clearDataStoreData() {
    // Clear out the current dataStore data when a user removes their data cursor
    // Still maintains the list of selected available products
    this.abortAllRequests();
    const { dataMap } = this.dataStore;
    const newDataMap = {};
    Object.keys(dataMap).forEach((key) => {
      const currData = dataMap[key];
      newDataMap[key] = { ...currData, data: {} };
    });
    this.dataStore.dataMap = newDataMap;
    this.dataStore.line = -1;
    this.dataStore.sample = -1;
  }

  clearDataStore(clearCursor = false) {
    this.abortAllRequests();
    this.dataStore.dataMap = {};

    if (clearCursor) {
      this.dataStore.line = -1;
      this.dataStore.sample = -1;
    }
  }

  syncDataStore() {
    const config = getConfig();
    const { product, groups, activeOverlays, autoAddRDRs } = this.props;
    const isOverlay = getPropFromProduct(product, config.es_mappings.overlayable);

    // if this is an overlay, we don't care about what's active in the viewer
    let syncProds = activeOverlays;
    if (isOverlay) {
      syncProds = [product];
    }

    // need to auto add items for the metadata panel
    const doAdd = autoAddRDRs || isOverlay;

    // this will automatically add layers but will not attempt to deactivate them
    if (doAdd) {
      syncProds.forEach((overlay) => this.addProductToDataStore(overlay));
    }

    // remove any products that are no longer availble (e.g. deselected versions)
    const availableProducts = this.getLatestGroupItems(product, groups);
    const availableProductsIds = availableProducts.reduce((acc, prod) => {
      acc[getPropFromProduct(prod, config.es_mappings.id)] = prod;
      return acc;
    }, {});
    const { dataMap } = this.dataStore;
    const dataMapIds = Object.keys(dataMap);
    dataMapIds.forEach((id) => {
      if (!availableProductsIds[id]) {
        this.removeProductFromDataStore(id);
      }
    });
  }

  // Updates either all the products in the dataStore or only those that don't have current data
  updateDataStore(updateAll = false) {
    const config = getConfig();

    const { cursor } = this.props;
    const { line: prevLine, sample: prevSample, dataMap } = this.dataStore;

    if (cursor.active) {
      //  update the cursor position in state in preparation for the data query
      this.updateCursorPositionData()
        .then((cursorPosition) => {
          const { line, sample } = cursorPosition;
          this.dataStore.line = line;
          this.dataStore.sample = sample;

          const newPoint = line !== prevLine || sample !== prevSample;

          // get a list of all the item keys that need updating
          const updateKeys = [];
          const keys = Object.keys(dataMap);
          keys.forEach((key) => {
            const entry = dataMap[key];
            // assume entries that already have data (even if its loading) do not need updating
            if (updateAll || newPoint || Object.keys(entry.data).length === 0) {
              updateKeys.push(key);
            }
          });

          // mark entries as loading and re-render
          updateKeys.forEach((key) => {
            dataMap[key].data = { Data: productLoadingLabel };
          });
          this.forceUpdate();

          // fetch the new data
          updateKeys.forEach((key) => {
            const entry = dataMap[key];
            const entryId = getPropFromProduct(entry.product, config.es_mappings.id);
            this.fetchDataForProduct(entry.product, { line, sample })
              .then((data) => {
                if (Object.keys(data).length > 0) {
                  // if there are no keys ths was likely an abort
                  this.dataStore.dataMap[entryId].data = { ...data };
                  this.forceUpdate(); // want to re-render with the new data
                }
              })
              .catch((err) => {
                if (this.dataStore.dataMap[entryId]) {
                  this.dataStore.dataMap[entryId].data = { Error: productErrorLabel };
                } else {
                  console.warn('Error updating data store, entry not found', entryId, this.dataStore.dataMap);
                }
                this.forceUpdate(); // want to re-render with the new data
                telemetry.logError(`Error fetching DN data for product: ${entryId}`, err);
              });
          });
        })
        .catch((err) => console.warn(err));
    }
  }

  updateCursorPositionData() {
    const config = getConfig();
    return new Promise(async (resolve, _reject) => {
      // signal that we're loading
      this.cursorPosition.data = { Data: productLoadingLabel };
      this.orbitalPosition.data = { Data: productLoadingLabel };
      this.orbitalPosition.footer = null;
      this.forceUpdate();

      const { product, fetchingGroups, groups, cursor, preferredImageForType } = this.props;

      let { line, sample } = cursor;

      // set the basic line/sample values
      this.cursorPosition.data = {};
      this.cursorPosition.data.Line = round(line, 3);
      this.cursorPosition.data.Sample = round(sample, 3);

      // translate to Az/El if this is a mosaic
      if (getDescendantProp(product, config.es_mappings.projection.key) === 'Cylindrical') {
        const { azimuth, elevation } = lsToAzEl(product, { line, sample });
        this.cursorPosition.data.Azimuth = `${azimuth.toFixed(3)}°`;
        this.cursorPosition.data.Elevation = `${elevation.toFixed(3)}°`;
      }

      // signal that the line/sample needed for further queries is complete
      resolve({ line, sample });

      // attempt to resolve an a basemap position for the cursor
      if (!fetchingGroups && config.feature_flags.active_product.enable_orbital_position) {
        try {
          const orbitalData = await getOrbitalCoordsForLineSample(
            product,
            groups,
            { line, sample },
            undefined,
            preferredImageForType
          );
          const { latLon, offset, lineSample } = orbitalData;
          // ensure this update is for the latest dataStore request
          if (lineSample.line === this.dataStore.line && lineSample.sample === this.dataStore.sample) {
            this.orbitalPosition.data = {};
            this.orbitalPosition.data.Latitude = latLon.latitude.toFixed(7);
            this.orbitalPosition.data.Longitude = latLon.longitude.toFixed(7);
            this.orbitalPosition.data.Easting = offset[1].toFixed(3);
            this.orbitalPosition.data.Northing = offset[0].toFixed(3);
            this.orbitalPosition.data.Elevation = offset[2].toFixed(3);
            this.orbitalPosition.footer = (
              <Button variant="text" onClick={this.openCAMPLink} text="CAMP" rightIcon={<ExternalLinkOutlined />} />
            );
          }
        } catch (err) {
          if (err.message === 'No XYZ data' || err.message === 'Missing XYZ data product') {
            this.orbitalPosition.data = { Unknown: noXYZLabel };
          } else {
            this.orbitalPosition.data = { Error: productErrorLabel };
            console.warn(err);
          }
        }
        this.forceUpdate();
      }
    });
  }

  fetchDataForProduct(product, lineSample) {
    return new Promise((resolve, reject) => {
      const config = getConfig();

      const id = getPropFromProduct(product, config.es_mappings.id);
      const controller = this.addRequestController(id);

      fetchDataForProduct(product, lineSample.line, lineSample.sample, controller.signal)
        .then((data) => {
          resolve(data);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            reject(err);
          } else {
            resolve({});
          }
        });
    });
  }

  addRequestController(key) {
    this.abortRequest(key); // abort any previous request
    const controller = new AbortController();
    this.dnControllers[key] = controller;
    return controller;
  }

  abortRequest(key) {
    const controller = this.dnControllers[key];
    if (controller) {
      controller.abort();

      // remove the controller entry because it can't be reused
      this.dnControllers[key] = undefined;
      delete this.dnControllers[key];
    }
  }

  abortAllRequests() {
    for (const key in this.dnControllers) {
      this.abortRequest(key);
    }
    this.dnControllers = {};
  }

  addDataProduct = (dataProduct) => {
    const { cursor } = this.props;
    this.addProductToDataStore(dataProduct);
    if (cursor.active) {
      this.updateDataStore(false);
    } else {
      this.forceUpdate(); // just re-render with the new selection
    }
  };

  removeDataProduct = (dataProduct) => {
    this.removeProductFromDataStore(dataProduct);
    this.forceUpdate();
  };

  clearAllDataProducts = () => {
    this.clearDataStore(false);
    this.forceUpdate();
  };

  handleClearCursor = () => {
    const { clearDataCursor } = this.props;

    this.clearDataStoreData();
    clearDataCursor(); // this will force a re-render so we don't need to
  };

  getLatestGroupItems(product, groups) {
    const config = getConfig();
    const { preferredImageForType } = this.props;
    // filter out items that don't have product type or non-matching overlay
    const matchingItems = groups.filter(
      (prod) =>
        getPropFromProduct(prod, config.es_mappings.product_type, null) &&
        getPropFromProduct(prod, config.es_mappings.overlay_id, null) &&
        getPropFromProduct(prod, config.es_mappings.overlay_id, null) ===
          getPropFromProduct(product, config.es_mappings.overlay_id, null)
    );
    return getLatestVersionsByType(
      matchingItems,
      preferredImageForType,
      getPropFromProduct(product, config.es_mappings.spec_flag, null)
    );
  }

  renderDataRow = (product, ite, roundNum = null) => {
    if (Object.keys(product.data).length === 0) {
      return;
    }

    return (
      <ImageDataResult
        key={`${product.label}_${ite}`}
        product={product}
        onRemove={() => {
          this.removeDataProduct(product.product);
        }}
        roundNum={roundNum}
        footer={product.footer}
      />
    );
  };

  renderDisplayProduct = (displayProduct) => {
    const config = getConfig();
    const id = getPropFromProduct(displayProduct, config.es_mappings.id);
    const active = !!this.dataStore.dataMap[id];

    return (
      <div className={imageDataExplorerStyles.buttonPadding} key={`dataExplorerBtn_${id}`}>
        <Button
          text={getPropFromProduct(displayProduct, config.es_mappings.product_type)}
          onClick={() => {
            if (active) {
              this.removeDataProduct(displayProduct);
            } else {
              this.addDataProduct(displayProduct);
            }
          }}
          variant="toggleButton"
          active={active}
        />
      </div>
    );
  };

  render() {
    const config = getConfig();
    const { product, cursor, autoAddRDRs, handleToggleAutoAddRDRs, fetchingGroups, groups } = this.props;
    const { dataMap } = this.dataStore;

    // sort our data store as an array (excluding the base product)
    const baseId = getPropFromProduct(product, config.es_mappings.id);
    const dataArr = Object.keys(dataMap).reduce((acc, key) => {
      if (key !== baseId) {
        acc.push(dataMap[key]);
      }
      return acc;
    }, []);
    let dataItems = objAlphaSort(dataArr, 'label', false, false);

    // If the product is an RDR, we are showing this in the RDR info tab and only show the RDR
    // Otherwise, pull out the product and put it first in the list
    const baseDataEntry = dataMap[baseId];
    if (baseDataEntry) {
      dataItems = getPropFromProduct(product, config.es_mappings.overlayable)
        ? [baseDataEntry]
        : [baseDataEntry].concat(dataItems);
    }

    // sort available products by type
    const availableProducts = this.getLatestGroupItems(product, groups);
    const alphaSortedAvailableProducts = objAlphaSort(
      availableProducts,
      config.es_mappings.product_type.key,
      false,
      false
    );

    // move the current product to the front
    const sortedAvailableProducts = alphaSortedAvailableProducts.filter(
      (p) =>
        getPropFromProduct(p, config.es_mappings.product_type) !==
        getPropFromProduct(product, config.es_mappings.product_type)
    );
    sortedAvailableProducts.unshift(product);

    const positions = cursor.active ? [this.cursorPosition] : [];
    if (config.feature_flags.active_product.enable_orbital_position) {
      positions.push(this.orbitalPosition);
    }

    const panelHeaderClass = classNames({
      [panelStyles.panelHeader]: true,
      [imageDataExplorerStyles.panelHeader]: true,
    });

    const panelBodyClass = classNames({
      [imageDataExplorerStyles.panelBody]: true,
      [imageDataExplorerStyles.secondaryBody]: true,
    });

    return (
      <div className={imageDataExplorerStyles.container}>
        <div className={imageDataExplorerStyles.panelBody}>
          <div className={imageDataExplorerStyles.toggle}>
            <div className={typographyStyles.label}>Automatically add active RDR overlays</div>
            <Toggle on={autoAddRDRs} onChange={() => handleToggleAutoAddRDRs()} />
          </div>
          <DataCursorControlContainer cursor={cursor} removeDataCursor={this.handleClearCursor} />
          <Button
            onClick={this.handleClearCursor}
            text="Clear Data Cursor"
            variant="secondary"
            full
            className={imageDataExplorerStyles.clearBtn}
          />
        </div>
        <div className={panelHeaderClass}>
          <div className={imageDataExplorerStyles.panelTitle}>Available Products</div>
          <div className={panelStyles.panelButtons}>
            <Button
              className={ProductSummaryStyles.showMoreButton}
              variant="text"
              onClick={() => {
                this.clearAllDataProducts();
              }}
              text="Clear All"
            />
          </div>
        </div>
        <div className={panelBodyClass}>
          {availableProducts.length ? (
            <div className={imageDataExplorerStyles.availableProducts}>
              {sortedAvailableProducts.map((p) => this.renderDisplayProduct(p))}
            </div>
          ) : fetchingGroups ? (
            <div className={ProductDetailsStyles.emptyStateMessage}>Loading Image Group</div>
          ) : (
            <div className={TypographyStyles.medium}>No available products found for this image</div>
          )}
        </div>
        <div className={panelHeaderClass}>
          <div className={imageDataExplorerStyles.panelTitle}>Cursor Values</div>
        </div>
        <div className={imageDataExplorerStyles.secondaryBody}>
          {positions.map((p, ite) => this.renderDataRow(p, ite))}
          {cursor.active && dataItems.map((p, ite) => this.renderDataRow(p, ite, 6))}
        </div>
      </div>
    );
  }
}

ImageDataExplorer.defaultProps = {
  cursor: {},
  product: null,
  dataProducts: [],
};

ImageDataExplorer.propTypes = {
  cursor: PropTypes.object,

  clearDataCursor: PropTypes.func.isRequired,

  product: PropTypes.object,
  dataProducts: PropTypes.arrayOf(PropTypes.object).isRequired,
  activeOverlays: PropTypes.arrayOf(PropTypes.object).isRequired,
  preferredImageForType: PropTypes.object.isRequired,
};
export default ImageDataExplorer;
