/**
 * Express Server for Mars Web Viewer
 * 
 * Provides:
 * - CSSO authentication and authorization
 * - Proxy to backend data services
 * - Mosaic data caching and gathering
 * - Static file serving for frontend
 */

// ============================================================================
// IMPORTS
// ============================================================================

import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import proxy from 'express-http-proxy';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './configs/config.js';
import { PERMISSIONS, PROD_MODE, USING_CSSO } from './src/constants/api.js';
import { csso } from './src/utils/csso.js';
import { getMosaics, sleep } from './src/utils/sharedUtils.js';
import { logError, mosaicsGathered } from './src/utils/telemetryUtils.js';

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

// Authentication credentials for mosaic gathering
// Check for existence of app password/account from Docker (for non-local deployments)
const appPassword = process.env.APP_ACCOUNT_PASS || null;
const appAccount = process.env.APP_ACCOUNT_USER || config?.mosaic_timeline?.app_account_user;

// Mosaic gathering state
let GATHER_MOSAICS_ENABLED = true;
let GATHER_RUNTIME_STATS = [];
let LAST_GATHER_TIME;
let IS_GATHERING_MOSAICS = false;
let GATHER_TIMEOUT_FN;
const MOSAIC_GATHERING_WAIT_TIME = 5 * 60000; // 5 minute interval

// Mosaic cache
let cachedMosaics = [];

// Category search state
let GATHER_CATEGORY_SEARCH_ENABLED = true;
let GATHER_CATEGORY_RUNTIME_STATS = [];
let LAST_CATEGORY_GATHER_TIME;
let IS_GATHERING_CATEGORY_SEARCH = false;
let GATHER_CATEGORY_TIMEOUT_FN;
const CATEGORY_GATHERING_WAIT_TIME = 5 * 60000; // 5 minute interval

// Category search cache
let cachedCategoryImages = [];

// Load and validate permissions
let permissions = {};
try {
  permissions = PERMISSIONS;
} catch (err) {
  console.log('Failed to load permissions file, exiting.');
  throw err;
}

if (permissions.users === undefined) {
  throw new Error('Permissions has no users group');
}

const port = process.env.ASTRIA_API_PORT || permissions.port || 3001;

// ============================================================================
// EXPRESS APP INITIALIZATION
// ============================================================================

const app = express();
app.use(compression()); // Enable compression on responses, helpful when serving mosaics json

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * CSSO Authentication Handler
 * 
 * Extracts user authentication information from CSSO headers:
 * - X-Groups: Base64-encoded JSON of user's group memberships
 * - X-Sub: Username identifier
 * 
 * TODO: Validate req.user is not empty
 * TODO: Confirm X-Activity should always be true
 */
const cssoHandler = (req, res, next) => {
  // For this application, every HTTP request is a direct response to user
  // activity, so we can set the activity header to true on every response.
  res.set('X-Activity', 'true');

  try {
    req.groups = JSON.parse(Buffer.from(req.get('X-Groups'), 'base64').toString('ascii'));
    req.user = req.get('X-Sub');
    next();
  } catch (err) {
    console.error('Error decoding X-Groups');
    console.dir(err);
    res.status(400).send('authentication failed');
  }
};

/**
 * Authorization Handler
 * 
 * Ensures authenticated user belongs to at least one authorized group
 * defined in the permissions configuration.
 */
const ensureGroup = (req, res, next) => {
  const userGroups = Object.keys(req.groups).filter((group) => req.groups[group]);
  let groups = permissions.users;
  if (typeof groups === 'string') {
    groups = [groups];
  }
  for (const group of groups) {
    if (userGroups.indexOf(group) !== -1) {
      next();
      return;
    }
  }
  res.status(403).send('You do not have the proper permissions to access this resource.');
};

/**
 * CORS Middleware
 * TODO: Restrict CORS to specific origins for production
 */
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  // res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Auth");
  // res.header("Access-Control-Expose-Headers", "Content-Disposition, Content-Type");
  next();
});

/**
 * Cache Control Middleware
 * Disables client-side caching for all responses
 */
app.use(function nocache(req, res, next) {
  res.header('Cache-Control', 'no-cache');
  next();
});

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

// --- Health Check (unauthenticated) ---

/**
 * Health Check Endpoint
 * Used by load balancers, monitoring systems, and container orchestration
 * Returns server status, uptime, and memory usage
 */
app.get('/api/health', (req, res) => {
  const healthCheck = {
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: Date.now(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
    mosaicGathering: {
      enabled: GATHER_MOSAICS_ENABLED,
      isGathering: IS_GATHERING_MOSAICS,
      lastGatherTime: LAST_GATHER_TIME,
      cachedMosaicsCount: cachedMosaics.length
    }
  };
  
  res.status(200).json(healthCheck);
});

if (USING_CSSO) {
  // Apply CSSO authentication and authorization
  app.use(cssoHandler);
  app.use(ensureGroup);
  app.use(cookieParser());

  // Serve static frontend files
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  app.use(express.static(path.join(__dirname, 'dist')));

  // --- Authentication Routes ---

  app.get('/csso_username', (req, res) => {
    res.status(200).json({ username: req.user });
  });

  app.get('/login_success', (req, res) => {
    res
      .status(200)
      .send(
        '<div style="font-family:sans-serif;"><h3>Login success</h3><a href="JavaScript:window.close()">Close</a></div>'
      );
  });

  // --- Mosaic Browse Routes ---

  if (config.feature_flags.search.enable_mosaic_browse) {
    // Get cached mosaics data
    app.get('/api/mosaics', async (req, res) => {
      res.json(cachedMosaics);
    });

    // Check if mosaic gathering is enabled
    app.get('/api/isMosaicGatheringEnabled', (req, res) => {
      res.status(200).json({ enabled: GATHER_MOSAICS_ENABLED });
    });

    // Get detailed mosaic gathering status
    app.get('/api/mosaicGatheringStatus', async (req, res) => {
      const stats = {
        gathering_mosaics: IS_GATHERING_MOSAICS,
        gather_mosaics_enabled: GATHER_MOSAICS_ENABLED,
        minutes_to_next_gather:
          IS_GATHERING_MOSAICS || !GATHER_MOSAICS_ENABLED
            ? 0
            : (MOSAIC_GATHERING_WAIT_TIME - (Date.now() - (LAST_GATHER_TIME || 0))) / 60000,
        runtimes: GATHER_RUNTIME_STATS,
      };
      res.json(stats);
    });

    // Admin page for managing mosaic gathering
    app.get('/api/mosaicGatheringAdmin', async (req, res) => {
      res.sendFile(path.join(__dirname, '/server/pages/mosaicGatheringAdmin.html'));
    });

    // Manually trigger mosaic gathering
    app.post('/api/forceMosaicGathering', async (req, res) => {
      if (IS_GATHERING_MOSAICS) {
        console.log('Mosaic gathering already ongoing');
        res.sendStatus(200);
        return;
      }

      console.log('Gathering mosaics now');
      clearTimeout(GATHER_TIMEOUT_FN);
      runGatherMosaics();
      res.sendStatus(200);
    });

    // Enable automatic mosaic gathering
    app.post('/api/enableMosaicGathering', async (req, res) => {
      GATHER_MOSAICS_ENABLED = true;
      console.log('Enabled mosaic gathering');
      clearTimeout(GATHER_TIMEOUT_FN);
      runGatherMosaics();
      res.sendStatus(200);
    });

    // Disable automatic mosaic gathering
    app.post('/api/disableMosaicGathering', async (req, res) => {
      GATHER_MOSAICS_ENABLED = false;
      console.log('Disabled mosaic gathering');
      clearTimeout(GATHER_TIMEOUT_FN);
      res.sendStatus(200);
    });
  }

  // --- Category Search Routes ---

  if (config.feature_flags.search.enable_category_search) {
    // Get cached category search images
    app.get('/api/categorySearch', async (req, res) => {
      res.json(cachedCategoryImages);
    });

    // Check if category search gathering is enabled
    app.get('/api/isCategorySearchGatheringEnabled', (req, res) => {
      res.status(200).json({ enabled: GATHER_CATEGORY_SEARCH_ENABLED });
    });

    // Get detailed category search gathering status
    app.get('/api/categorySearchGatheringStatus', async (req, res) => {
      const stats = {
        gathering_category_search: IS_GATHERING_CATEGORY_SEARCH,
        gather_category_search_enabled: GATHER_CATEGORY_SEARCH_ENABLED,
        minutes_to_next_gather:
          IS_GATHERING_CATEGORY_SEARCH || !GATHER_CATEGORY_SEARCH_ENABLED
            ? 0
            : (CATEGORY_GATHERING_WAIT_TIME - (Date.now() - (LAST_CATEGORY_GATHER_TIME || 0))) / 60000,
        runtimes: GATHER_CATEGORY_RUNTIME_STATS,
      };
      res.json(stats);
    });

    // Manually trigger category search gathering
    app.post('/api/forceCategorySearchGathering', async (req, res) => {
      if (IS_GATHERING_CATEGORY_SEARCH) {
        console.log('Category search gathering already ongoing');
        res.sendStatus(200);
        return;
      }

      console.log('Gathering category search images now');
      clearTimeout(GATHER_CATEGORY_TIMEOUT_FN);
      runGatherCategorySearch();
      res.sendStatus(200);
    });

    // Enable automatic category search gathering
    app.post('/api/enableCategorySearchGathering', async (req, res) => {
      GATHER_CATEGORY_SEARCH_ENABLED = true;
      console.log('Enabled category search gathering');
      clearTimeout(GATHER_CATEGORY_TIMEOUT_FN);
      runGatherCategorySearch();
      res.sendStatus(200);
    });

    // Disable automatic category search gathering
    app.post('/api/disableCategorySearchGathering', async (req, res) => {
      GATHER_CATEGORY_SEARCH_ENABLED = false;
      console.log('Disabled category search gathering');
      clearTimeout(GATHER_CATEGORY_TIMEOUT_FN);
      res.sendStatus(200);
    });

    // Admin page for managing category search gathering
    app.get('/api/categorySearchGatheringAdmin', async (req, res) => {
      res.sendFile(path.join(__dirname, '/server/pages/categorySearchGatheringAdmin.html'));
    });
  }
}

// --- Development Proxy ---

/**
 * Create HTTP/HTTPS proxy helper
 */
const createProxy = ({ hostname = 'localhost', mode = 'http', port = 80, options = {} }) => {
  return proxy(`${mode}://${hostname}:${port}`, options);
};

// In development mode, proxy to local HTTPS backend (allows self-signed certs)
if (!PROD_MODE) {
  app.use(
    '/',
    createProxy({
      mode: 'https',
      port: process.env.ASTRIA_UI_PORT || 3000,
      hostname: process.env.ASTRIA_PROXY_HOSTNAME || "localhost",
      options: {
        proxyReqOptDecorator: function (proxyReqOpts) {
          proxyReqOpts.rejectUnauthorized = false;
          return proxyReqOpts;
        },
      },
    })
  );
}

// ============================================================================
// MOSAIC GATHERING BUSINESS LOGIC
// ============================================================================

/**
 * Gather Mosaics
 * 
 * Authenticates via CSSO and fetches all available mosaic data.
 * Updates the cache and logs performance metrics.
 */

const gatherMosaics = async () => {
  if (!GATHER_MOSAICS_ENABLED) {
    console.log('Mosaic gathering disabled, skipping. To enable, send a GET to /api/enableMosaicGathering');
    return;
  }
  if (!appPassword) {
    console.log('No app password provided, mosaic gathering disabled');
    return;
  }
  console.log('Getting CSSO session');
  let session;
  try {
    session = await csso({ user: appAccount, pass: appPassword });
  } catch (err) {
    console.error('Unable to get CSSO session', err);
    return;
  }

  try {
    const start = process.hrtime();
    const { mosaics, totalKB, numResults, success } = await getMosaics(session);
    const hrEnd = process.hrtime(start);
    const runtimeMS = hrEnd[0] * 1000 + hrEnd[1] / 1000000;
    if (mosaics.length) {
      console.log(`Gathered all mosaics, ${numResults} found, total runtime ${runtimeMS / 1000} seconds.`);
      // Only cache results if the fetch was successful
      cachedMosaics = mosaics;
      GATHER_RUNTIME_STATS.push({
        runtimeSeconds: runtimeMS / 1000,
        numResults,
        queryDownloadSizeKB: totalKB,
        date: Date.now(),
        success,
      });
      mosaicsGathered(runtimeMS, totalKB, numResults);
    } else {
      GATHER_RUNTIME_STATS.push({
        runtimeSeconds: runtimeMS / 1000,
        numResults,
        queryDownloadSizeKB: totalKB,
        date: Date.now(),
        success,
      });
      logError('Unable to gather mosaics, none found', { message: 'Mosaic gathering error' });
    }
  } catch (err) {
    GATHER_RUNTIME_STATS.push({
      runtimeSeconds: 0,
      numResults: 0,
      queryDownloadSizeKB: 0,
      date: Date.now(),
      success: false,
    });
    logError('Unable to gather mosaics, none found', err);
  }
};

/**
 * Run Mosaic Gathering Loop
 * 
 * Continuously gathers mosaics at regular intervals.
 * Updates state flags and waits between gather cycles.
 */
const runGatherMosaics = async () => {
  console.log('Gathering mosaics...');
  IS_GATHERING_MOSAICS = true;
  await gatherMosaics();

  IS_GATHERING_MOSAICS = false;
  LAST_GATHER_TIME = Date.now();
  console.log(`Next mosaic gather in ${MOSAIC_GATHERING_WAIT_TIME / 60000} minutes`);
  const { promise, timeoutFn } = sleep(MOSAIC_GATHERING_WAIT_TIME);
  GATHER_TIMEOUT_FN = timeoutFn;
  await promise;

  runGatherMosaics();
};

/**
 * Gather Category Search Images
 * 
 * Authenticates via CSSO and fetches all available category search images
 * based on config-defined categories.
 */
const gatherCategorySearch = async () => {
  if (!GATHER_CATEGORY_SEARCH_ENABLED) {
    console.log('Category search gathering disabled, skipping. To enable, send a POST to /api/enableCategorySearchGathering');
    return;
  }
  if (!config.category_search || !config.category_search.categories || config.category_search.categories.length === 0) {
    console.log('No category search configuration found or categories empty, skipping');
    return;
  }
  if (!appPassword) {
    console.log('No app password provided, category search gathering disabled');
    return;
  }
  console.log('Getting CSSO session for category search');
  let session;
  try {
    const appAccountUser = config.category_search.app_account_user || appAccount;
    session = await csso({ user: appAccountUser, pass: appPassword });
  } catch (err) {
    console.error('Unable to get CSSO session for category search', err);
    return;
  }

  try {
    const start = process.hrtime();
    const { images, totalKB, numResults, success } = await getCategoryImages(session, config.category_search);
    const hrEnd = process.hrtime(start);
    const runtimeMS = hrEnd[0] * 1000 + hrEnd[1] / 1000000;
    if (images.length) {
      console.log(`Gathered all category search images, ${numResults} found, total runtime ${runtimeMS / 1000} seconds.`);
      cachedCategoryImages = images;
      GATHER_CATEGORY_RUNTIME_STATS.push({
        runtimeSeconds: runtimeMS / 1000,
        numResults,
        queryDownloadSizeKB: totalKB,
        date: Date.now(),
        success,
      });
    } else {
      GATHER_CATEGORY_RUNTIME_STATS.push({
        runtimeSeconds: runtimeMS / 1000,
        numResults,
        queryDownloadSizeKB: totalKB,
        date: Date.now(),
        success,
      });
      logError('Unable to gather category search images, none found', { message: 'Category search gathering error' });
    }
  } catch (err) {
    GATHER_CATEGORY_RUNTIME_STATS.push({
      runtimeSeconds: 0,
      numResults: 0,
      queryDownloadSizeKB: 0,
      date: Date.now(),
      success: false,
    });
    logError('Unable to gather category search images', err);
  }
};

/**
 * Run Category Search Gathering Loop
 * 
 * Continuously gathers category search images at regular intervals.
 */
const runGatherCategorySearch = async () => {
  console.log('Gathering category search images...');
  IS_GATHERING_CATEGORY_SEARCH = true;
  await gatherCategorySearch();

  IS_GATHERING_CATEGORY_SEARCH = false;
  LAST_CATEGORY_GATHER_TIME = Date.now();
  console.log(`Next category search gather in ${CATEGORY_GATHERING_WAIT_TIME / 60000} minutes`);
  const { promise, timeoutFn } = sleep(CATEGORY_GATHERING_WAIT_TIME);
  GATHER_CATEGORY_TIMEOUT_FN = timeoutFn;
  await promise;

  runGatherCategorySearch();
};

// ============================================================================
// SERVER INITIALIZATION
// ============================================================================

const httpServer = http.createServer(app);
httpServer.listen(port, (err) => {
  if (err) {
    console.log(err);
    return err;
  }

  console.log('Server listening on port ' + port);
  
  // Signal to parent process that the app is ready (for process managers)
  if (process.send) {
    process.send('ready');
  }
});

// Start background mosaic gathering if enabled
if (config.feature_flags.search.enable_mosaic_browse) {
  runGatherMosaics();
}

// Start background category search gathering if enabled
if (config.feature_flags.search.enable_category_search) {
  runGatherCategorySearch();
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

/**
 * Handle graceful shutdown for zero-downtime deployments
 * Closes server and cleans up resources before exit
 */
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  // Stop accepting new connections
  httpServer.close(() => {
    console.log('HTTP server closed');
    
    // Clear mosaic gathering timeout
    if (GATHER_TIMEOUT_FN) {
      clearTimeout(GATHER_TIMEOUT_FN);
      console.log('Mosaic gathering timeout cleared');
    }
    
    // Clear category search gathering timeout
    if (GATHER_CATEGORY_TIMEOUT_FN) {
      clearTimeout(GATHER_CATEGORY_TIMEOUT_FN);
      console.log('Category search gathering timeout cleared');
    }
    
    console.log('Graceful shutdown complete');
    process.exit(0);
  });
  
  // Force close after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
