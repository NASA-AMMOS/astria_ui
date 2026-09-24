import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import Button from 'src/components/common/Button';
import ColorPicker from 'src/components/common/ColorPicker';
import { NoOpacityIcon, OpacityIcon } from 'src/components/common/Icons';
import ImageResult from 'src/components/common/ImageResult';
import { Slider } from 'src/components/common/Slider';
import Tooltip from 'src/components/common/Tooltip';
import ImageOverlayStyles from 'src/styles/ImageOverlay.module.css';
import typographyStyles from 'src/styles/common/typography.module.css';
import { getConfig } from 'src/utils/configRegistry';
import { getPropFromProduct } from 'src/utils/sharedUtils';

export const OverlayProductFamilyDescription = (props) => {
  const { productFamilyMetadata, showProductFamilyMetadata } = props;
  if (!showProductFamilyMetadata) return null;
  return (
    <div className={ImageOverlayStyles.productFamilyMetadata}>
      <div className={typographyStyles.smallCaps}>Product Family Description</div>
      <div className={typographyStyles.medium}>
        General:&nbsp;
        <span className={typographyStyles.body}>
          <span className={ImageOverlayStyles.productFamilyMetadataText}>{productFamilyMetadata.general}</span>
        </span>
      </div>
      <div className={typographyStyles.medium}>
        Visualization:&nbsp;
        <span className={typographyStyles.body}>
          <span className={ImageOverlayStyles.productFamilyMetadataText}>
            {productFamilyMetadata.visualization_overlay || productFamilyMetadata.visualization_standard}
          </span>
        </span>
      </div>
      {productFamilyMetadata.default_settings && (
        <div className={typographyStyles.medium}>
          Default Settings:&nbsp;
          <span className={typographyStyles.body}>
            <span className={ImageOverlayStyles.productFamilyMetadataText}>
              {productFamilyMetadata.default_settings}
            </span>
          </span>
        </div>
      )}
    </div>
  );
};

export class ImageOverlay extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      previousOpacity: this.props.opacity,
      visible: this.props.visible,
      showProductFamilyMetadata: false,
    };
  }

  shouldComponentUpdate(nextProps) {
    if (this.props.visible !== nextProps.visible) {
      this.setState({
        visible: nextProps.visible,
      });
      return false;
    }
    return true;
  }

  componentWillUnmount() {
    if (this.props.onMouseLeave) {
      this.props.onMouseLeave();
    }
  }

  moveUp = (event) => {
    const { onMoveUp } = this.props;
    event.stopPropagation();
    onMoveUp();
  };

  moveDown = (event) => {
    const { onMoveDown } = this.props;
    event.stopPropagation();
    onMoveDown();
  };

  delete = (event) => {
    const { onDelete } = this.props;
    event.stopPropagation();
    onDelete();
  };

  toggleVisibility = () => {
    const { opacity, visible } = this.props;
    const { previousOpacity } = this.state;
    if (visible && opacity !== 0) {
      // Cache previous opacity
      this.setState({ previousOpacity: opacity }, () => {
        // Hide layer
        this.onChangeOpacityHandler(0);
      });
    } else {
      // restore previous value
      this.onChangeOpacityHandler(previousOpacity || 1);
    }
  };

  toggleProductFamilyMetadata = (e) => {
    e.preventDefault();
    e.stopPropagation();
    this.setState({ showProductFamilyMetadata: !this.state.showProductFamilyMetadata });
  };

  onChangeOpacityHandler = (value) => {
    this.props.onChangeOpacity(value);
  };

  handleColorChange = (colorStr) => {
    this.props.onChangeColor(colorStr);
  };

  renderProductFamilyMetadata() {
    const { productFamilyMetadata } = this.props;
    const { showProductFamilyMetadata } = this.state;
    if (!showProductFamilyMetadata) return null;
    return (
      <div className={ImageOverlayStyles.productFamilyMetadata}>
        <div className={typographyStyles.smallCaps}>Product Family Description</div>
        <div className={typographyStyles.medium}>
          General:&nbsp;<span className={typographyStyles.body}>{productFamilyMetadata.general}</span>
        </div>
        <div className={typographyStyles.medium}>
          Visualization:&nbsp;
          <span className={typographyStyles.body}>
            {productFamilyMetadata.visualization_overlay || productFamilyMetadata.visualization_standard}
          </span>
        </div>
      </div>
    );
  }

  render() {
    const config = getConfig();
    const {
      product,
      title: titleOverride,
      description: descriptionOverride,
      productFamilyMetadata,
      tooltip: tooltipOverride,
      fallback,
      useFallback,
      opacity,
      opacityAdjustable,
      selectable,
      overlayActions,
      dragging,
      onClick,
      disableControls,
      onMouseEnter,
      onMouseLeave,
      dragHandleProps,
      className,
      colorPicker,
      color,
      noHighlight,
      visible: propVisible,
    } = this.props;

    const { showProductFamilyMetadata } = this.state;

    const visible = opacity > 0 && propVisible;
    const title =
      titleOverride || getPropFromProduct(product, config.es_mappings.product_type, null) || 'Unknown Title'; // fallback to product title default if none specified
    const description =
      descriptionOverride || getPropFromProduct(product, config.es_mappings.description, null) || 'Unknown Description';
    const tooltip = tooltipOverride || getPropFromProduct(product, config.es_mappings.supplemental_description, null);
    const image = (
      <ImageResult
        className={ImageOverlayStyles.image}
        product={product}
        fallback={fallback}
        useFallback={useFallback}
        interactable={false}
      />
    );
    const containerClass = classNames({
      [ImageOverlayStyles.container]: true,
      [ImageOverlayStyles.containerSelectable]: selectable,
      [ImageOverlayStyles.dragging]: dragging && !noHighlight,
      [ImageOverlayStyles.visible]: visible,
      [className]: typeof className !== 'undefined',
    });
    const content = (
      <div className={containerClass} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        <div className={ImageOverlayStyles.mainContent}>
          <div className={ImageOverlayStyles.topContent} {...dragHandleProps}>
            {image}
            <div className={ImageOverlayStyles.textContainer}>
              <div className={ImageOverlayStyles.firstRow}>
                <div className={ImageOverlayStyles.title}>{title}</div>
                <div
                  className={ImageOverlayStyles.cardActions}
                  onClick={(evt) => {
                    evt.source_is_action_button = true;
                  }}
                >
                  {overlayActions}
                </div>
              </div>
              <div className={ImageOverlayStyles.description}>
                {description}
                {productFamilyMetadata && (
                  <button
                    className={ImageOverlayStyles.showMoreButton}
                    type="button"
                    onClick={this.toggleProductFamilyMetadata}
                  >
                    {showProductFamilyMetadata ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className={ImageOverlayStyles.bottomContent}>
            <div className={ImageOverlayStyles.controlsContainer}>
              {colorPicker && (
                <ColorPicker
                  asDot
                  preferHex
                  className={ImageOverlayStyles.colorDotBtn}
                  defaultColor={color}
                  onChange={this.handleColorChange}
                />
              )}
              {opacityAdjustable && (
                <>
                  <Tooltip overlay={visible ? 'Hide' : 'Show'} placement="top">
                    {
                      <Button
                        aria-label={visible ? 'Hide' : 'Show'}
                        className={ImageOverlayStyles.opacityIcon}
                        variant="icon"
                        disabled={disableControls}
                        onClick={this.toggleVisibility}
                        icon={visible ? <OpacityIcon /> : <NoOpacityIcon />}
                      />
                    }
                  </Tooltip>
                  <Slider
                    minimal
                    value={!visible ? 0 : opacity}
                    min={0}
                    max={1}
                    step={0.01}
                    showTooltip
                    disabled={disableControls}
                    onChange={this.onChangeOpacityHandler}
                  />
                </>
              )}
            </div>
          </div>
          <OverlayProductFamilyDescription
            productFamilyMetadata={productFamilyMetadata}
            showProductFamilyMetadata={showProductFamilyMetadata}
          />
        </div>
      </div>
    );
    return tooltip ? (
      <Tooltip overlay={tooltip} placement="left">
        {content}
      </Tooltip>
    ) : (
      <>{content}</>
    );
  }
}

ImageOverlay.defaultProps = {
  product: {},
  dragHandleProps: {},
  title: '',
  className: '',
  description: '',
  tooltip: '',
  fallback: '',
  useFallback: false,
  opacity: 1,
  opacityAdjustable: false,
  visible: true,
  selectable: true,
  dragging: false,
  disableControls: false,
  noHighlight: false,
  overlayActions: [],
  onClick: () => {},
  onMoveUp: () => {},
  onMoveDown: () => {},
  onDelete: () => {},
  onChangeOpacity: () => {},
  onChangeColor: () => {},
  onMouseEnter: undefined,
  onMouseLeave: undefined,
};

ImageOverlay.propTypes = {
  product: PropTypes.object,
  className: PropTypes.string,
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  description: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  productFamilyMetadata: PropTypes.object, // Marsviewer Desktop image family description items as a map w/title -> text (General -> The XYZ describes..., Visualization, etc)
  tooltip: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  fallback: PropTypes.string,
  useFallback: PropTypes.bool,
  opacity: PropTypes.number,
  opacityAdjustable: PropTypes.bool,
  overlayActions: PropTypes.oneOfType([PropTypes.arrayOf(PropTypes.element), PropTypes.element]),
  visible: PropTypes.bool,
  selectable: PropTypes.bool,
  dragging: PropTypes.bool,
  disableControls: PropTypes.bool,
  onClick: PropTypes.func,
  onMoveUp: PropTypes.func,
  onMoveDown: PropTypes.func,
  onDelete: PropTypes.func,
  onChangeOpacity: PropTypes.func,
  onChangeColor: PropTypes.func,
  onMouseEnter: PropTypes.func,
  onMouseLeave: PropTypes.func,
  dragHandleProps: PropTypes.object,
};

export default ImageOverlay;
