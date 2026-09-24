import moment from 'moment';
import React from 'react';
import Modal from 'react-modal';
import Button from 'src/components/common/Button';
import alertStyles from 'src/styles/Alert.module.css';
import { getConfig } from 'src/utils/configRegistry';
class AuthAlerter extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      open: false,
      authenticating: false,
      escapable: true,
      message: 'No message',
    };

    this.close = this.close.bind(this);
    this.openSignInWindow = this.openSignInWindow.bind(this);
  }

  componentDidMount() {
    const config = getConfig();
    if (config.using_csso) {
      // If we're using CSSO, attempt to keep authentication fresh and
      // handle expired tokens
      const cssoPollPeriod = 60 * 1000; // 1 minute

      // Ping keep-alive endpoint every minute. CSSO tokens will expire if there are a few minutes of inactivity.
      setInterval(() => this.keepAlive(), cssoPollPeriod);

      // Check to make sure we have a valid SSO token. It's possible that the app was loaded from cache without hitting the proxy.
      this.checkForSessionTimeout(false);

      // Periodically check to see if the token has timed out despite our efforts to keep it alive
      setInterval(() => this.checkForSessionTimeout(), cssoPollPeriod);

      // Detect when our tab becomes visible again and immediately check for session timeout.
      // This covers cases of device power off, window minimization, etc., where a good amount of
      // time may have passed and we want to check auth immediately to prevent un-authed requests
      // causing issues with the application.
      document.addEventListener(
        'visibilitychange',
        () => {
          if (!document.hidden) this.checkForSessionTimeout();
        },
        false
      );
    }
  }

  /**
   *
   * @param {url} url
   * @param {winName} winName name of the popup window
   * @param {w} w width
   * @param {h} h height
   * @param {scroll} scroll show scrollbars
   */
  centeredPopup(url, winName, w, h, scroll) {
    const LeftPosition = window.screen.width ? (window.screen.width - w) / 2 : 0;
    const TopPosition = window.screen.height ? (window.screen.height - h) / 2 : 0;
    const settings =
      'height=' +
      h +
      ',width=' +
      w +
      ',top=' +
      TopPosition +
      ',left=' +
      LeftPosition +
      ',scrollbars=' +
      scroll +
      ',resizable';
    return window.open(url, winName, settings);
  }

  close() {
    this.setState({ open: false, authenticating: false });
  }

  openSignInWindow() {
    this.setState({ authenticating: true });

    // SSO login with redirect to our login_sucess page
    const URL = `//${window.location.host}/ssologinredirect?redirect=${
      window.location.protocol + '//' + window.location.host + window.location.pathname
    }login_success`;

    const popupWindow = this.centeredPopup(URL, 'authWindow', '700', '500', 'no');

    // Not an ideal way to watch for popup window location changes but seems to be
    // the realistic approach for now given CORS popup limitations
    const timer = setInterval(() => {
      // Attempt to get the path of the current popup location.
      // This will fail if the popup window is not the same domain
      // e.g. the CSSO login page. If we do have a pathname and if it
      // matches our ASTRIA login success redirect page or
      // if the popup window has already been closed by the user or some other method,
      // we'll stop doing this check, close the modal, and re-check auth because
      // trust no one. Also the user might have just closed the auth window instead of logging in.
      let pathname;
      try {
        pathname = popupWindow.location.pathname;
      } catch (_err) {
        /* cross-origin access may throw */
      }
      if (pathname === '/login_success' || popupWindow.closed) {
        popupWindow.close();
        clearInterval(timer);
        this.setState({
          open: false,
        });
        this.checkForSessionTimeout();
      }
    }, 150);
  }

  checkForSessionTimeout(promptBeforeRedirect = true) {
    const config = getConfig();
    const { open } = this.state;

    fetch(config.csso_endpoints.cssotokenstatus, {
      method: 'GET',
      credentials: 'include',
    })
      .then(async (response) => {
        // If the response succeeds, but we are not longer authenticated, redirect to login.
        // If the request fails for some reason, assume it's a problem with the network
        // (e.g. WiFi connection lost), and not an auth issue.
        if (response.status === 200) {
          let jsonResponse;
          // We have seen varying types of data coming back from response.body so handle string or object
          if (typeof response.body === 'string') {
            jsonResponse = JSON.parse(response.body);
          } else {
            jsonResponse = await response.json();
          }

          if (!jsonResponse.authenticated) {
            const redirectToLogin = () => {
              const loginUrl = `//${window.location.host}/ssologinredirect?redirect=${window.location.href}`;
              window.location.assign(loginUrl);
            };

            if (promptBeforeRedirect) {
              if (!open) {
                this.setState({
                  title: 'Session Timed Out',
                  open: true,
                  message: `Your ${config.app_title} session timed out. Sign in again from another window to continue this session.`,
                  escapable: false,
                  authenticating: false,
                });
              }
            } else {
              redirectToLogin();
            }
            return;
          }

          // Show an alert saying your login will expire in X minutes,
          // prompt them to login in a new window, once successful they can go about
          // normal business.
          const minutesUntilTokenExpires = moment.unix(jsonResponse.exp).diff(moment.now()) / 1000 / 60;
          if (minutesUntilTokenExpires < 10 && !open) {
            this.setState({
              title: 'Session Ending Soon',
              open: true,
              message: `Your ${config.app_title} session will expire in ${minutesUntilTokenExpires.toFixed(
                0
              )} minutes. Sign in again from another window to prevent losing your work.`,
              escapable: true,
              authenticating: false,
            });
          }
        } else {
          throw Error('Bad response from SSO');
        }
      })
      .catch((error) => {
        console.warn('Cannot connect to SSO status endpoint', error);
      });
  }

  // Code from ASTTRO https://github.jpl.nasa.gov/OnSight/OnSight/blob/master/web/asttronsight/script/app/initializer/index.js
  keepAlive() {
    const config = getConfig();
    fetch(config.csso_endpoints.refreshtimeout, { credentials: 'include' })
      .then((response) => {
        if (response.status !== 200) {
          console.warn('Cannot connect to keepalive endpoint, response code', response.status);
        }
      })
      .catch((error) => {
        console.warn('Cannot connect to keepalive endpoint', error);
      });
  }

  render() {
    const { open, title, message, authenticating, escapable } = this.state;
    const primaryActionLabel = !authenticating ? 'Open Sign In' : 'Waiting...';
    return (
      <Modal
        overlayClassName={{
          base: alertStyles.overlayBase,
          afterOpen: alertStyles.afterOpen,
          beforeClose: alertStyles.beforeClose,
        }}
        className={alertStyles.alert}
        isOpen={open}
        contentLabel={title}
        shouldCloseOnOverlayClick={escapable}
        shouldCloseOnEsc={escapable}
      >
        <div className={alertStyles.headerContainer}>
          <div className={alertStyles.title}>{title}</div>
        </div>
        <div className={alertStyles.message}>{message}</div>
        <div className={alertStyles.actionRow}>
          {escapable && <Button disabled={authenticating} variant="secondary" text="Dismiss" onClick={this.close} />}
          <Button
            disabled={authenticating}
            variant="primary"
            text={primaryActionLabel}
            onClick={this.openSignInWindow}
          />
        </div>
      </Modal>
    );
  }
}

export default AuthAlerter;
