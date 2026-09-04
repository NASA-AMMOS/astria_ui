import classNames from 'classnames';
import React from 'react';
import { DragDropContext, Draggable } from 'react-beautiful-dnd';
import ReactDOM from 'react-dom';
import { connect } from 'react-redux';
import { clearFacetSearchValues, setFacetSearchInverted, setFacetSearchValue } from 'src/actions/searchActions';
import Button from 'src/components/common/Button';
import Checkbox from 'src/components/common/Checkbox';
import ControlsOverlay from 'src/components/common/ControlsOverlay';
import EmptyState from 'src/components/common/EmptyState';
import { CloseIcon, DotsSixVerticalIcon, InfoIcon, ProhibitInsetIcon, SettingsIcon } from 'src/components/common/Icons';
import Panel from 'src/components/common/Panel';
import Select from 'src/components/common/Select';
import Tooltip from 'src/components/common/Tooltip';
import { StrictModeDroppable } from 'src/components/StrictModeDroppable';
import SearchBaseContainer from 'src/containers/SearchBaseContainer';
import TypographyStyles from 'src/styles/common/typography.module.css';
import EDRListStyles from 'src/styles/EdrList.module.css';
import FacetSearchStyles from 'src/styles/FacetSearch.module.css';
import FormsStyles from 'src/styles/Forms.module.css';
import { getConfig } from 'src/utils/configRegistry';

const LOCALSTORAGE_FACET_ORDER_KEY = 'facetSearchOrder';
const LOCALSTORAGE_FACET_VISIBILITY_KEY = 'facetSearchVisibility';

let portal = document.createElement('div');
document.body.appendChild(portal);

class PortalAwareItem extends React.Component {
  render() {
    const provided = this.props.provided;
    const snapshot = this.props.snapshot;

    const usePortal = snapshot.isDragging;

    const draggableStyles = snapshot.isDragging
      ? {
          ...provided.draggableProps.style,
          zIndex: 9999999,
        }
      : { ...provided.draggableProps.style };

    const child = (
      <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} style={draggableStyles}>
        {this.props.children}
      </div>
    );

    if (!usePortal) {
      return child;
    }

    // if dragging - put the item in a portal
    return ReactDOM.createPortal(child, portal);
  }
}

class FacetSearch extends React.Component {
  constructor(props) {
    super(props);

    this.overlayRef = React.createRef();

    this.state = {
      facetVisibilityStates: JSON.parse(localStorage.getItem(LOCALSTORAGE_FACET_VISIBILITY_KEY)) || {},
      facetOrder: JSON.parse(localStorage.getItem(LOCALSTORAGE_FACET_ORDER_KEY)) || {},
    };
  }

  isFacetVisible = (facetValue) => {
    if (this.state.facetVisibilityStates.hasOwnProperty(facetValue)) {
      const value = this.state.facetVisibilityStates[facetValue];
      if (typeof value === 'boolean') return this.state.facetVisibilityStates[facetValue];
      return true;
    }
    return true;
  };

  handleReorder = (result, facetsComponents) => {
    if (result.source && result.destination) {
      const existingOrder =
        this.state.facetOrder.length > 0 ? this.state.facetOrder : facetsComponents.map(({ facet }) => facet.label);
      const newOrder = Array.from(existingOrder);
      const [removed] = newOrder.splice(result.source.index, 1);
      newOrder.splice(result.destination.index, 0, removed);
      this.setState({ facetOrder: newOrder });
      localStorage.setItem(LOCALSTORAGE_FACET_ORDER_KEY, JSON.stringify(newOrder));
    }
  };

  setFacetVisibility = (label, visible = true) => {
    const facetVisibilityStates = {
      ...this.state.facetVisibilityStates,
      [label]: visible,
    };
    this.setState({ facetVisibilityStates });
    localStorage.setItem(LOCALSTORAGE_FACET_VISIBILITY_KEY, JSON.stringify(facetVisibilityStates));
  };

  renderContent = (params) => {
    const config = getConfig();
    const {
      resultsComponent,
      facetsComponents,
      viewControls,
      sortControls,
      renderSearchControlsRow,
      renderActiveFacetList,
    } = params;

    const facetCustomizationHeaderContent = classNames({
      [EDRListStyles.controlsOverlayHeader]: true,
      [FacetSearchStyles.facetCustomizationHeader]: true,
      [TypographyStyles.bold]: true,
    });

    let sortedFacetsComponents = facetsComponents;
    if (this.state.facetOrder.length) {
      sortedFacetsComponents = facetsComponents.slice().sort((a, b) => {
        return this.state.facetOrder.indexOf(a.facet.label) > this.state.facetOrder.indexOf(b.facet.label) ? 1 : -1;
      });
    }

    let noFacetsVisible = true;
    let hiddenFacetCount = 0;
    let userHasReorderedFacets = this.state.facetOrder.length > 0;
    sortedFacetsComponents.forEach(({ facet }) => {
      if (this.isFacetVisible(facet.label)) {
        noFacetsVisible = false;
      } else {
        hiddenFacetCount++;
      }
    });

    const customizeButtonIconClass = classNames({
      [FacetSearchStyles.facetCustomizationOverlayButtonIcon]: true,
      [FacetSearchStyles.facetCustomizationOverlayButtonIconActive]: hiddenFacetCount > 0 || userHasReorderedFacets,
    });

    return (
      <>
        <div>{renderActiveFacetList()}</div>
        <div className={FacetSearchStyles.facetsAndResultsContainer}>
          <div className={FacetSearchStyles.facetsContainer}>
            <div className={FacetSearchStyles.facetCustomization}>
              Filters
              <ControlsOverlay
                ref={this.overlayRef}
                full={false}
                noPadding
                overlayClassName={FacetSearchStyles.facetCustomizationOverlay}
                overlayPlacement="bottom-end"
                className={FacetSearchStyles.facetCustomizationOverlayButton}
                classNameOpen={FacetSearchStyles.facetCustomizationOverlayButtonOpen}
                label="Customize"
                icon={
                  <span className={customizeButtonIconClass}>
                    <SettingsIcon />
                  </span>
                }
              >
                <div className={facetCustomizationHeaderContent}>
                  <div>Customize Filters</div>
                  <Button
                    aria-label="Close"
                    variant="icon"
                    icon={<CloseIcon />}
                    onClick={() => this.overlayRef.current && this.overlayRef.current.setOpen(false)}
                  />
                </div>
                <div className={FacetSearchStyles.facetCustomizationList}>
                  <Select
                    placeholder="Load a preset..."
                    value={null}
                    searchable={false}
                    options={config.search_config.facet_search.facet_presets}
                    onChange={(selectedOption) => {
                      const preset = selectedOption.facets || [];
                      const facetVisibilityStates = sortedFacetsComponents.reduce((acc, f) => {
                        acc[f.facet.label] = !!preset.find((value) => f.facet.label === value) || false;
                        return acc;
                      }, {});
                      this.setState({ facetVisibilityStates });
                      localStorage.setItem(LOCALSTORAGE_FACET_VISIBILITY_KEY, JSON.stringify(facetVisibilityStates));

                      // Order facets
                      const facetOrder = preset.concat(
                        facetsComponents
                          .map(({ facet }) => facet.label)
                          .filter((label) => !preset.find((value) => label === value))
                      );
                      this.setState({ facetOrder });
                      localStorage.setItem(LOCALSTORAGE_FACET_ORDER_KEY, JSON.stringify(facetOrder));
                    }}
                  />
                  <br />
                  <div className={FacetSearchStyles.dragHint}>Drag to re-order filters</div>
                  <DragDropContext onDragEnd={(result) => this.handleReorder(result, sortedFacetsComponents)}>
                    <StrictModeDroppable droppableId="facet-search-droppable">
                      {(droppableProvided) => (
                        <div {...droppableProvided.droppableProps} ref={droppableProvided.innerRef}>
                          {sortedFacetsComponents.map(({ facet }, i) => {
                            return (
                              <Draggable
                                key={facet.label}
                                draggableId={facet.label}
                                disableInteractiveElementBlocking={true}
                                index={i}
                                style={{ zIndex: 9999999999 }}
                              >
                                {(draggableProvided, draggableSnapshot) => {
                                  const itemClass = classNames({
                                    [FacetSearchStyles.facetCustomizationListItem]: true,
                                    [FacetSearchStyles.facetCustomizationListItemDragging]:
                                      draggableSnapshot.isDragging,
                                  });
                                  return (
                                    <PortalAwareItem provided={draggableProvided} snapshot={draggableSnapshot}>
                                      <div className={itemClass}>
                                        <Checkbox
                                          className={FacetSearchStyles.facetCustomizationListItemCheckbox}
                                          checked={this.isFacetVisible(facet.label)}
                                          value={facet.label}
                                          onChange={(event) => {
                                            this.setFacetVisibility(facet.label, event.target.checked);
                                          }}
                                          label={facet.label}
                                        />
                                        <span className={FacetSearchStyles.grabIcon}>
                                          <DotsSixVerticalIcon />
                                        </span>
                                      </div>
                                    </PortalAwareItem>
                                  );
                                }}
                              </Draggable>
                            );
                          })}
                          {droppableProvided.placeholder}
                        </div>
                      )}
                    </StrictModeDroppable>
                  </DragDropContext>
                </div>
                <div className={FacetSearchStyles.facetCustomizationBottomContent}>
                  <div>
                    <Button
                      variant="text"
                      onClick={() => {
                        this.setState({ facetVisibilityStates: {} });
                        localStorage.removeItem(LOCALSTORAGE_FACET_VISIBILITY_KEY);
                      }}
                      text="Show All"
                      className={FormsStyles.inlineButton}
                    />
                    <Button
                      variant="text"
                      onClick={() => {
                        const facetVisibilityStates = sortedFacetsComponents.reduce((acc, f) => {
                          acc[f.facet.label] = false;
                          return acc;
                        }, {});
                        this.setState({ facetVisibilityStates });
                        localStorage.setItem(LOCALSTORAGE_FACET_VISIBILITY_KEY, JSON.stringify(facetVisibilityStates));
                      }}
                      text="Hide All"
                      className={FormsStyles.inlineButton}
                    />
                  </div>
                  <Button
                    className={FacetSearchStyles.resetOrderButton}
                    variant="secondary"
                    text="Reset Order"
                    full
                    onClick={() => {
                      this.setState({ facetOrder: [] });
                      localStorage.removeItem(LOCALSTORAGE_FACET_ORDER_KEY);
                    }}
                  />
                </div>
              </ControlsOverlay>
            </div>
            <div className={FacetSearchStyles.facets}>
              {noFacetsVisible && <EmptyState text="No Filters Selected" icon={<InfoIcon />} />}
              {sortedFacetsComponents.map(({ facet, component }) => {
                const facetInverted = this.props.searchInversions[facet.facetID];
                const invertButtonClasses = classNames({
                  [FacetSearchStyles.facetInvertButton]: true,
                  [FacetSearchStyles.facetInverted]: facetInverted,
                });
                let tooltipContent = 'Clear Inversion';
                const inversionEnabled = this.props.searchValues[facet.facetID] || !!facet.defaults;
                if (!facetInverted) {
                  if (inversionEnabled) tooltipContent = 'Invert Search';
                  else tooltipContent = 'Select Values to Invert Search';
                }

                const panelClasses = classNames({
                  [FacetSearchStyles.facet]: true,
                  [FacetSearchStyles.facetHidden]: !this.isFacetVisible(facet.label),
                });
                return (
                  <Panel
                    activeBadge={facet.hasActiveValues}
                    className={panelClasses}
                    key={facet.facetID}
                    title={facet.label}
                    tooltip={facet.hint}
                    defaultExpanded={!!facet.defaultExpanded}
                    preserveToggledStateLocally
                    id={facet.label}
                    secondaryButton={
                      <Tooltip placement="top" overlay={tooltipContent}>
                        <span className={FacetSearchStyles.invertButtonContainer}>
                          <Button
                            aria-label={tooltipContent}
                            disabled={!inversionEnabled}
                            className={invertButtonClasses}
                            variant="icon"
                            icon={<ProhibitInsetIcon />}
                            onClick={() => {
                              this.props.setComponentInverted(!facetInverted, facet.facetID);
                            }}
                          />
                        </span>
                      </Tooltip>
                    }
                  >
                    {component}
                  </Panel>
                );
              })}
              {hiddenFacetCount > 0 && (
                <div className={FacetSearchStyles.facetsHiddenMessage}>
                  {hiddenFacetCount} filter{hiddenFacetCount !== 1 ? 's' : ''} hidden
                </div>
              )}
            </div>
          </div>
          <div className={FacetSearchStyles.resultsAndFiltersContainer}>
            {renderSearchControlsRow(viewControls, sortControls, [], 0, 300)}
            {resultsComponent}
          </div>
        </div>
      </>
    );
  };

  render() {
    // Force a re-render of the search base component render function when this component re-renders
    // due to state change
    const searchConfig = { ...getConfig().search_config.facet_search };
    return (
      <SearchBaseContainer
        ignoreSearchConfigChanges
        searchConfig={searchConfig}
        renderContent={this.renderContent}
        {...this.props}
      />
    );
  }
}

const mapStateToProps = (state) => {
  return {
    searchValues: state.search.facetSearchValues,
    searchInversions: state.search.facetSearchInversions,
    defaultValues: state.search.defaultFacetSearchValues,
  };
};

const matchDispatchToProps = (dispatch) => {
  return {
    setSearchValue(values, componentId, clearInversion = false) {
      dispatch(setFacetSearchValue(values, componentId, clearInversion));
    },
    clearSearchValues(componentIds) {
      dispatch(clearFacetSearchValues(componentIds));
    },
    setComponentInverted(inverted, componentId) {
      dispatch(setFacetSearchInverted(inverted, componentId));
    },
  };
};

export default connect(mapStateToProps, matchDispatchToProps)(FacetSearch);
