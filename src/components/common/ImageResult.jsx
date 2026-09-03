import classNames from 'classnames';
import config from 'config.js';
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { Img } from 'react-image';
import {
  CrosshairsFineOutlinedIcon,
  HeliIcon,
  PersonIcon,
  RoverDriveIcon,
  RoverSiteIcon,
  SolIcon,
  WarningIcon,
} from 'src/components/common/Icons';
import Tooltip from 'src/components/common/Tooltip';
import imageStyles from 'src/styles/ImageResult.module.css';
import {
  isAnnotatableProduct,
  isAnnotation,
  isCustomProduct,
  isDefined,
  isFeature,
  isMosaic,
  isSingleFrame,
  isTarget,
} from 'src/utils';
import { datadriveGetOCSObjectDownloadPathForS3URL, getThumbnail } from 'src/utils/endpoints';
import { buildTiledImageURL } from 'src/utils/osd/osdUtils';
import { getDescendantProp, getPropFromProduct } from 'src/utils/sharedUtils';

// unloader, used as a fallback if all images fail to load
class Unloader extends Component {
  componentDidMount() {
    const { onMount } = this.props;
    onMount();
  }

  render() {
    const { title } = this.props;
    return (
      <div title={title} className={imageStyles.error}>
        <div>—</div>
      </div>
    );
  }
}

Unloader.propTypes = {
  onMount: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
};

class ImageResult extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      loading: true,
    };
  }

  render() {
    const {
      product,
      fallback,
      active,
      interactable,
      raised,
      onLoad,
      fadeIn,
      autoConstrain,
      showMetadata,
      showAlt,
      indexLabel,
      titleSelectable,
      secondaryTimeLabel,
      className,
      customLabel,
      onClick,
      showOwner,
      useFallback,
      cursor,
    } = this.props;
    const { loading } = this.state;

    const isImageAnnotation = isAnnotation(product);
    const isImageFeature = isFeature(product);
    const isTargetProduct = isTarget(product);
    const isImageCustomProduct = isCustomProduct(product);
    const isImageM20Mosaic = isMosaic(product);
    const isAnnotatable = isAnnotatableProduct(product);
    const filename = getPropFromProduct(product, config.es_mappings.filename);
    const isThumbnail =
      isSingleFrame(product) && getPropFromProduct(product, config.es_mappings.size_type).toLowerCase() === 'thumbnail';
    const isValid = !isDefined(product._invalidProduct) || !product._invalidProduct;
    const imageUrl = getPropFromProduct(product, config.es_mappings.img_url);

    // Determine which path to use for product
    let src = fallback;
    if (!useFallback) {
      if (isImageAnnotation) {
        if (product.thumbnail) src = datadriveGetOCSObjectDownloadPathForS3URL(product.thumbnail);
      } else if (isImageFeature) {
        if (imageUrl) src = datadriveGetOCSObjectDownloadPathForS3URL(imageUrl);
      } else if (isTargetProduct) {
        src = fallback;
      } else if ((isImageCustomProduct && !isAnnotatable) || !config.use_tiler_thumbs) {
        src = getThumbnail(product);
      } else {
        src = buildTiledImageURL(product, true);
      }
    }

    // determine if we have a background image to render
    const backgroundSrc = product._thumbnailBackgroundSrc;
    const hasBackground = isDefined(backgroundSrc);

    const productAlt = showAlt ? filename : '';
    const title =
      customLabel.title ||
      (isImageCustomProduct ? filename : getPropFromProduct(product, config.es_mappings.instrument_id));
    const time1 = getPropFromProduct(product, config.es_mappings.time1);
    const site = getPropFromProduct(product, config.es_mappings.site);
    const drive = getPropFromProduct(product, config.es_mappings.drive);
    const flight = getPropFromProduct(product, config.es_mappings.flight);
    const ocsOwner = getPropFromProduct(product, config.es_mappings.created_by);

    const containerClass = classNames({
      [imageStyles.container]: true,
      [imageStyles.active]: active,
      [imageStyles.nonInteractable]: !interactable,
      [imageStyles.raised]: raised,
      [imageStyles.inactive]: !active,
      [className]: typeof className !== 'undefined',
    });

    // Constrain image by finding largest dimension
    let imageWidth = 0;
    let imageHeight = 0;
    if (isImageFeature) {
      imageWidth = parseInt(getDescendantProp(product, config.es_mappings.image_feature.width.key));
      imageHeight = parseInt(getDescendantProp(product, config.es_mappings.image_feature.height.key));
    } else {
      imageWidth = parseInt(getDescendantProp(product, config.es_mappings.width.key));
      imageHeight = parseInt(getDescendantProp(product, config.es_mappings.height.key));
    }

    const imageClass = classNames({
      [imageStyles.fullHeight]: autoConstrain && imageWidth <= imageHeight,
      [imageStyles.fullWidth]: autoConstrain && imageWidth > imageHeight,
      [imageStyles.img]: true,
      [imageStyles.grayBackground]: !hasBackground,
      [imageStyles.transparent]: loading,
      [imageStyles.fadeIn]: fadeIn,
    });

    const imageClassBackground = classNames({
      [imageClass]: true,
      [imageStyles.backgroundImg]: true,
    });

    const iconChildren = [];
    const time1IsList = Array.isArray(time1);
    if (typeof time1 === 'number' || typeof time1 === 'string' || time1IsList) {
      iconChildren.push(
        <div key={`${src}_time1`} className={imageStyles.iconChild} title={`Sol${time1IsList ? 's' : ''}`}>
          <SolIcon />
          <div>{!time1IsList ? time1 : time1.join(', ')}</div>
        </div>
      );
    }

    if (isImageCustomProduct || showOwner) {
      if (typeof ocsOwner === 'string')
        iconChildren.push(
          <div key={`${src}_owner`} className={imageStyles.iconChild} title="OCS Owner">
            <PersonIcon />
            <div>{ocsOwner}</div>
          </div>
        );
    } else {
      if (typeof site === 'number')
        iconChildren.push(
          <div key={`${src}_site`} className={imageStyles.iconChild} title="Site">
            <RoverSiteIcon />
            <div>{site}</div>
          </div>
        );
      if (typeof drive === 'number')
        iconChildren.push(
          <div key={`${src}_drive`} className={imageStyles.iconChild} title="Drive">
            <RoverDriveIcon />
            <div>{drive}</div>
          </div>
        );
      if (typeof flight === 'number')
        iconChildren.push(
          <div key={`${src}_flight`} className={imageStyles.iconChild} title="Flight">
            <HeliIcon />
            <div>{flight}</div>
          </div>
        );
    }

    const subtitle = customLabel.subtitle ? (
      <div className={imageStyles.subtitle}>{customLabel.subtitle}</div>
    ) : (
      <div className={imageStyles.iconRow}>{iconChildren}</div>
    );

    const bottomContentClass = classNames({
      [imageStyles.bottomContent]: true,
      [imageStyles.bottomContentSelectable]: titleSelectable,
    });

    const bottomContent = showMetadata ? (
      <div className={bottomContentClass}>
        {title && (
          <div className={imageStyles.title}>
            {title}
            {isThumbnail ? <span className={imageStyles.thumbnailLabel}>thumb</span> : ''}
          </div>
        )}
        {subtitle}
      </div>
    ) : (
      <div className={bottomContentClass}>
        {isThumbnail ? <span className={imageStyles.thumbnailLabel}>T</span> : ''}
      </div>
    );

    const invalidIcon = !isValid ? (
      <Tooltip
        overlay={`Invalid product${isDefined(product._invalidReason) ? ': ' + product._invalidReason : ''}`}
        placement="bottom"
      >
        <div className={imageStyles.invalidIcon}>
          <WarningIcon />
        </div>
      </Tooltip>
    ) : null;

    const onImageResultClick = (e) => {
      if (interactable && onClick) onClick(e);
    };

    const imageWrapper = (children) => {
      if (isValid && interactable) {
        return (
          <div className={containerClass} title={productAlt} onClick={onImageResultClick}>
            {children}
          </div>
        );
      }
      return (
        <div className={containerClass} title={productAlt}>
          {children}
        </div>
      );
    };

    const showTimeLabel = !isImageCustomProduct && showMetadata && secondaryTimeLabel && !isImageM20Mosaic;
    const timeLabel = showTimeLabel && <div className={imageStyles.topRightLabel}>{secondaryTimeLabel}</div>;

    const indexLabelClass = classNames({
      [imageStyles.topRightLabel]: true,
      [imageStyles.topRightLabelCompact]: !showMetadata, // reposition top right label for compact mode (e.g filenames)
    });
    const indexLabelNode = !isImageCustomProduct && indexLabel && <div className={indexLabelClass}>{indexLabel}</div>;

    const imgStyle = {};
    if (loading) imgStyle.paddingTop = `calc(${(imageHeight / imageWidth) * 100}%  + 0.2px)`;

    let cursorContent = null;
    if (cursor && cursor.line <= imageHeight && cursor.sample <= imageWidth) {
      const top = `${(cursor.line / imageHeight) * 100}%`;
      const left = `${(cursor.sample / imageWidth) * 100}%`;
      cursorContent = <CrosshairsFineOutlinedIcon className={imageStyles.cursor} style={{ left, top }} />;
    }

    return imageWrapper(
      <>
        <div className={imageStyles.placeholder} style={imgStyle} />
        {hasBackground && <Img className={imageClassBackground} src={backgroundSrc} alt="" />}
        <Img
          alt=""
          unloader={<Unloader title={productAlt} onMount={() => this.setState({ loading: false })} />}
          onLoad={() => {
            this.setState({ loading: false });
            if (typeof onLoad === 'function') onLoad();
          }}
          className={imageClass}
          src={src}
        />
        {timeLabel}
        {indexLabelNode}
        {cursorContent}
        {bottomContent}
        {invalidIcon}
      </>
    );
  }
}

ImageResult.defaultProps = {
  product: {},
  active: false,
  autoConstrain: true,
  interactable: true,
  raised: true,
  className: '',
  fallback: '',
  showMetadata: false,
  showAlt: false,
  index: -1,
  titleSelectable: false,
  fadeIn: false,
  secondaryTimeLabel: '',
  onClick: null,
  showOwner: false,
  customLabel: {},
  useFallback: false,
  cursor: null,
};

ImageResult.propTypes = {
  product: PropTypes.object,

  customLabel: PropTypes.object,
  fallback: PropTypes.string,
  fadeIn: PropTypes.bool,
  active: PropTypes.bool,
  autoConstrain: PropTypes.bool,
  index: PropTypes.number,
  titleSelectable: PropTypes.bool,
  interactable: PropTypes.bool,
  className: PropTypes.string,
  raised: PropTypes.bool,
  showMetadata: PropTypes.bool,
  showAlt: PropTypes.bool,
  onClick: PropTypes.func,
  showOwner: PropTypes.bool,
  secondaryTimeLabel: PropTypes.string,
  useFallback: PropTypes.bool,
  cursor: PropTypes.object,
};

export default ImageResult;
