import axios from 'axios';
import { config } from '../config';

/**
 * HTTP client for the internal ML service. Every request carries the shared
 * internal API key so the service rejects callers other than this backend.
 */
export const mlClient = axios.create({
  baseURL: config.services.mlServiceUrl,
  timeout: 5000,
  headers: config.services.mlServiceApiKey
    ? { 'X-Internal-Api-Key': config.services.mlServiceApiKey }
    : {},
});
