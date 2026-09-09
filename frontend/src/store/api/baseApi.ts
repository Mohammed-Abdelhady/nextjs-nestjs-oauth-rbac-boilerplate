import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '@/constants/api';

/**
 * Base query for RTK Query.
 * The session lives in an httpOnly cookie, so every request carries credentials.
 */
const baseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  credentials: 'include',
  prepareHeaders: (headers) => {
    headers.set('Content-Type', 'application/json');
    return headers;
  },
});

/**
 * Base API configuration for RTK Query
 * All API slices should extend from this
 */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: [
    'User',
    'Auth',
    'AuthMethods',
    'LinkedProviders', // feature:oauth-core
    'ProfileSync', // feature:oauth-core
    'Roles',
    'Permissions',
    'Sessions',
    'Passkeys', // feature:passkeys
  ],
  endpoints: () => ({}),
});
