import classNames from 'classnames';
import config from 'config.js';
import yaml from 'js-yaml';
import PropTypes from 'prop-types';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import NewWindow from 'react-new-window';
import helpStyles from '../styles/Help.module.css';
import Button from './common/Button';
import { ArrowLeftIcon } from './common/Icons';

class Help extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      loadingFailed: true,
    };

    this.helpTopics = [];
  }

  fillAppName(text, searchStr = '{APPNAME}', replaceStr = config.app_title) {
    return text.replaceAll(searchStr, replaceStr);
  }

  async componentDidMount() {
    const { setHelpOpen } = this.props;

    // fetch help config
    const { help_config: helpConfigPath } = config;
    if (helpConfigPath) {
      const helpTopics = await fetch(helpConfigPath).then(async (res) => {
        let conf;
        if (helpConfigPath.indexOf('.json') !== -1) {
          conf = await res.json();
        } else {
          conf = await res.text();
          conf = yaml.load(conf);
        }

        return conf.helpTopics || [];
      });

      // Fetch all markdown files
      try {
        const filesToFetch = helpTopics
          .map((topic) => {
            return topic.articles.map((article) => {
              return {
                key: `${topic.value}/${article.value}`,
                file: article.markdownFileURL,
              };
            });
          })
          .flat();
        const mdResults = await Promise.all(
          filesToFetch.map(({ key, file }) =>
            fetch(file).then(async (res) => {
              const md = await res.text();
              return { key, md };
            })
          )
        );

        // For each article in helpTopics, add the corresponding md string
        helpTopics.forEach((topic) => {
          topic.articles.forEach((article) => {
            const key = `${topic.value}/${article.value}`;
            const result = mdResults.find((r) => r.key === key);
            if (result) {
              article.markdownString = this.fillAppName(result.md);
            }
          });
        });
        this.setState({ loading: false, loadingFailed: false });
      } catch (err) {
        console.error('Unable to fetch help content', err);
        this.setState({ loading: false, loadingFailed: true });
      }

      this.helpTopics = helpTopics;
    } else {
      console.warn('No help config specified');
      this.setState({ loading: false, loadingFailed: true });
      return;
    }

    window.addEventListener('beforeunload', () => setHelpOpen(false));
  }

  onArticleClick = (topic, article) => {
    const { setHelpArticle } = this.props;
    setHelpArticle(`${topic.value}/${article.value}`);
  };

  renderTopicNavigation(topic, activeArticle) {
    return (
      <div key={topic.value} className={helpStyles.topicContainer}>
        <div className={helpStyles.topicLabel}>{topic.label}</div>
        {topic.articles.map((article) => {
          const buttonClass = classNames({
            [helpStyles.articleButton]: true,
            [helpStyles.articleButtonActive]: activeArticle && activeArticle.value === article.value,
          });
          return (
            <button
              key={article.value}
              className={buttonClass}
              type="button"
              onClick={() => this.onArticleClick(topic, article)}
            >
              {article.label}
            </button>
          );
        })}
      </div>
    );
  }

  renderHelpHome() {
    return (
      <div>
        <div className={helpStyles.homeText}>
          Search, view, explore, and annotate imagery with {config.app_title}. Share what you see with others using the
          permanent URL.
        </div>
        <div className={helpStyles.helpTopics}>{this.helpTopics.map((topic) => this.renderTopicNavigation(topic))}</div>
      </div>
    );
  }

  renderArticle(topic, article) {
    return (
      <div className={helpStyles.articleContainer}>
        <div className={helpStyles.articleMD}>
          <ReactMarkdown allowDangerousHtml source={article.markdownString} />
        </div>
        {this.renderTopicNavigation(topic, article)}
      </div>
    );
  }

  render() {
    const { open, activeArticleKey, setHelpOpen, setHelpArticle } = this.props;
    const { loading, loadingFailed } = this.state;

    if (!open) return <></>;

    // If a topic is active, try to find it in our topics
    let helpPage = this.renderHelpHome();
    let articleActive = false;
    if (activeArticleKey) {
      const [topicValue, articleValue] = activeArticleKey.split('/');
      if (topicValue && articleValue) {
        const topic = this.helpTopics.find((t) => t.value === topicValue);
        if (topic) {
          const article = topic.articles.find((a) => a.value === articleValue);
          if (article) {
            helpPage = this.renderArticle(topic, article);
            articleActive = true;
          }
        }
      }
    }
    return (
      // TODO center in screen but library not working, might want to just copy paste and modify the lib since it's tiny
      <NewWindow
        center="parent"
        features={{
          dependent: true,
          center: 'parent',
          width: 1140,
          height: 880,
          menubar: false,
          toolbar: false,
        }}
        title={`${config.app_title} Help`}
        onUnload={() => setHelpOpen(false)}
      >
        <div className={helpStyles.root}>
          <div className={helpStyles.padding}>
            <div className={helpStyles.header}>
              {articleActive && (
                <Button aria-label="Back" onClick={() => setHelpArticle('')} variant="icon" icon={<ArrowLeftIcon />} />
              )}
              {config.app_title} Help
            </div>
            {loading && !loadingFailed && <div>Loading</div>}
            {!loading && loadingFailed && <div>Loading Failed</div>}
            {!loading && !loadingFailed && helpPage}
          </div>
        </div>
      </NewWindow>
    );
  }
}

Help.defaultProps = {
  activeArticleKey: '',
};

Help.propTypes = {
  open: PropTypes.bool.isRequired,
  activeArticleKey: PropTypes.string,
  setHelpOpen: PropTypes.func.isRequired,
};

export default Help;
