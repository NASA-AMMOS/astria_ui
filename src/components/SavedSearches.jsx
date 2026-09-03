import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import debounce from 'lodash.debounce';
import React from 'react';
import shortid from 'shortid';
import Button from 'src/components/common/Button';
import ControlsOverlay from 'src/components/common/ControlsOverlay';
import { ChevronDownIcon } from 'src/components/common/Icons';
import Tooltip from 'src/components/common/Tooltip';
import LayoutStyles from 'src/styles/common/layout.module.css';
import FormStyles from 'src/styles/Forms.module.css';
import headerStyles from 'src/styles/Header.module.css';
import SavedSearchesStyles from 'src/styles/SavedSearches.module.css';
import * as telemetry from 'src/utils/telemetryUtils';
import { USING_CSSO } from '../constants/api';
import { fetchSavedSearches } from '../utils/dataQuery';
import { datadriveGetOCSObjectDownloadPath } from '../utils/endpoints';
import { ArrowLeftIcon, EditIcon, SaveIcon } from './common/Icons';

import config from 'config.js';
class SavedSearches extends React.Component {
  constructor(props) {
    super(props);

    this.searchTitleInputRef = React.createRef();

    this.debouncedTitleChange = debounce(this.handleTitleChange.bind(this), 150, {
      trailing: true,
    });

    this.state = {
      searches: [],
      title: '',
      activeSearch: null,
      saving: false,
      loadingSavedSearches: true,
      loadingSavedSearchesSuccess: false,
    };
  }

  componentDidUpdate(prevProps) {
    const { user } = this.props;
    const { searches } = this.state;
    if (!searches.length && user && user.username && user.username !== prevProps.user.username) {
      this.getSavedSearches();
    }
  }

  handleTitleChange = (title, edit = false) => {
    if (edit) {
      this.setState({ activeSearch: { title: title, ...this.state.activeSearch } });
    } else {
      this.setState({ title: title });
    }
  };

  getSavedSearches = async () => {
    const { user } = this.props;

    this.setState({ loadingSavedSearches: true });

    let savedSearchFile;
    try {
      // Find the user's saved search file
      savedSearchFile = await fetchSavedSearches(user.username);
    } catch (err) {
      // Fails if the request fails, not if there are no results
      telemetry.logError('Unable to load saved search file for user', err);
      this.setState({ loadingSavedSearches: false, loadingSavedSearchesSuccess: false });
      return;
    }

    // If user has no saved searches, return early.
    if (!savedSearchFile) {
      this.setState({ loadingSavedSearches: false, loadingSavedSearchesSuccess: true });
      return;
    }

    try {
      // Download saved searches file
      const url = datadriveGetOCSObjectDownloadPath(savedSearchFile);
      const response = await fetch(url, { ...(USING_CSSO ? { credentials: 'include' } : null), cache: 'no-store' });
      const searchJSON = await response.json();
      this.setState({ searches: searchJSON, loadingSavedSearches: false, loadingSavedSearchesSuccess: true });
    } catch (err) {
      this.setState({ loadingSavedSearches: false, loadingSavedSearchesSuccess: false });
      telemetry.logError('Unable to load saved searches', err);
    }
  };

  saveCurrentSearch = () => {
    const { facetSearchValues, browseSearchValues, user } = this.props;

    const title = this.searchTitleInputRef.current ? this.searchTitleInputRef.current.value : 'unknown';
    const searchValues = { ...facetSearchValues, ...browseSearchValues };

    const newSearches = [
      ...this.state.searches,
      { title: title, id: `${user.username}-${shortid.generate()}`, searchValues },
    ];
    this.uploadSavedSearches(newSearches);
  };

  uploadSavedSearches = async (newSearches) => {
    const { user } = this.props;

    this.setState({ saving: true });

    const searchEntry = JSON.stringify(newSearches);
    const filename = user.username + '-saved-searches.json';
    const dirPath = config.saved_search_upload.ocs_path;
    const fileToUpload = new File([searchEntry], filename);
    const metadata = {};

    try {
      const keyPath = `${dirPath}/${filename}`.replace(/^\/+/g, ''); // remove leading slash

      const fileData = new FormData();
      fileData.append('pkg_id', config.saved_search_upload.pkg_id);
      fileData.append('ocs_path', dirPath);
      fileData.append('ocs_name', filename);
      fileData.append('overwrite', true);
      fileData.append('metadata', JSON.stringify(metadata));
      fileData.append('object_type_name', 'm20-generic');
      fileData.append('s3_key', keyPath);
      fileData.append('s3_bucket', config.saved_search_upload.s3_bucket);
      fileData.append('file', fileToUpload);

      await axios.post(config.api_endpoints.datadrive.middleware + `/api/UploadManual`, fileData, {
        withCredentials: true,
      });
      this.setState({ activeSearch: null, title: '', saving: false, searches: newSearches });
    } catch (err) {
      telemetry.logError('Unable to save custom user search', err);
      this.props.showAlert(
        'Error',
        'Unable to save your search. Please try again later and contact support if you continue to encounter this error.'
      );
      this.setState({ saving: false });
    }
  };

  updateCurrentSearch = (overwrite = false) => {
    const { activeSearch, searches } = this.state;
    const { facetSearchValues, browseSearchValues } = this.props;

    const title = this.searchTitleInputRef.current ? this.searchTitleInputRef.current.value : 'unknown';

    const newSearches = searches.map((s) => {
      if (s.id === activeSearch.id) {
        s = overwrite
          ? { ...activeSearch, title: title, searchValues: { ...facetSearchValues, ...browseSearchValues } }
          : { ...activeSearch, title: title };
      }
      return s;
    });

    this.uploadSavedSearches(newSearches);
  };

  removeSearch = () => {
    const { activeSearch, searches } = this.state;
    const newSearches = searches.filter((s) => s.id !== activeSearch.id);
    this.uploadSavedSearches(newSearches);
  };

  renderEditMenu() {
    const { activeSearch, saving } = this.state;
    return (
      <div>
        <div className={SavedSearchesStyles.editMenu}>
          <div className={SavedSearchesStyles.backButton}>
            <Button
              aria-label="Back"
              variant="icon"
              icon={<ArrowLeftIcon />}
              onClick={() => this.setState({ activeSearch: null })}
            />
            <div className={SavedSearchesStyles.editTitle}> Edit Search </div>
          </div>
          <div className={SavedSearchesStyles.editTitle}>
            <div className={SavedSearchesStyles.title}>Title</div>
            {this.renderTitleChangeMenu(activeSearch.title)}
            <Button
              full
              variant="secondary"
              text="Rename Search"
              disabled={saving || !activeSearch.title}
              onClick={() => this.updateCurrentSearch()}
            />
          </div>
        </div>
        <div className={LayoutStyles.divider} />
        <div className={SavedSearchesStyles.overwriteButtons}>
          <div className={SavedSearchesStyles.buttonPadding}>
            <Button
              full
              variant="primary"
              text="Overwrite with Current Search"
              disabled={saving || !activeSearch.title}
              onClick={() => this.updateCurrentSearch(true)}
            />
          </div>
          <div className={SavedSearchesStyles.buttonPadding}>
            <Button
              full
              className={SavedSearchesStyles.buttonPadding}
              variant="delete"
              text="Delete Search"
              disabled={saving || !activeSearch.title}
              onClick={() => this.removeSearch()}
            />
          </div>
        </div>
      </div>
    );
  }

  renderTitleChangeMenu(title) {
    const { loadingSavedSearchesSuccess } = this.state;
    return (
      <div>
        <Formik
          enableReinitialize
          initialValues={{ title }}
          onSubmit={(values, { setSubmitting }) => {
            this.handleTitleChange(values.title);
            setSubmitting(false);
          }}
        >
          {() => (
            <Form noValidate autoComplete="off">
              <Field name="title">
                {({ field }) => {
                  const { value, onChange, ...otherFieldProps } = field;
                  return (
                    <div className={FormStyles.textInputContainer}>
                      <input
                        disabled={!loadingSavedSearchesSuccess}
                        className={SavedSearchesStyles.input}
                        ref={this.searchTitleInputRef}
                        type="text"
                        placeholder="Name your current search"
                        aria-label="Name your current search"
                        value={value}
                        onChange={(e) => {
                          this.debouncedTitleChange(e.target.value);
                          onChange(e);
                        }}
                        {...otherFieldProps}
                      />
                    </div>
                  );
                }}
              </Field>
            </Form>
          )}
        </Formik>
      </div>
    );
  }

  renderSavedSearchMenu() {
    const { showTextLabel } = this.props;
    const { searches, title, activeSearch, saving, loadingSavedSearches, loadingSavedSearchesSuccess } = this.state;

    const saveButtonWrapper = (children) => {
      if (!title) {
        return (
          <Tooltip overlay="Title required" placement="top">
            <div className={SavedSearchesStyles.saveButtonDisabledWrapper}>{children}</div>
          </Tooltip>
        );
      } else return children;
    };

    return (
      <ControlsOverlay
        overlayPlacement="bottom-start"
        full={false}
        noPadding={true}
        className={headerStyles.userMenu}
        button={
          <Button
            className={headerStyles.headerButton}
            text={showTextLabel ? 'Saved Searches' : ''}
            variant="lineButton"
            rightIcon={
              <span className={headerStyles.chevron}>
                <ChevronDownIcon />
              </span>
            }
            icon={<SaveIcon />}
          />
        }
      >
        <div className={headerStyles.genericMenu}>
          <div className={headerStyles.genericMenuTitle}>Your Saved Searches</div>
          {activeSearch ? (
            this.renderEditMenu()
          ) : (
            <div>
              {!searches.length && (
                <div className={headerStyles.emptyMenuItem}>
                  <div className={headerStyles.menuItemTitle}>
                    {loadingSavedSearches && 'Loading Your Searches'}
                    {!loadingSavedSearches && !loadingSavedSearchesSuccess && 'Unable to Load Saved Searches'}
                    {!loadingSavedSearches && loadingSavedSearchesSuccess && !searches.length && 'No Saved Searches'}
                  </div>
                </div>
              )}
              {searches.length > 0 && (
                <div className={SavedSearchesStyles.menuItems}>
                  {searches.map((search) => this.renderSearchResult(search))}
                </div>
              )}
              <div className={LayoutStyles.divider} />
              <div className={SavedSearchesStyles.saveMenu}>
                {this.renderTitleChangeMenu(title)}
                {saveButtonWrapper(
                  <Button
                    full
                    variant="primary"
                    text={saving ? 'Saving' : 'Save Search'}
                    disabled={saving || !title || !loadingSavedSearchesSuccess}
                    onClick={this.saveCurrentSearch}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </ControlsOverlay>
    );
  }

  onSearchResultClick(search) {
    this.props.clearAndPopulateSearchValues(search.searchValues);
  }

  renderSearchResult(search) {
    const onClick = () => this.onSearchResultClick(search);
    return (
      <div
        role="button"
        tabIndex={0}
        className={headerStyles.menuItem}
        key={search.title + search.id}
        onClick={() => onClick()}
        onKeyPress={(evt) => {
          if (evt.key === 'Enter') onClick();
        }}
      >
        <div className={SavedSearchesStyles.menuItemContent}>{search.title}</div>
        <Tooltip overlay="Edit Search" placement="top">
          <Button
            aria-label="Edit Search"
            variant="icon"
            onClick={(evt) => {
              evt.stopPropagation();
              this.setState({ activeSearch: search });
            }}
            icon={<EditIcon />}
          />
        </Tooltip>
      </div>
    );
  }

  render() {
    return this.renderSavedSearchMenu();
  }
}

export default SavedSearches;
