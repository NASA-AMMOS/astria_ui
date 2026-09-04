import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import EmptyState from 'src/components/common/EmptyState';
import { InfoIcon } from 'src/components/common/Icons';
import ProductScienceIntentStyles from 'src/styles/ProductScienceIntent.module.css';
import { getConfig } from 'src/utils/configRegistry';
import { scienceIntentGetProductMetadata } from 'src/utils/endpoints';
import { getPropFromProduct } from 'src/utils/sharedUtils';
import * as telemetry from 'src/utils/telemetryUtils';

export class ProductScienceIntent extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      loading: true,
      sciIntentFetchSucceeded: true,
      goals: [],
      campaign: '',
    };
    this.SICache = {};
  }

  componentDidMount() {
    this.fetchScienceIntent();
  }

  componentDidUpdate(prevProps) {
    const config = getConfig();
    const { product } = this.props;
    const productID = getPropFromProduct(product, config.es_mappings.id, null);
    const prevProductID = getPropFromProduct(prevProps.product, config.es_mappings.id, null);
    if (!productID || !prevProductID || productID !== prevProductID) this.fetchScienceIntent();
  }

  fetchScienceIntent() {
    const config = getConfig();
    const { product, campaigns } = this.props;

    this.setState({ loading: true, goals: [], campaign: '' });

    // If we don't have an activity ID in the metadata we're done, for now this will
    // be considered an error.
    const activityID = getPropFromProduct(product, config.es_mappings.activity_id_rtt, null);
    if (!activityID) {
      this.setState({
        loading: false,
        sciIntentFetchSucceeded: false,
      });
      return;
    }

    // Look for this SI in the cache, if found we don't have to fetch
    if (this.SICache.hasOwnProperty(activityID)) {
      this.setState({
        goals: this.SICache[activityID].goals,
        campaign: this.SICache[activityID].campaign,
        sciIntentFetchSucceeded: true,
        loading: false,
      });
      return;
    }

    const result = {};
    fetch(scienceIntentGetProductMetadata(activityID), { credentials: 'include' })
      .then((response) => {
        if (!response.ok) {
          throw Error(response.statusText);
        } else {
          return response.json();
        }
      })
      .then((json) => {
        let goals = [];
        let tasks = [];
        if (json.data && json.data.length && json.data[0].tasks && Array.isArray(json.data[0].tasks)) {
          // Find all goals associated with all tasks matching activity id
          tasks = json.data[0].tasks;
          const goalMap = {};
          tasks.forEach((task) => {
            // iterate through all connected goals and add to set
            task.goals.forEach((goal) => {
              if (!goalMap.hasOwnProperty(goal.id)) goalMap[goal.id] = goal;
              if (!goal.tasks) goal.tasks = [];
              goal.tasks.push(task);
            });
          });
          goals = Object.values(goalMap);
          result.goals = goals;
          this.setState({ sciIntentFetchSucceeded: true });
        } else {
          // We'll consider this successful even though no tasks or goals were found, can show empty state later
          this.setState({ sciIntentFetchSucceeded: true });
        }

        /* find campaign id by searching through all goals for first campaign connection */
        let campaignUUID = '';
        goals.forEach((goal) => {
          if (goal.connections) {
            const campaignConnection = goal.connections.find(
              (connection) => connection.foreign_key.indexOf('campaign_') > -1
            );
            if (campaignConnection) campaignUUID = campaignConnection.foreign_key.split('campaign_')[1];
          }
        });

        let campaign;
        if (campaignUUID && campaigns) {
          const matchingCampaign = campaigns.find((x) => x.uuid === campaignUUID);
          if (matchingCampaign) campaign = matchingCampaign.name;
        }
        result.campaign = campaign;
        if (result.campaign && result.goals) this.SICache[activityID] = result;
        this.setState({
          goals,
          campaign,
          loading: false,
        });
      })
      .catch((err) => {
        telemetry.logError('Error fetching science intent', err);
        this.setState({
          loading: false,
          sciIntentFetchSucceeded: false,
        });
      });
  }

  renderScienceIntent(campaign, goals) {
    const campaignLabel = campaign || 'Unknown Campaign';
    const campaignClass = classNames({
      [ProductScienceIntentStyles.sciIntentValue]: true,
      [ProductScienceIntentStyles.noBullet]: true,
    });
    return (
      <div className={ProductScienceIntentStyles.sciIntentCard}>
        <div className={ProductScienceIntentStyles.sciIntentLabel}>Campaign</div>
        <div className={campaignClass}>{campaignLabel}</div>
        {goals &&
          goals.map((goal) => (
            <div key={goal.id}>
              <div className={ProductScienceIntentStyles.borderedGroup}>
                <div className={ProductScienceIntentStyles.sciIntentLabel}>Goal</div>
                <div className={ProductScienceIntentStyles.sciIntentValue}>{goal.title}</div>
              </div>
              <div>
                <div className={ProductScienceIntentStyles.indent}>
                  <div className={ProductScienceIntentStyles.borderedGroup}>
                    <div className={ProductScienceIntentStyles.sciIntentLabel}>Tasks</div>
                    {goal.tasks.map((task, i) => {
                      const style = {};
                      if (i === goal.tasks.length - 1) style.marginBottom = 0;
                      return (
                        <div key={task.id} className={ProductScienceIntentStyles.sciIntentValue} style={style}>
                          {task.title}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>
    );
  }

  render() {
    const config = getConfig();
    const { goals, campaign, sciIntentFetchSucceeded, loading } = this.state;
    const { product } = this.props;

    const activityID = getPropFromProduct(product, config.es_mappings.activity_id_rtt, null);
    if (!activityID) {
      return (
        <EmptyState
          className={ProductScienceIntentStyles.emptyState}
          text="Science Intent metadata unavailable for this product, no Activity ID RTT found"
          icon={<InfoIcon />}
        />
      );
    }

    const loadingComponent = <div className={ProductScienceIntentStyles.loading}>Loading</div>;
    const errorComponent = <div className={ProductScienceIntentStyles.error}>Error Loading Science Intent</div>;

    if (!loading && !goals.length) {
      return (
        <EmptyState
          className={ProductScienceIntentStyles.emptyState}
          text="Science Intent metadata unavailable for this product, no associated goals or task found"
          icon={<InfoIcon />}
        />
      );
    }

    return (
      <div>
        {loading ? loadingComponent : null}
        {/* Show SI if SI fetch succeeded, show campaign even if it fails (falls back to Unknown Campaign) */}
        {!loading && !sciIntentFetchSucceeded ? errorComponent : null}
        {!loading && sciIntentFetchSucceeded ? this.renderScienceIntent(campaign, goals) : null}
      </div>
    );
  }
}

ProductScienceIntent.defaultProps = {
  product: {},
};

ProductScienceIntent.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types
  product: PropTypes.object,
  campaigns: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default ProductScienceIntent;
