import config from 'config.js';
import 'inter-ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { applyMiddleware, createStore } from 'redux';
import thunk from 'redux-thunk';
import App from 'src/components/App';
import reducers from 'src/reducers/index';
import 'src/styles/index.module.css';
import { urlParamMiddleware } from 'src/urlParamMiddleware';
import 'what-input';

// Set app title
document.title = config.app_title;

export const store = createStore(reducers, applyMiddleware(thunk, urlParamMiddleware));
window.store = store; // for debugging

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>
);
