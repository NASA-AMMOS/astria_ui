import config from 'config.js';
import PropTypes from 'prop-types';
import React from 'react';
import XMLViewer from 'react-xml-viewer';
import Button from 'src/components/common/Button';
import { USING_CSSO } from 'src/constants/api';
import ProductDetailsStyles from 'src/styles/ProductDetails.module.css';
import XMLLabelDetailsStyles from 'src/styles/XMLLabelDetails.module.css';
import { fetchESDataForProduct } from 'src/utils/dataQuery';
import { pdsGetDownloadPathForProduct } from 'src/utils/endpoints';
import { openInNewTab } from 'src/utils/index';
import { getPropFromProduct } from 'src/utils/sharedUtils';
import { logError } from 'src/utils/telemetryUtils';

export class XMLLabelDetails extends React.Component {
  constructor(props) {
    super(props);
    this.abortController = null;
    this.state = {
      loading: true,
      xmlURL: null,
      xml: null,
    };
  }

  componentDidMount() {
    this.fetchXML();
  }

  componentDidUpdate(prevProps) {
    const { product } = this.props;

    const productChanged =
      !getPropFromProduct(prevProps.product, config.es_mappings.id, null) ||
      !getPropFromProduct(product, config.es_mappings.id, null) ||
      getPropFromProduct(prevProps.product, config.es_mappings.overlay_id, null) !==
        getPropFromProduct(product, config.es_mappings.overlay_id, null);

    if (productChanged) {
      this.fetchXML();
    }
  }

  async fetchXML() {
    this.setState({ loading: true, xml: null, xmlURL: null });
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    const xmlID = getPropFromProduct(this.props.product, { key: config.label_xml_url_key });
    try {
      const xmlProduct = await fetchESDataForProduct(xmlID, this.abortController.signal);
      const xmlURL = pdsGetDownloadPathForProduct(xmlProduct);
      const data = await fetch(xmlURL, { ...(USING_CSSO ? { credentials: 'include' } : null) });
      const xml = await data.text();
      this.setState({ loading: false, xml, xmlURL });
    } catch (error) {
      if (error.name !== 'AbortError') {
        logError(`Unable to fetch xml label: ${xmlID}`, error);
        this.setState({ loading: false, xml: null, xmlURL: null });
      }
    }
  }

  openXML() {
    openInNewTab(this.state.xmlURL, false);
  }

  render() {
    const { product } = this.props;
    const { xml, loading } = this.state;

    const customTheme = {
      attributeKeyColor: '#de9ee3',
      attributeValueColor: '#f29766',
      cdataColor: '#FFFFFF',
      commentColor: '#236e25',
      separatorColor: '#909090',
      tagColor: '#5db0d7',
      textColor: '#FFFFFF',
    };

    return (
      <div className={XMLLabelDetailsStyles.root}>
        {!product && <div className={ProductDetailsStyles.emptyStateMessage}>No Label</div>}
        {product && loading && <div className={ProductDetailsStyles.emptyStateMessage}>Loading</div>}
        {product && !loading && !xml && <div className={XMLLabelDetailsStyles.error}>Failed to Load XML</div>}
        {product && !loading && xml && (
          <div>
            <Button
              disabled={!this.state.xmlURL}
              variant="secondary"
              text="Open in New Tab"
              full
              onClick={() => this.openXML()}
              className={XMLLabelDetailsStyles.openInNewTab}
            />
            <XMLViewer xml={xml} collapsible theme={customTheme} />
          </div>
        )}
      </div>
    );
  }
}

XMLLabelDetails.defaultProps = {
  product: null,
};

XMLLabelDetails.propTypes = {
  product: PropTypes.object,
};

export default XMLLabelDetails;
