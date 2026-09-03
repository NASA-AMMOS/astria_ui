import debounce from 'lodash.debounce';
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import PDFViewerStyles from '../../styles/PDFViewer.module.css';

// TODO sometimes getting a crash with the pdf library
// see https://github.com/wojtekmaj/react-pdf/issues/974
// needs more testing
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

class PDFViewer extends Component {
  constructor(props) {
    super(props);

    this.containerNodeRef = React.createRef();
    this.debouncedSetWidth = debounce(this.setWidth, 250, {
      trailing: true,
    });

    this.state = {
      numPages: 1,
      width: 300,
      loading: true,
      // store pdf file option in state to avoid passing in a new
      // obj to PDF viewer every time which causes it to constantly re-render
      file: { url: props.pdfUrl, withCredentials: true },
    };
  }

  componentDidMount() {
    this.connectResizeObserver();
    if (this.containerNodeRef.current) {
      // Initialize width with a real value
      let width = this.containerNodeRef.current.clientWidth;
      width = width - width * 0.1; // subtract 10% for total horizontal padding
      this.setState({ width });
    }
  }

  componentWillUnmount() {
    // Disconnect resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  componentDidUpdate(prevProps) {
    const { pdfUrl } = this.props;

    if (prevProps.pdfUrl !== pdfUrl) {
      this.setState({ loading: true, file: { url: pdfUrl, withCredentials: true } });
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    const { pdfUrl } = this.props;
    const { pdfUrl: nextUrl } = nextProps;
    const { width } = this.state;
    const { width: nextWidth } = nextState;

    return pdfUrl !== nextUrl || this.state.numPages !== nextState.numPages || width !== nextWidth;
  }

  onDocumentLoadSuccess = ({ numPages }) => {
    this.setState({ numPages: numPages ?? 0, loading: false });
  };

  connectResizeObserver() {
    this.resizeObserver = new ResizeObserver((entries) => {
      window.requestAnimationFrame(() => {
        const width = entries[0].contentRect.width;
        this.debouncedSetWidth(width);
      });
    });

    // Observe our wrapper element for changes in size
    this.resizeObserver.observe(this.containerNodeRef.current);
  }

  setWidth = (width) => {
    this.setState({ width });
  };

  render() {
    const { file, numPages, width, loading } = this.state;
    return (
      <div ref={this.containerNodeRef} className={PDFViewerStyles.container}>
        <Document
          file={file}
          className={loading ? PDFViewerStyles.fullHeightDocument : ''}
          onLoadSuccess={this.onDocumentLoadSuccess}
          error={<div className={PDFViewerStyles.errorMessage}>ERROR LOADING PDF</div>}
          loading={<div className={PDFViewerStyles.loadingMessage}>LOADING PDF</div>}
        >
          {Array.from(new Array(numPages), (el, index) => (
            <Page loading={<div />} width={width} key={`page_${index + 1}`} pageNumber={index + 1} />
          ))}
        </Document>
      </div>
    );
  }
}

PDFViewer.propTypes = {
  pdfUrl: PropTypes.string,
};

export default PDFViewer;
