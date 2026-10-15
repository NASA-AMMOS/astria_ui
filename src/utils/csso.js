import { getConfig } from './configRegistry.js';

let cssoHost = process.env.CSSO_ENDPOINT_URL || null;

function getCssoHost() {
  if (!cssoHost) {
    cssoHost = getConfig()?.csso_endpoints?.host;
  }
  return cssoHost;
}
let session = null;
let shouldRefreshAuth = true;
let refreshAuthTimeout = null;
// 4 hours (14400000ms)
const refreshAuthAfter = 14400000;

let endpointInfo = false;

export function fetchEndpointInfo() {
  if (!getCssoHost()) {
    console.error('Error', 'Missing CSSO host!');
    return;
  }

  return fetch(getCssoHost(), {
    method: 'GET',
    headers: {
      'content-type': 'application/json',
    },
  })
    .then((res) => res.json())
    .then((json) => {
      endpointInfo = json;
      console.log('Successfully captured CSSO endpoint info.');
      return;
    })
    .catch(function (err) {
      console.error('Error', 'Failed to get csso endpoint info!', err);
      return;
    });
}

export function csso(creds) {
  return new Promise((resolve, reject) => {
    // If approaching 8 hr timeout, logout then continue

    if (shouldRefreshAuth) {
      logout();
    }
    // If logged in, return session
    if (session) {
      resolve(session);
      return;
    }

    // Not logged in, log in
    login(creds)
      .then((session) => resolve(session))
      .catch((err) => reject(err));
  });
}

export function login(creds) {
  return new Promise((resolve, reject) => {
    creds = creds || {
      user: process.env.APP_AUTH_ID,
      pass: process.env.APP_AUTH_SECRET,
    };
    // Check that login is configured properly
    if (creds.user == null || creds.user.length < 1 || creds.pass == null || creds.pass.length < 1) {
      console.error('Error', 'Missing credentials!');
      throw new Error('no-creds');
    }
    if (!getCssoHost()?.length) {
      console.error('Error', 'Missing CSSO host!');
      throw new Error('no-host');
    }

    const loginToCSSO = () => {
      if (endpointInfo != null && endpointInfo !== false && endpointInfo.app_login == null) {
        console.log("CSSO endpoint info has no 'app_login' described.");
        throw new Error('no-app_login');
      }

      // Everything checks out. We can try logging in now
      console.log('Logging in to CSSO session as ' + creds.user + '...');

      return fetch(endpointInfo.app_login, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-Sub': creds.user,
          'X-Password': creds.pass,
        },
      })
        .then((res) => {
          return res.json();
        })
        .then((json) => {
          if (json.success === true) {
            // Login success

            // Set up a timeout to ensure that we logout
            // for reauthentication instead of getting kicked out
            shouldRefreshAuth = false;
            clearTimeout(refreshAuthTimeout);
            refreshAuthTimeout = setTimeout(() => {
              shouldRefreshAuth = true;
            }, refreshAuthAfter);

            // Save session token
            session = json.session_token;

            console.log('Successfully logged into CSSO session as ' + creds.user + '.');
            // And return it too
            resolve(session);
            return;
          } else {
            // Login failure
            console.error('Error', 'Failed to authenticate CSSO session!', json);
            session = null;
            throw new Error('csso-login-failed');
          }
        })
        .catch(function (err) {
          console.error('Error', 'Failed to get CSSO session!', err);
          reject();
        });
    };

    // Check if we have CSSO endpoint info and if not, query for it
    if (endpointInfo === false) {
      console.log('No CSSO endpoint info found! Querying for info...');
      fetchEndpointInfo().then(() => {
        try {
          loginToCSSO();
        } catch (err) {
          reject(err);
        }
      });
    } else {
      try {
        loginToCSSO();
      } catch (err) {
        reject(err);
      }
    }
  });
}

export function logout() {
  session = null;
}

export function getSession() {
  return session;
}

// module.exports.csso = csso;
// module.exports.getSession = getSession;
// module.exports.login = login;
// module.exports.logout = logout;
