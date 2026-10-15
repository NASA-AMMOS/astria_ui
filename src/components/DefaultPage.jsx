import PropTypes from 'prop-types';
// React is used implicitly via JSX
import { AstriaLogoLowEffort } from 'src/components/common/Icons';
import styles from 'src/styles/DefaultPage.module.css';

function DefaultPage({ error }) {
  return (
    <div className={styles.container}>
      <AstriaLogoLowEffort className={styles.logo} />
      <h1 className={styles.title}>ASTRIA</h1>
      <hr className={styles.divider} />
      <p className={styles.subtitle}>No mission configuration selected.</p>
      {error && <div className={styles.error}>{error}</div>}
      <span className={styles.version}>{process.env.ASTRIA_APP_VERSION || ''}</span>
    </div>
  );
}

DefaultPage.propTypes = {
  error: PropTypes.string,
};

DefaultPage.defaultProps = {
  error: null,
};

export default DefaultPage;
