import API_URL from './api';

export const fetchWithAuth = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');

  // Set up default headers
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers, // Allow overriding headers if needed
  };

  // Automatically attach the token if it exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Make the actual fetch call
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Global check: If token is expired or invalid, log the user out
  if (response.status === 401) {
    console.error("Unauthorized! Token may be expired.");
    localStorage.removeItem('token');
    window.location.href = '/login'; // Redirect to login page
  }

  return response;
};