import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import sortObj from 'sortobject';
import Button from 'src/components/common/Button';
import { CloseIcon, StarIcon, StarOutlineIcon } from 'src/components/common/Icons';
import Tooltip from 'src/components/common/Tooltip';
import Inspector from 'src/externals/react-json-inspector/json-inspector';
import FormsStyles from 'src/styles/Forms.module.css';
import JSONLabelDetailsStyles from 'src/styles/JSONLabelDetails.module.css';
import ProductDetailsStyles from 'src/styles/ProductDetails.module.css';
import { getConfig } from 'src/utils/configRegistry';

class SearchInput extends React.Component {
  constructor(props) {
    super(props);

    this.ref = React.createRef();
  }

  render() {
    const inputContainerClasses = classNames({
      [FormsStyles.autosuggestInputContainer]: true,
      [FormsStyles.inputNormal]: true,
      [FormsStyles.iconRight]: true,
      [JSONLabelDetailsStyles.input]: true,
    });
    const inputClasses = classNames({
      [FormsStyles.autosuggestInput]: true,
    });

    return (
      <div className={inputContainerClasses}>
        <input
          aria-label="Search"
          ref={this.ref}
          className={inputClasses}
          type="text"
          placeholder="Search"
          onChange={this.onChange}
        />
        {this.props.query && (
          <Button
            aria-label="Clear"
            variant="icon"
            onClick={this.onClear}
            icon={<CloseIcon />}
            className={FormsStyles.autosuggestClearIcon}
          />
        )}
      </div>
    );
  }
  onChange = (e) => {
    this.props.onChange(e.target.value);
  };
  onClear = () => {
    if (this.ref.current) {
      this.ref.current.value = '';
    }
    this.props.onChange('');
  };
}

export class JSONLabelDetails extends React.Component {
  render() {
    const config = getConfig();
    const { product, loading } = this.props;

    const noProduct = <div className={ProductDetailsStyles.emptyStateMessage}>No VICAR Label</div>;

    if (!product) {
      return noProduct;
    }

    const hasVICARLabel = !!product[config.label_key];
    let sortedLabel;
    if (hasVICARLabel) {
      // Sort root
      sortedLabel = sortObj(product[config.label_key]);

      // Sort children
      Object.keys(sortedLabel).forEach((key) => {
        sortedLabel[key] = sortObj(sortedLabel[key]);
      });
    }

    const containerClass = classNames({
      [JSONLabelDetailsStyles.loading]: loading,
    });

    const loadingTextClass = classNames({
      [ProductDetailsStyles.emptyStateMessage]: true,
      [JSONLabelDetailsStyles.loadingText]: true,
    });

    const CustomLabel = (props) => {
      if (props.keypath.split('.').length === 2 && props.isKey) {
        const starred =
          this.props.starredMetadataFields[config.label_key].indexOf(`${config.label_key}.${props.keypath}`) > -1;
        const classes = classNames({
          [JSONLabelDetailsStyles.starButtonBase]: true,
          [JSONLabelDetailsStyles.starButton]: starred,
          [JSONLabelDetailsStyles.unStarButton]: !starred,
        });
        const overlay = `${starred ? 'Remove from' : 'Add to'} starred fields`;
        return (
          <Tooltip overlay={overlay} placement="top">
            <Button
              aria-label={overlay}
              className={classes}
              variant="icon"
              icon={starred ? <StarIcon /> : <StarOutlineIcon />}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (starred) this.props.removeStarredMetadataField(`${config.label_key}.${props.keypath}`, true);
                else this.props.addStarredMetadataField(`${config.label_key}.${props.keypath}`, true);
              }}
            />
          </Tooltip>
        );
      }
      return null;
    };

    if (hasVICARLabel) {
      return (
        <div className={containerClass}>
          <div className={loadingTextClass}>Loading Image Group</div>
          <Inspector
            interactiveLabel={CustomLabel}
            search={SearchInput}
            debounceTime={200}
            className={JSONLabelDetailsStyles.tree}
            filterOptions={{ ignoreCase: true }}
            data={sortedLabel}
          />
        </div>
      );
    }
    return noProduct;
  }
}

JSONLabelDetails.defaultProps = {
  loading: true,
  product: null,
  starredMetadataFields: {},
  addStarredMetadataField: () => {},
  removeStarredMetadataField: () => {},
};

JSONLabelDetails.propTypes = {
  loading: PropTypes.bool,
  product: PropTypes.object,
  starredMetadataFields: PropTypes.object,
  addStarredMetadataField: PropTypes.func,
  removeStarredMetadataField: PropTypes.func,
};

export default JSONLabelDetails;
