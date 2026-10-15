/**
 * @file axiosClient.js
 * @description Configures and exports a pre-configured Axios instance for API requests.
 * Ensures the base API URL is set and cookie-based credentials are automatically included.
 */

import axios from "axios"

const axiosClient =  axios.create({
    // Retrieve base API endpoint from Vite's environment configurations
    baseURL: import.meta.env.VITE_API_URL,
    
    // Automatically attach credentials (e.g., cookies/session headers) with every request
    withCredentials: true
});

export default axiosClient;

