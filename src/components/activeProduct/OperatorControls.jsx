import config from 'config.js';
import PropTypes from 'prop-types';
import React from 'react';
import BaseImageSelector from 'src/components/activeProduct/BaseImageSelector';
import ProductFamilyDescription from 'src/components/activeProduct/ProductFamilyDescription';
import SidebarOverlay from 'src/components/activeProduct/SidebarOverlay';
import Button from 'src/components/common/Button';
import Checkbox from 'src/components/common/Checkbox';
import EmptyState from 'src/components/common/EmptyState';
import Panel from 'src/components/common/Panel';
import RadioButton from 'src/components/common/RadioButton';
import FormsStyles from 'src/styles/Forms.module.css';
import OperatorControlsStyles from 'src/styles/OperatorControls.module.css';
import typographyStyles from 'src/styles/common/typography.module.css';
import {
  cloneObj,
  getDefaultOperatorControls,
  getDescriptionsForProduct,
  getQueryStringForOperatorControl,
} from 'src/utils';
import { getPropFromProduct } from 'src/utils/sharedUtils';

class OperatorControls extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      controlKeyMap: {},
    };
  }

  componentDidUpdate(prevProps) {
    // if the product was cleared, disregard our previous settings
    if (!this.props.product && prevProps.product) {
      this.setState({ controlKeyMap: {} });
    }
  }

  handleClose = () => {
    this.props.setOperatorControlsProduct(null);
  };

  handleApplyControls = () => {
    const { product, operatorControlsMap, setOperatorControlsForProduct } = this.props;
    const { controlKeyMap } = this.state;

    const imageTypeKey = getPropFromProduct(product, config.es_mappings.image_type);
    const productType = getPropFromProduct(product, config.es_mappings.product_type);
    const controlGroups =
      typeof operatorControlsMap[productType] !== 'undefined'
        ? cloneObj(operatorControlsMap[productType].controls)
        : this.getDefaultControls(product);

    // merge the dirty input values currently displayed into the last applied control state
    const queryStrings = [];
    controlGroups.forEach((controlSet) => {
      controlSet.controls.forEach((control) => {
        if (typeof controlKeyMap[control.key] !== 'undefined') {
          control.value = controlKeyMap[control.key];
        }
        queryStrings.push(getQueryStringForOperatorControl(control, imageTypeKey));
      });
    });

    const queryString = queryStrings.length > 0 ? queryStrings.filter((x) => x).join('&') : null;
    setOperatorControlsForProduct(product, controlGroups, queryString);
  };

  handleResetControls = () => {
    const { resetOperatorControlsForProduct, product } = this.props;
    this.setState({ controlKeyMap: {} });
    resetOperatorControlsForProduct(product);
  };

  getDefaultControls = (product) => {
    const imageType = getPropFromProduct(product, config.es_mappings.image_type);
    return getDefaultOperatorControls(imageType);
  };

  getControlValue = (control) => {
    const { key, value: controlValue } = control;
    const { controlKeyMap } = this.state;

    return typeof controlKeyMap[key] !== 'undefined' ? controlKeyMap[key] : controlValue;
  };

  renderRadioControl = (control) => {
    const { product } = this.props;
    const { key, label, index_labels } = control;
    const { controlKeyMap } = this.state;

    const value = this.getControlValue(control);

    return (
      <div className={OperatorControlsStyles.inputWrapper}>
        {label ? <div className={FormsStyles.label}>{label}</div> : null}
        {index_labels.map((option, i) => (
          <div key={`${key}_${i}`}>
            <RadioButton
              label={option}
              disabled={product.loading}
              onClick={() => {
                this.setState({ controlKeyMap: { ...controlKeyMap, [key]: i } });
              }}
              selected={value === i}
            />
          </div>
        ))}
      </div>
    );
  };

  renderMultiSelectControl = (control) => {
    const { product } = this.props;
    const { key, label, index_labels } = control;
    const { controlKeyMap } = this.state;

    const value = this.getControlValue(control);

    return (
      <div className={OperatorControlsStyles.inputWrapper}>
        {label ? <div className={FormsStyles.label}>{label}</div> : null}
        {index_labels.map((option, i) => (
          <div key={`${key}_${i}`}>
            <Checkbox
              key={option}
              value={option}
              checked={value[i]}
              disabled={product.loading}
              onChange={(evt) => {
                const checked = evt.target.checked;
                const newValue = [...value];
                newValue[i] = checked;
                this.setState({ controlKeyMap: { ...controlKeyMap, [key]: newValue } });
              }}
              label={option}
            />
          </div>
        ))}
        <div className={FormsStyles.inlinedButtonWrapper}>
          <Button
            variant="text"
            onClick={() => {
              this.setState({ controlKeyMap: { ...controlKeyMap, [key]: value.map((x) => true) } });
            }}
            disabled={product.loading}
            text="Select All"
            className={FormsStyles.inlineButton}
          />
          <Button
            variant="text"
            onClick={() => {
              this.setState({ controlKeyMap: { ...controlKeyMap, [key]: value.map((x) => false) } });
            }}
            disabled={product.loading}
            text="Select None"
            className={FormsStyles.inlineButton}
          />
        </div>
      </div>
    );
  };

  renderInputControl = (control) => {
    const { product } = this.props;
    const { type, key, label } = control;
    const { controlKeyMap } = this.state;

    const value = this.getControlValue(control);

    const inputType = type.indexOf('[]') !== -1 ? 'text' : 'number';
    return (
      <div className={OperatorControlsStyles.inputWrapper}>
        {label ? <div className={FormsStyles.label}>{label}</div> : null}
        <input
          aria-label={label}
          className={FormsStyles.textInput}
          placeholder={type}
          type={inputType}
          value={value}
          disabled={product.loading}
          onChange={(evt) => {
            this.setState({ controlKeyMap: { ...controlKeyMap, [key]: evt.target.value } });
          }}
        />
      </div>
    );
  };

  renderControl = (control) => {
    const { render_type } = control;

    if (render_type === 'radio') {
      return this.renderRadioControl(control);
    } else if (render_type === 'multiselect') {
      return this.renderMultiSelectControl(control);
    } else if (render_type === 'input') {
      return this.renderInputControl(control);
    }
    return <span>unknown control type</span>;
  };

  renderControlSet = (controlSet) => {
    const { key, label, controls } = controlSet;

    return (
      <div key={`control_set_${key}`} className={OperatorControlsStyles.controlSet}>
        {label ? <div className={OperatorControlsStyles.controlSetLabel}>{label}</div> : null}
        {controls.map((control, i) => (
          <div key={`control_set_${key}_${i}`} className={OperatorControlsStyles.controlWrapper}>
            {this.renderControl(control)}
          </div>
        ))}
      </div>
    );
  };

  renderProductDescription = () => {
    const { product, productDescriptions } = this.props;

    const descriptions = getDescriptionsForProduct(product, productDescriptions);
    if (!descriptions) return null;

    const productId = getPropFromProduct(product, config.es_mappings.filename, null);
    return (
      <Panel
        defaultExpanded={false}
        noPadding
        sticky
        allowPopout
        title="Image Family Description"
        popoutTitle={`Image Family Description – ${productId}`}
        preserveToggledStateLocally
        id="OP_IMAGE_FAMILY_DESCRIPTION"
      >
        <ProductFamilyDescription loading={false} product={product} productDescriptions={descriptions} />
      </Panel>
    );
  };

  renderImageSelector = () => {
    const { product, groups, selectNewRDRVersion } = this.props;

    const matchingProducts = groups.filter(
      (l) =>
        getPropFromProduct(l, config.es_mappings.product_type) ===
          getPropFromProduct(product, config.es_mappings.product_type) &&
        getPropFromProduct(l, config.es_mappings.overlay_id) ===
          getPropFromProduct(product, config.es_mappings.overlay_id)
    );

    const productId = getPropFromProduct(product, config.es_mappings.filename, null);
    return (
      <Panel
        defaultExpanded={false}
        noPadding
        sticky
        allowPopout
        title="Image Selector"
        popoutTitle={`Image Selector – ${productId}`}
      >
        {matchingProducts.length > 1 ? (
          <BaseImageSelector
            groups={matchingProducts}
            activeProduct={product}
            isCustomProduct={false}
            fetchingGroups={false}
            allowOverlays={true}
            allowAllSelectors={true}
            setBaseLayer={(l) => selectNewRDRVersion(product, l)}
          />
        ) : (
          <EmptyState
            text="No other versions found for this product type"
            className={OperatorControlsStyles.emptyPanelMsg}
          />
        )}
      </Panel>
    );
  };

  render() {
    const { product, operatorControlsMap } = this.props;

    if (!product) return null;

    const typeKey = getPropFromProduct(product, config.es_mappings.product_type);
    const controlGroups =
      typeof operatorControlsMap[typeKey] !== 'undefined'
        ? operatorControlsMap[typeKey].controls
        : this.getDefaultControls(product);

    const controlsAvailable = controlGroups.length > 0;
    const productId = getPropFromProduct(product, config.es_mappings.filename, null);

    return (
      <SidebarOverlay isOpen={!!product} handleClose={this.handleClose} label="Rendering Controls">
        <div className={OperatorControlsStyles.root}>
          <div className={OperatorControlsStyles.content}>
            <div className={OperatorControlsStyles.header}>
              <div className={OperatorControlsStyles.title}>
                {getPropFromProduct(product, config.es_mappings.product_type) || 'Unknown Title'}
              </div>
              <div className={typographyStyles.label}>
                Customize how this product is rendered using the controls below.
              </div>
            </div>
            <div className={OperatorControlsStyles.mainContent}>
              {this.renderProductDescription()}
              {this.renderImageSelector()}
              <Panel
                noPadding
                defaultExpanded
                sticky
                allowPopout
                title="Render Controls"
                popoutTitle={`Render Controls – ${productId}`}
                preserveToggledStateLocally
                id="OP_RENDER_CONTROLS"
              >
                {controlsAvailable ? (
                  controlGroups.map((set) => this.renderControlSet(set))
                ) : (
                  <div className={OperatorControlsStyles.emptyMessage}>No Controls Available</div>
                )}
              </Panel>
            </div>
          </div>
          <div className={OperatorControlsStyles.footer}>
            <Button
              full
              variant="primary"
              disabled={!controlsAvailable || product.loading}
              text={product.loading ? 'Applying...' : 'Apply'}
              onClick={this.handleApplyControls}
              className={OperatorControlsStyles.footerBtn}
            />
            <Button
              full
              variant="secondary"
              disabled={!controlsAvailable || product.loading}
              text="Reset"
              onClick={this.handleResetControls}
              className={OperatorControlsStyles.footerBtn}
            />
          </div>
        </div>
      </SidebarOverlay>
    );
  }
}

OperatorControls.defaultProps = {
  product: null,
  operatorControlsMap: {},
};

OperatorControls.propTypes = {
  product: PropTypes.object,
  groups: PropTypes.arrayOf(PropTypes.object).isRequired,
  operatorControlsMap: PropTypes.object,
  setOperatorControlsProduct: PropTypes.func.isRequired,
  setOperatorControlsForProduct: PropTypes.func.isRequired,
  selectNewRDRVersion: PropTypes.func.isRequired,
};

export default OperatorControls;
