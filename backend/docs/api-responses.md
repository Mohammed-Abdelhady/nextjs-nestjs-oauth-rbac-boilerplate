# API Response Documentation

This document describes the standardized API response format used across all endpoints in the application.

---

## Overview

All API responses follow a consistent structure to enable:

- Frontend internationalization (i18n) through error codes
- Type-safe error handling
- Consistent response shapes across all endpoints
- Better debugging and logging

---

## Response Formats

### Success Response

All successful responses follow this structure:

```typescript
{
  "success": true,
  "data": { ... },
  "message": "Optional human-readable message"
}
```

#### Fields

| Field     | Type                  | Description                            |
| --------- | --------------------- | -------------------------------------- |
| `success` | `true`                | Always `true` for successful responses |
| `data`    | `any`                 | The response data (varies by endpoint) |
| `message` | `string \| undefined` | Optional human-readable message        |

#### Example

```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "isVerified": true
  },
  "message": "Login successful"
}
```

---

### Error Response

All error responses follow this structure:

```typescript
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... }  // Optional
  }
}
```

#### Fields

| Field           | Type                                   | Description                                  |
| --------------- | -------------------------------------- | -------------------------------------------- |
| `success`       | `false`                                | Always `false` for error responses           |
| `error.code`    | `ErrorCode`                            | Machine-readable error code for i18n mapping |
| `error.message` | `string`                               | Human-readable error message                 |
| `error.details` | `Record<string, unknown> \| undefined` | Optional additional context                  |

#### Example

```json
{
  "success": false,
  "error": {
    "code": "ACTIVATION_CODE_INVALID",
    "message": "Invalid code. 3 attempts remaining.",
    "details": {
      "remainingAttempts": 3
    }
  }
}
```

---

## Error Codes

### Authentication Errors

| Code                   | HTTP Status | Description                         |
| ---------------------- | ----------- | ----------------------------------- |
| `INVALID_CREDENTIALS`  | 401         | Invalid email or password provided  |
| `EMAIL_ALREADY_EXISTS` | 409         | Email address is already registered |

### Activation Errors

| Code                      | HTTP Status | Description                             |
| ------------------------- | ----------- | --------------------------------------- |
| `ACTIVATION_CODE_EXPIRED` | 400         | Activation code has expired             |
| `ACTIVATION_CODE_INVALID` | 400         | Invalid activation code provided        |
| `MAX_ATTEMPTS_EXCEEDED`   | 401         | Maximum activation attempts exceeded    |
| `NO_PENDING_REGISTRATION` | 400         | No pending registration found for email |

### Email Errors

| Code                | HTTP Status | Description                                              |
| ------------------- | ----------- | -------------------------------------------------------- |
| `EMAIL_SEND_FAILED` | 400         | Admin email change could not send the verification email |

`EMAIL_SEND_FAILED` comes only from the admin email-change route. The signed-out code-request routes (register, resend activation, forgot password, magic link) log a delivery failure and still answer `200`, so none of them can reveal whether an address has an account.

### Session Errors

| Code               | HTTP Status | Description                     |
| ------------------ | ----------- | ------------------------------- |
| `SESSION_REQUIRED` | 401         | Authentication session required |
| `SESSION_INVALID`  | 401         | Session is invalid or malformed |
| `SESSION_EXPIRED`  | 401         | Session has expired             |

### Verification Errors

| Code                 | HTTP Status | Description                |
| -------------------- | ----------- | -------------------------- |
| `EMAIL_NOT_VERIFIED` | 403         | Email address not verified |

### Validation Errors

| Code               | HTTP Status | Description               |
| ------------------ | ----------- | ------------------------- |
| `VALIDATION_ERROR` | 400         | Request validation failed |

### Rate Limiting Errors

| Code                  | HTTP Status | Description         |
| --------------------- | ----------- | ------------------- |
| `RATE_LIMIT_EXCEEDED` | 429         | Rate limit exceeded |

### Generic Errors

| Code             | HTTP Status | Description           |
| ---------------- | ----------- | --------------------- |
| `INTERNAL_ERROR` | 500         | Internal server error |
| `NOT_FOUND`      | 404         | Resource not found    |
| `FORBIDDEN`      | 403         | Access forbidden      |

---

## Frontend Integration

### Error Handling

Use error codes for i18n translation and programmatic handling:

```typescript
async function handleLogin(credentials) {
  const response = await api.post('/auth/login', credentials);

  if (!response.success) {
    const { code, message, details } = response.error;

    // Use error code for i18n lookup
    const localizedMessage = i18n.t(`errors.${code}`) || message;

    // Handle specific errors
    switch (code) {
      case 'INVALID_CREDENTIALS':
        showToast(localizedMessage, 'error');
        break;
      case 'EMAIL_NOT_VERIFIED':
        redirectToVerification();
        break;
      case 'RATE_LIMIT_EXCEEDED':
        showRetryCountdown(details?.retryAfter);
        break;
      default:
        showToast(localizedMessage, 'error');
    }
  }

  return response.data;
}
```

### Success Handling

```typescript
async function handleLogin(credentials) {
  const response = await api.post('/auth/login', credentials);

  if (response.success) {
    const { data, message } = response;
    // Access user data
    const user = data.user;
    // Show success message if present
    if (message) {
      showToast(message, 'success');
    }
  }
}
```

### Type Definitions

```typescript
interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}

interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

type ApiResult<T> = ApiResponse<T> | ErrorResponse;

function isSuccess<T>(response: ApiResult<T>): response is ApiResponse<T> {
  return response.success === true;
}
```

---

## Endpoint Examples

### POST /auth/register

**Success Response:**

```json
{
  "success": true,
  "data": {
    "email": "user@example.com"
  },
  "message": "Activation code sent to your email"
}
```

**Error Response (Email already exists):**

```json
{
  "success": false,
  "error": {
    "code": "EMAIL_ALREADY_EXISTS",
    "message": "Email already registered"
  }
}
```

### POST /auth/activate

**Success Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user",
      "isVerified": true
    }
  },
  "message": "Account activated successfully"
}
```

**Error Response (Invalid code):**

```json
{
  "success": false,
  "error": {
    "code": "ACTIVATION_CODE_INVALID",
    "message": "Invalid code. 3 attempts remaining.",
    "details": {
      "remainingAttempts": 3
    }
  }
}
```

### POST /auth/login

**Success Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user",
      "isVerified": true
    }
  },
  "message": "Login successful"
}
```

**Error Response (Invalid credentials):**

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

### POST /auth/logout

**Success Response:**

```json
{
  "success": true,
  "data": {
    "message": "Logout successful"
  }
}
```

**Error Response (Invalid session):**

```json
{
  "success": false,
  "error": {
    "code": "SESSION_INVALID",
    "message": "Invalid session"
  }
}
```

---

## Migration Guide

### For Existing Frontend Code

If you have existing frontend code that expects the old response format, you can create a migration helper:

```typescript
function migrateResponse<T>(oldResponse: any): ApiResponse<T> | ErrorResponse {
  // Handle old success format { message, email } or { message, user }
  if (oldResponse.message && (oldResponse.email || oldResponse.user)) {
    return {
      success: true,
      data: oldResponse,
      message: oldResponse.message,
    };
  }

  // Handle old error format (plain string or object)
  if (typeof oldResponse === 'string' || oldResponse.error) {
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message:
          typeof oldResponse === 'string' ? oldResponse : oldResponse.error,
      },
    };
  }

  // Already in new format
  return oldResponse;
}
```

---

## Best Practices

1. **Always check `success` field first** before accessing `data` or `error`
2. **Use error codes for programmatic decisions**, not message strings
3. **Provide localized messages** using error codes with i18n
4. **Handle `details` object** when available for additional context
5. **Log error codes** for debugging and monitoring
6. **Don't hardcode error messages** in frontend - use i18n instead

---

## References

- [ErrorCode enum](../src/common/enums/error-code.enum.ts)
- [ApiResponse DTO](../src/common/dto/api-response.dto.ts)
- [AppException](../src/common/exceptions/app.exception.ts)
- [GlobalExceptionFilter](../src/common/filters/global-exception.filter.ts)
