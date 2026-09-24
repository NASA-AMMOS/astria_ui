import 'inter-ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { applyMiddleware, createStore } from 'redux';
import thunk from 'redux-thunk';
import App from 'src/components/App';
import DefaultPage from 'src/components/DefaultPage';
import {
  createDefaultAnnotationMode,
  createDefaultApp,
  createDefaultSearchState,
  createDefaultSidebar,
} from 'src/reducers/constants';
import reducers from 'src/reducers/index';
import 'src/styles/index.module.css';
import { urlParamMiddleware } from 'src/urlParamMiddleware';
import { setConfig } from 'src/utils/configRegistry';
import 'what-input';

const CONFIG_PARAM_KEY = 'config';
const CONFIG_NAME_REGEX = /^[a-zA-Z0-9_\-.]+$/;

async function init() {
  const root = createRoot(document.getElementById('root'));
  const params = new URLSearchParams(window.location.search);
  const configName = params.get(CONFIG_PARAM_KEY);

  if (!configName) {
    root.render(
      <StrictMode>
        <DefaultPage />
      </StrictMode>
    );
    return;
  }

  if (!CONFIG_NAME_REGEX.test(configName)) {
    root.render(
      <StrictMode>
        <DefaultPage error={`Invalid config name: "${configName}"`} />
      </StrictMode>
    );
    return;
  }

  let config;
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}configs/${configName}.json`);
    if (!response.ok) throw new Error(`Config "${configName}" not found (HTTP ${response.status})`);
    config = await response.json();
  } catch (err) {
    root.render(
      <StrictMode>
        <DefaultPage error={err.message} />
      </StrictMode>
    );
    return;
  }

  setConfig(config);
  document.title = config.app_title || 'ASTRIA';

  const preloadedState = {
    config,
    sidebarState: createDefaultSidebar(config),
    annotationState: createDefaultAnnotationMode(config),
    search: createDefaultSearchState(config),
    app: createDefaultApp(config),
  };

  const store = createStore(reducers, preloadedState, applyMiddleware(thunk, urlParamMiddleware));
  window.store = store; // for debugging

  root.render(
    <StrictMode>
      <Provider store={store}>
        <App />
      </Provider>
    </StrictMode>
  );
}

init();
