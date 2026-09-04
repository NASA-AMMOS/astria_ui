import classNames from 'classnames';
import 'leaflet/dist/leaflet.css';
import PropTypes from 'prop-types';
import 'rc-slider/assets/index.css';
import React from 'react';
import { connect } from 'react-redux';
import { loadInitialData as loadInitialDataAction } from 'src/actions/activeSearchProduct';
import { fetchUser as fetchUserAction } from 'src/actions/appActions';
import ActiveProductSidebarContainer from 'src/containers/ActiveProductSidebarContainer';
import AlertContainer from 'src/containers/AlertContainer';
import AnnotationDeletionModalContainer from 'src/containers/AnnotationDeletionModalContainer';
import AnnotationEditorContainer from 'src/containers/AnnotationEditorContainer';
import AuthAlerterContainer from 'src/containers/AuthAlerterContainer';
import CustomLayerModalContainer from 'src/containers/CustomLayerModalContainer';
import HeaderContainer from 'src/containers/HeaderContainer';
import HelpContainer from 'src/containers/HelpContainer';
import ImageFeatureEditorContainer from 'src/containers/ImageFeatureEditorContainer';
import OperatorControlsContainer from 'src/containers/OperatorControlsContainer';
import ProductMetadataContainer from 'src/containers/ProductMetadataContainer';
import ProductSearchSidebarContainer from 'src/containers/ProductSearchSidebarContainer';
import RenderedImageContainer from 'src/containers/RenderedImageContainer';
import ResultsExportModalContainer from 'src/containers/ResultsExportModalContainer';
import SelectedFeatureMetadataContainer from 'src/containers/SelectedFeatureMetadataContainer';
import SelectedTargetMetadataContainer from 'src/containers/SelectedTargetMetadataContainer';
import SplitterLayout from 'src/externals/react-splitter-layout/SplitterLayout';
import 'src/externals/react-splitter-layout/index.css';
import appStyles from 'src/styles/App.module.css';
import 'src/styles/common/IBMPlexMono.css';
import 'src/styles/common/global.css';

class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      isMobile: false,
    };

    this.leftSplitterRef = React.createRef();
    this.rightSplitterRef = React.createRef();
    this.minImageViewerSpace = 100;

    console.log(`App built using commit hash: ${process.env.ASTRIA_BUILD_HASH}`);
  }

  componentDidMount() {
    // Initialize app w/some async fetched data
    const { loadInitialData, fetchUser } = this.props;
    fetchUser();
    loadInitialData();

    window.requestAnimationFrame(() => {
      window.addEventListener('popstate', () => {
        window.location.reload();
      });
    });

    window.addEventListener('resize', () => {
      this.adjustToDeviceSide();
      this.checkPanelSizes();
    });
    this.adjustToDeviceSide();
  }

  componentDidUpdate(prevProps) {
    // Check panel sizes if either panel has been uncollapsed or if the oversized
    // left search tab has been opened
    if (
      (this.props.imageTabIndex !== -1 && prevProps.imageTabIndex === -1) ||
      (this.props.searchTabIndex !== -1 && prevProps.searchTabIndex === -1) ||
      (this.props.searchTabIndex === 1 && prevProps.searchTabIndex !== 1) ||
      (this.props.productSearchSidebarOpen && !prevProps.productSearchSidebarOpen) ||
      (this.props.productDetailsSidebarOpen && !prevProps.productDetailsSidebarOpen)
    ) {
      this.checkPanelSizes();
    }
  }

  adjustToDeviceSide() {
    const { isMobile } = this.state;
    const width = document.body.clientWidth;
    const height = document.body.clientHeight;
    const newIsMobile = width < 750 || height < 450;
    if (isMobile !== newIsMobile) this.setState({ isMobile: newIsMobile });
  }

  getMinLeftSize() {
    // If the oversized left search tab is open we need more space
    return this.props.searchTabIndex === 1 ? 8 * 63 : 8 * 43;
  }

  getMinRightSize() {
    return 8 * 45;
  }

  getPaneSizes() {
    const minLeftSize = this.getMinLeftSize();
    const minRightSize = this.getMinRightSize();
    const lsLeft = parseInt(localStorage.getItem('splitPos1'));
    const lsRight = parseInt(localStorage.getItem('splitPos2'));

    let splitPaneLeftSize = 56;
    if (!this.props.productSearchSidebarOpen) splitPaneLeftSize = 0;
    else if (this.props.searchTabIndex > -1) splitPaneLeftSize = Math.max(minLeftSize, lsLeft);

    let splitPaneRightSize = 56;
    if (!this.props.productDetailsSidebarOpen) splitPaneRightSize = 0;
    else if (this.props.imageTabIndex > -1) splitPaneRightSize = Math.max(minRightSize, lsRight);

    return { splitPaneLeftSize, splitPaneRightSize, minLeftSize, minRightSize, lsLeft, lsRight };
  }

  checkPanelSizes() {
    const { splitPaneLeftSize, splitPaneRightSize, minLeftSize, minRightSize, lsLeft, lsRight } = this.getPaneSizes();

    // If left panel + right panel is > document width - 100px min image viewer space
    // we'll set panel sizes to min values
    const availableSpace = document.body.clientWidth - this.minImageViewerSpace;
    if (splitPaneLeftSize + splitPaneRightSize > availableSpace) {
      let lPercent = splitPaneLeftSize / availableSpace;
      let rPercent = splitPaneRightSize / availableSpace;
      let l = lPercent * availableSpace;
      let r = rPercent * availableSpace;
      if (lPercent + rPercent > 1) {
        // If the computed sizes still take up too much room then we'll split the difference between
        // the two sizes
        const diff = 1 - lPercent + rPercent;
        l -= diff / 2;
        r -= diff / 2;
      }
      localStorage.setItem('splitPos1', l);
      localStorage.setItem('splitPos2', r);
      this.leftSplitterRef.current.setState({ secondaryPaneSize: l });
      this.rightSplitterRef.current.setState({ secondaryPaneSize: r });
    } else {
      // Also ensure that the panel sizes are at least equal to min sizes
      if (lsLeft < minLeftSize) {
        localStorage.setItem('splitPos1', minLeftSize);
        this.leftSplitterRef.current.setState({ secondaryPaneSize: minLeftSize });
      }
      if (lsRight < minRightSize) {
        localStorage.setItem('splitPos2', minRightSize);
        this.rightSplitterRef.current.setState({ secondaryPaneSize: minRightSize });
      }
    }
  }

  onPanelSizeChange(size, closedStateValue, lsKey, side, ref, tabIndex) {
    localStorage.setItem(lsKey, size);

    if (ref && ref.current) {
      // If panel is collapsed we'll keep the panel size constant. The splitter layout library will
      // otherwise continue to resize the panel in this state.
      if (tabIndex === -1) {
        ref.current.setState({ secondaryPaneSize: closedStateValue });
      } else {
        // Max width is space remaining after other panel + min viewer size if both panels are open, otherwise limit is space remaining
        const { splitPaneLeftSize, splitPaneRightSize, minLeftSize, minRightSize } = this.getPaneSizes();
        const otherPanelSize = side === 'left' ? splitPaneRightSize : splitPaneLeftSize;
        const minSize = side === 'left' ? minLeftSize : minRightSize;
        let maxWidth = Math.max(document.body.clientWidth - otherPanelSize - this.minImageViewerSpace, minSize);

        if (size > maxWidth) {
          localStorage.setItem(lsKey, maxWidth);
          ref.current.setState({ secondaryPaneSize: maxWidth });
        }
      }
    }
  }

  render() {
    const { isMobile } = this.state;
    const { productSearchSidebarOpen, productDetailsSidebarOpen, user } = this.props;

    const splitPaneLeftClass = classNames({
      [appStyles.splitPaneLeft]: true,
      [appStyles.hideSplitPaneLeft]: !productSearchSidebarOpen || isMobile,
      [appStyles.minimizeSplitPaneLeft]: this.props.searchTabIndex === -1,
    });
    const splitPaneRightClass = classNames({
      [appStyles.splitPaneRight]: true,
      [appStyles.hideSplitPaneRight]: !productDetailsSidebarOpen || isMobile,
      [appStyles.minimizeSplitPaneRight]: this.props.imageTabIndex === -1,
    });

    const splitPaneLeftMinSize = this.getMinLeftSize();
    const splitPaneRightMinSize = this.getMinRightSize();
    const splitPaneLeftSize = parseInt(localStorage.getItem('splitPos1')) || splitPaneLeftMinSize;
    const splitPaneRightSize = parseInt(localStorage.getItem('splitPos2')) || splitPaneRightMinSize;

    return (
      <div className={appStyles.appContainer}>
        <HelpContainer />
        <HeaderContainer user={user} />
        <div className={appStyles.splitPaneContainer}>
          <SplitterLayout
            ref={this.leftSplitterRef}
            onSecondaryPaneSizeChange={(size) =>
              this.onPanelSizeChange(
                size,
                splitPaneLeftSize,
                'splitPos1',
                'left',
                this.leftSplitterRef,
                this.props.searchTabIndex
              )
            }
            customClassName={splitPaneLeftClass}
            primaryIndex={1}
            secondaryMinSize={splitPaneLeftMinSize}
            secondaryInitialSize={splitPaneLeftSize}
          >
            <ProductSearchSidebarContainer />
            <SplitterLayout
              ref={this.rightSplitterRef}
              onSecondaryPaneSizeChange={(size) =>
                this.onPanelSizeChange(
                  size,
                  splitPaneRightSize,
                  'splitPos2',
                  'right',
                  this.rightSplitterRef,
                  this.props.imageTabIndex
                )
              }
              customClassName={splitPaneRightClass}
              secondaryMinSize={splitPaneRightMinSize}
              secondaryInitialSize={splitPaneRightSize}
            >
              <RenderedImageContainer />
              <>
                <ActiveProductSidebarContainer />
                <AnnotationEditorContainer />
                <ImageFeatureEditorContainer />
                <ProductMetadataContainer />
                <OperatorControlsContainer />
                <SelectedTargetMetadataContainer />
                <SelectedFeatureMetadataContainer />
              </>
            </SplitterLayout>
          </SplitterLayout>
        </div>
        <AlertContainer />
        <AuthAlerterContainer />
        <AnnotationDeletionModalContainer />
        <CustomLayerModalContainer />
        <ResultsExportModalContainer />
        <div id="genericModalPortalTarget" />
        <div
          style={{
            width: 0,
            position: 'absolute',
            opacity: 0,
            pointerEvents: 'none',
            fontFamily: 'Inter',
            fontWeight: 800,
          }}
        >
          {/*
            Workaround for preloading fonts without having to do this all manually.
            TODO: this is not very robust, if the font doesn't load before Fabric canvas
            needs to use the font then an unknown fallback will be used. Could try proper
            preload strategies but that'll take more work.
          */}
          800
        </div>
      </div>
    );
  }
}

App.propTypes = {
  productSearchSidebarOpen: PropTypes.bool.isRequired,
  productDetailsSidebarOpen: PropTypes.bool.isRequired,
  loadInitialData: PropTypes.func.isRequired,
  fetchUser: PropTypes.func.isRequired,

  user: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => {
  return {
    user: state.app.user,
    productSearchSidebarOpen: state.sidebarState.productSearchSidebarOpen,
    productDetailsSidebarOpen: state.sidebarState.productDetailsSidebarOpen,
    imageTabIndex: state.sidebarState.imageTabIndex,
    searchTabIndex: state.sidebarState.searchTabIndex,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    loadInitialData() {
      dispatch(loadInitialDataAction());
    },
    fetchUser() {
      dispatch(fetchUserAction());
    },
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(App);
