import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'us-east-1_dB7LLqLBD',
      userPoolClientId: '5t7s598es2q8e0lipftv356gij',
      region: 'us-east-1'
    }
  },
  API: {
    GraphQL: {
      endpoint: 'https://n7sry4lnivbf3kh5wu37a27nbi.appsync-api.us-east-1.amazonaws.com/graphql',
      region: 'us-east-1',
      defaultAuthMode: 'userPool'
    }
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);