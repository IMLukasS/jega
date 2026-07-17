// src/api.js
const API_URL = import.meta.env.PROD 
  ? 'https://jega-avda.onrender.com' 
  : 'http://localhost:3000';

export default API_URL;