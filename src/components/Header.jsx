import axios from 'axios';
import classNames from 'classnames';
import React from 'react';
import Button from 'src/components/common/Button';
import ControlsOverlay from 'src/components/common/ControlsOverlay';
import DropDownButton from 'src/components/common/DropDownButton';
import {
  AstriaLogoLowEffort,
  CameraOutlinedIcon,
  CheckIcon,
  ChevronDownIcon,
  DrawIconOutlined,
  FolderIcon,
  HelpIcon,
  // MarsviewerLogo,
  MeasureIcon,
  PinIcon,
  TrashIcon,
  UploadIcon,
} from 'src/components/common/Icons';
import Tooltip from 'src/components/common/Tooltip';
import ImageExport from 'src/components/ImageExport';
import KeyboardShortcuts from 'src/components/KeyboardShortcuts';
import ImageUploadContainer from 'src/containers/ImageUploadContainer';
import ImageViewingHistoryContainer from 'src/containers/ImageViewingHistoryContainer';
import layoutStyles from 'src/styles/common/layout.module.css';
import typographyStyles from 'src/styles/common/typography.module.css';
import headerStyles from 'src/styles/Header.module.css';
import { openSupportEmail } from 'src/utils';
import { getConfig } from 'src/utils/configRegistry';
import { measureSupported } from 'src/utils/dataQuery';
import { getPropFromProduct } from 'src/utils/sharedUtils';
import { isOSDViewableFileType } from '../utils';
import SavedSearches from './SavedSearches';

class Header extends React.Component {
  constructor(props) {
    super(props);

    this.headerRef = React.createRef();

    this.state = {
      showExportModal: false,
      showUploadModal: false,
      showKeyboardShortcuts: false,
      fetchingPackages: true,
      fetchingPackagesSuccess: false,
      packageOptions: [],
      compactHeaderMode: false,
    };
  }

  componentDidMount() {
    document.addEventListener('keydown', this.handleKeydown);
    this.getPackages();
    this.connectResizeObserver();
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleKeydown);
  }

  connectResizeObserver() {
    this.resizeObserver = new ResizeObserver((entries) => {
      window.requestAnimationFrame(() => {
        const width = entries[0].contentRect.width;
        this.setState({ compactHeaderMode: width < 1300 });
      });
    });

    // Observe our wrapper element for changes in size
    this.resizeObserver.observe(this.headerRef.current);
  }

  handleKeydown = (event) => {
    const config = getConfig();
    const { interactionMode, setInteractionMode, baseImage, groups } = this.props;

    if (event.target.nodeName !== 'INPUT') {
      let isEscape = false;
      if ('key' in event) isEscape = event.key === 'Escape' || event.key === 'Esc';
      else isEscape = event.keyCode === 27;

      // if drawing -> edit mode. if measuring -> view only mode
      if (isEscape) {
        if (interactionMode === config.interaction_modes.measure) {
          setInteractionMode(config.interaction_modes.view_only);
        } else if (interactionMode !== config.interaction_modes.view_only) {
          setInteractionMode(config.interaction_modes.edit);
        }
      }

      // Measure tool shortcut
      if (event.key === 'm') {
        if (baseImage && interactionMode === config.interaction_modes.view_only && measureSupported(baseImage, groups))
          this.handleMeasure(true);
      }
    }
  };

  exportImage(options) {
    this.props.exportImage(options);
  }

  toggleAnnotationEditor() {
    const { annotationEditorOpen, osdWrapper } = this.props;

    if (annotationEditorOpen && osdWrapper) {
      osdWrapper.stopAnnotating();
      osdWrapper.clearSelection();
    }
    this.props.setAnnotationEditorOpen(!annotationEditorOpen);
  }

  handleMeasure(force = false) {
    const config = getConfig();
    const { interactionMode } = this.props;
    this.props.setAnnotationEditorOpen(false);
    if (!force && interactionMode === config.interaction_modes.measure) {
      this.setInteractionMode(config.interaction_modes.view_only);
    } else {
      this.setInteractionMode(config.interaction_modes.measure);
    }
  }

  handleClearMeasurements = () => {
    const config = getConfig();
    this.setInteractionMode(config.interaction_modes.view_only);
    this.props.clearMeasurements();
  };

  setInteractionMode(interactionMode) {
    this.props.setInteractionMode(interactionMode);
  }

  setPackage(ocsPackage) {
    this.props.setPackage(ocsPackage);
  }

  getPackages() {
    const config = getConfig();
    if (!config.feature_flags.general.enable_package_selection) return;
    axios
      .get(config.api_endpoints.datadrive.middleware + '/api/ocs/all_pkgs', { withCredentials: true })
      .then((res) => res.data['pkgs'])
      .then((pkgs) => {
        const package_names = pkgs
          .filter((p) => !p['deleted'])
          .map((p) => {
            const option = { value: p['name'], label: p['description'] };
            return option;
          })
          .sort((a, b) => (a.value > b.value ? 1 : -1))
          .sort((a, _b) => (a.value === config.search_config.default_package ? -1 : 1));
        this.setState({ packageOptions: package_names, fetchingPackages: false, fetchingPackagesSuccess: true });
      })
      .catch((_err) => {
        this.setState({
          fetchingPackages: false,
          fetchingPackagesSuccess: false,
        });
        this.props.showAlert(
          'Error',
          `Unable to load packages from OCS. ${config.app_title} can only view images from the current OCS package. Please try again later and contact support if you continue to encounter this error.`
        );
      });
  }

  renderHelpMenu() {
    const config = getConfig();
    const { setHelpOpen } = this.props;
    return (
      <ControlsOverlay
        closeOnClick
        overlayPlacement="bottom-start"
        full={false}
        noPadding={true}
        className={headerStyles.userMenu}
        label="Help"
      >
        <div className={headerStyles.genericMenu}>
          <Button
            full
            text="Keyboard Shortcuts"
            variant="menuItem"
            onClick={() => this.setState({ showKeyboardShortcuts: true })}
          />
          <Button
            full
            text="Contact Support"
            variant="menuItem"
            onClick={() => {
              openSupportEmail({
                subject: `${config.app_title} Support Request`,
                message: '',
              });
            }}
          />
          <Button
            full
            text="User Guide"
            variant="menuItem"
            onClick={() => {
              // Close the help menu if it happens to be open
              setHelpOpen(false);
              requestAnimationFrame(() => {
                // Open the help menu after a frame
                setHelpOpen(true);
              });
            }}
          />
          {config.api_endpoints.ScienceOperationsSite && (
            <a
              className=""
              href={config.api_endpoints.ScienceOperationsSite.client}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button full text="Science Operations Guide" variant="menuItem" onClick={() => {}} />
            </a>
          )}
        </div>
      </ControlsOverlay>
    );
  }

  renderUserMenu() {
    const config = getConfig();
    const { user } = this.props;

    const userClass = classNames({
      [typographyStyles.label]: true,
      [typographyStyles.noSelect]: true,
      [layoutStyles.padding]: true,
      [headerStyles.signOut]: true,
    });

    const usernameChar = user && user.username ? user.username[0] : 'U';

    return (
      <ControlsOverlay
        closeOnClick
        overlayPlacement="bottom-start"
        full={false}
        noPadding={true}
        className={headerStyles.userMenu}
        label={
          <div className={headerStyles.userMenuButton}>
            <div className={headerStyles.userMenuAvatar}>{usernameChar}</div>
            <ChevronDownIcon />
          </div>
        }
      >
        <div className={headerStyles.genericMenu}>
          <div className={headerStyles.genericMenuTitle}>Welcome {user.username}</div>
          <Button
            full
            text="Reset to Application Defaults"
            variant="menuItem"
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
          />
          {config.using_csso && (
            <a className={userClass} href="/ssologoutredirect" target="_self">
              <Button full text="Log out" variant="menuItem" onClick={() => {}} />
            </a>
          )}
        </div>
      </ControlsOverlay>
    );
  }

  renderPackageMenu() {
    const config = getConfig();
    const { ocsPackages } = this.props;
    const { compactHeaderMode, packageOptions, fetchingPackages, fetchingPackagesSuccess } = this.state;
    const packageOptionsWithoutBase = packageOptions.filter((pkg) => ocsPackages.base.indexOf(pkg.value) < 0);
    return (
      <ControlsOverlay
        overlayPlacement="bottom-start"
        full={false}
        noPadding={true}
        className={headerStyles.userMenu}
        button={
          <Button
            ref={this.packageBtnRef}
            className={headerStyles.headerButton}
            text={!compactHeaderMode ? ocsPackages.active : ''}
            variant="lineButton"
            rightIcon={
              <span className={headerStyles.chevron}>
                <ChevronDownIcon />
              </span>
            }
            icon={<FolderIcon />}
          />
        }
      >
        <div className={headerStyles.genericMenu}>
          <div className={headerStyles.genericMenuTitle}>Select Package</div>
          <div className={headerStyles.menuItems}>
            {fetchingPackages && (
              <div className={headerStyles.emptyMenuItem}>
                <div className={headerStyles.menuItemTitle}>Loading OCS Packages</div>
              </div>
            )}
            {!fetchingPackages && !fetchingPackagesSuccess && (
              <div className={headerStyles.emptyMenuItem}>
                <div className={headerStyles.menuItemTitle}>Unable to Fetch OCS Packages</div>
              </div>
            )}
            {!fetchingPackages &&
              fetchingPackagesSuccess &&
              packageOptionsWithoutBase.length &&
              packageOptionsWithoutBase.map((pkg) => {
                const isActive = pkg.value === ocsPackages.active;
                const isDefault = pkg.value === config.search_config.default_package;
                return (
                  <button key={pkg.value} className={headerStyles.menuItem} onClick={() => this.setPackage(pkg.value)}>
                    <div className={headerStyles.menuItemCheck}>{isActive && <CheckIcon />}</div>
                    <div className={headerStyles.menuItemContent}>
                      <div className={headerStyles.menuItemTitle}>
                        {pkg.value}
                        <span className={headerStyles.menuItemDefaultLabel}>{isDefault && '(DEFAULT)'}</span>
                      </div>
                      <div className={headerStyles.menuItemSubtitle}>{pkg.label}</div>
                    </div>
                  </button>
                );
              })}
            {!fetchingPackages && fetchingPackagesSuccess && !packageOptionsWithoutBase.length && (
              <div className={headerStyles.emptyMenuItem}>
                <div className={headerStyles.menuItemTitle}>No Packages Found</div>
              </div>
            )}
          </div>
        </div>
      </ControlsOverlay>
    );
  }

  render() {
    const config = getConfig();
    const {
      interactionMode,
      annotationEditorOpen,
      imageFeatureEditorOpen,
      baseImage,
      groups,
      openHelpArticle,
      osdWrapper,
      newImageFeature,
    } = this.props;
    const { compactHeaderMode } = this.state;

    const productIsOSDViewable = baseImage && !isOSDViewableFileType(baseImage);
    const headerClass = classNames({
      [headerStyles.header]: true,
    });

    const brandClass = classNames({
      [typographyStyles.brand]: true,
      [typographyStyles.noSelect]: true,
      [headerStyles.brandLink]: true,
    });

    const versionClass = classNames({
      [typographyStyles.label]: true,
      [typographyStyles.noSelect]: true,
      [layoutStyles.padding]: true,
      [headerStyles.version]: true,
    });

    const azElSupported = baseImage && getPropFromProduct(baseImage, config.es_mappings.projection) === 'Cylindrical';
    const isMeasureSupported = baseImage && measureSupported(baseImage, groups);
    const isMeasureDisabled = this.props.fetchingGroups || !isMeasureSupported || productIsOSDViewable;

    // Detect Mac vs Windows https://developer.mozilla.org/en-US/docs/Web/API/Navigator/platform
    // User of navigator.platform is usually discouraged except in cases like this.
    // However it is NOT deprecated like the TS definition would have you believe.
    let modifierKey = 'alt'; // alt key
    if (navigator.platform.indexOf('Mac') === 0 || navigator.platform === 'iPhone') {
      modifierKey = '⌥'; // option key
    }

    return (
      <div ref={this.headerRef} className={headerClass}>
        <div className={headerStyles.headerContentLeft}>
          <a href={import.meta.env.BASE_URL} className={brandClass}>
            <AstriaLogoLowEffort className={headerStyles.logo} />
            <span className={layoutStyles.padding}>{config.app_title}</span>
          </a>
          <Tooltip
            mouseEnterDelay={2}
            mouseLeaveDelay={0.5}
            placement="bottom"
            overlay={`Build number: ${process.env.ASTRIA_BUILD_HASH}`}
          >
            <div className={versionClass}>{config.app_version}</div>
          </Tooltip>
        </div>
        <div className={headerStyles.headerActions}>
          {config.feature_flags.general.enable_package_selection && this.renderPackageMenu()}
          {config.feature_flags.general.enable_image_viewing_history && (
            <ImageViewingHistoryContainer showTextLabel={!compactHeaderMode} />
          )}
          {config.feature_flags.general.enable_saved_searches && (
            <SavedSearches
              facetSearchValues={this.props.facetSearchValues}
              browseSearchValues={this.props.browseSearchValues}
              clearAndPopulateSearchValues={this.props.clearAndPopulateSearchValues}
              user={this.props.user}
              showAlert={this.props.showAlert}
              showTextLabel={!compactHeaderMode}
            />
          )}
          <Button
            aria-label="Export"
            className={headerStyles.headerButton}
            variant="lineButton"
            text={!compactHeaderMode ? 'Export' : ''}
            icon={<CameraOutlinedIcon />}
            onClick={() => this.setState({ showExportModal: true })}
            disabled={!this.props.activeSearchProductId || productIsOSDViewable}
          />
          {config.feature_flags.general.enable_image_upload && (
            <Button
              aria-label="Upload"
              className={headerStyles.headerButton}
              variant="lineButton"
              text={!compactHeaderMode ? 'Upload' : ''}
              icon={<UploadIcon />}
              onClick={() => this.setState({ showUploadModal: true })}
            />
          )}
          <DropDownButton
            className={headerStyles.headerButton}
            active={interactionMode === config.interaction_modes.measure}
            text={!compactHeaderMode ? 'Measure' : ''}
            activeType="dark"
            buttonTooltipProps={{
              mouseLeaveDelay: 0.25,
              overlay: !isMeasureDisabled ? 'Measure Distance' : 'Measure tool requires XYZ product',
              shortcut: !isMeasureDisabled ? `m (hold ${modifierKey} to pan)` : '',
              learnMore: () => openHelpArticle('query_scale_and_distance/measure_distances'),
            }}
            menuTooltipProps={{ overlay: 'Measure Tools' }}
            overlayPlacement="bottom-end"
            disabled={isMeasureDisabled || imageFeatureEditorOpen || annotationEditorOpen}
            icon={<MeasureIcon />}
            onClick={() => this.handleMeasure()}
          >
            <div className={headerStyles.toolMenu}>
              <Button
                full
                aria-label="Remove All"
                text="Remove All"
                variant="menuItem"
                icon={<TrashIcon />}
                onClick={this.handleClearMeasurements}
              />
              <Button
                full
                aria-label="Help"
                text="Help"
                variant="menuItem"
                icon={<HelpIcon />}
                onClick={() => openHelpArticle('query_scale_and_distance/measure_distances')}
              />
            </div>
          </DropDownButton>
          {config.feature_flags.active_product.enable_annotations && (
            <DropDownButton
              className={headerStyles.headerButton}
              active={annotationEditorOpen}
              text={!compactHeaderMode ? 'Draw' : ''}
              activeType="dark"
              buttonTooltipProps={{
                mouseLeaveDelay: 0.25,
                overlay: 'Draw on this image',
              }}
              menuTooltipProps={{ overlay: 'More interactions' }}
              overlayPlacement="bottom-end"
              disabled={
                this.props.fetchingGroups || productIsOSDViewable || imageFeatureEditorOpen || annotationEditorOpen
              }
              icon={<DrawIconOutlined />}
              onClick={() => {
                this.toggleAnnotationEditor();
              }}
            >
              <div className={headerStyles.toolMenu}>
                <Button full text="Add Image Feature" variant="menuItem" icon={<PinIcon />} onClick={newImageFeature} />
              </div>
            </DropDownButton>
          )}
          <ImageExport
            open={this.state.showExportModal}
            onClose={() => this.setState({ showExportModal: false })}
            exportImage={(options) => this.exportImage(options)}
            azElSupported={azElSupported}
            osdWrapper={osdWrapper}
            openHelpArticle={openHelpArticle}
          />
          <ImageUploadContainer
            open={this.state.showUploadModal}
            onClose={() => this.setState({ showUploadModal: false })}
          />
          <KeyboardShortcuts
            open={this.state.showKeyboardShortcuts}
            onClose={() => this.setState({ showKeyboardShortcuts: false })}
          />
        </div>
        <div className={headerStyles.headerContentRight}>
          <div className={headerStyles.headerButton}>{this.renderHelpMenu()}</div>
          {this.renderUserMenu()}
          <div id="appSwitcherID" />
        </div>
      </div>
    );
  }
}

export default Header;
