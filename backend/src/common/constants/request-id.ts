/** Header carrying the correlation id, read from the client and echoed back. */
export const REQUEST_ID_HEADER = 'X-Request-Id';

/** Longest client supplied id that is trusted; longer values are replaced. */
export const REQUEST_ID_MAX_LENGTH = 128;

/** Ids from the client must look like this, otherwise a new one is generated. */
export const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
