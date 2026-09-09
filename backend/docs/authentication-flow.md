# Authentication Flow

This document describes the email-based authentication flow including signup, email verification, and login.

## Overview

The system uses a **two-step registration** process with email verification and **session-based authentication** with HTTP-only cookies.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Authentication Flow Overview                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│   │ Register │───>│  Email   │───>│ Activate │───>│  Access  │ │
│   │          │    │  Sent    │    │  Account │    │  System  │ │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘ │
│                                                                  │
│   ┌──────────┐    ┌──────────┐                                  │
│   │  Login   │───>│  Access  │                                  │
│   │          │    │  System  │                                  │
│   └──────────┘    └──────────┘                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Registration (Signup)

### Endpoint

```
POST /api/auth/register
```

### Request Body

```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "John Doe"
}
```

### Validation Rules

| Field    | Rules                                     |
| -------- | ----------------------------------------- |
| email    | Valid email format, max 255 chars, unique |
| password | 8-128 chars, must contain letter + number |
| name     | 2-50 chars                                |

### Flow Diagram

```
Client                     Server                      Email Service
   │                          │                              │
   │  POST /register          │                              │
   │  {email, password, name} │                              │
   │─────────────────────────>│                              │
   │                          │                              │
   │                          │ 1. Check email not exists    │
   │                          │ 2. Hash password (bcrypt)    │
   │                          │ 3. Generate 6-digit code     │
   │                          │ 4. Hash code                 │
   │                          │ 5. Store pending registration│
   │                          │                              │
   │                          │  Send activation email       │
   │                          │─────────────────────────────>│
   │                          │                              │
   │  200 OK                  │                              │
   │  {message, email}        │                              │
   │<─────────────────────────│                              │
```

### Response

**Success (200):**

```json
{
  "message": "Activation code sent to your email",
  "email": "user@example.com"
}
```

**Errors:**

- `400` - Validation error (invalid email, weak password)
- `409` - Email already registered
- `429` - Rate limit exceeded (3 per hour per IP)

### What Happens Behind the Scenes

1. **Email Check**: Verify email doesn't exist in User collection
2. **Password Hashing**: Hash password with bcrypt (10 rounds)
3. **Code Generation**: Generate cryptographically secure 6-digit code
4. **Code Hashing**: Hash the code before storing
5. **Pending Storage**: Store in `pending_registrations` collection with 15-min TTL
6. **Email Delivery**: Send code via Nodemailer

**Important**: No user record is created yet. User is only created after activation.

---

## 2. Account Activation

### Endpoint

```
POST /api/auth/activate
```

### Request Body

```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

### Flow Diagram

```
Client                     Server                      Database
   │                          │                            │
   │  POST /activate          │                            │
   │  {email, code}           │                            │
   │─────────────────────────>│                            │
   │                          │                            │
   │                          │ 1. Find pending registration│
   │                          │───────────────────────────>│
   │                          │<───────────────────────────│
   │                          │                            │
   │                          │ 2. Check not expired       │
   │                          │ 3. Check attempts < 5      │
   │                          │ 4. Verify code hash        │
   │                          │                            │
   │                          │ 5. Create User             │
   │                          │───────────────────────────>│
   │                          │                            │
   │                          │ 6. Create Session          │
   │                          │───────────────────────────>│
   │                          │                            │
   │                          │ 7. Delete pending          │
   │                          │───────────────────────────>│
   │                          │                            │
   │  200 OK                  │                            │
   │  Set-Cookie: sid=xxx     │                            │
   │  {message, user}         │                            │
   │<─────────────────────────│                            │
```

### Response

**Success (200):**

```json
{
  "message": "Account activated successfully",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "isVerified": true
  }
}
```

Also sets HTTP-only cookie: `sid=<session_token>`

**Errors:**

- `400` - Invalid code, expired code, or no pending registration
- `401` - Max attempts exceeded (5 attempts)

### Security Features

- **Code Expiry**: 15 minutes
- **Max Attempts**: 5 failed attempts, then registration deleted
- **Hashed Storage**: Code is hashed, not stored in plain text

---

## 3. Login

### Endpoint

```
POST /api/auth/login
```

### Request Body

```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

### Flow Diagram

```
Client                     Server                      Database
   │                          │                            │
   │  POST /login             │                            │
   │  {email, password}       │                            │
   │─────────────────────────>│                            │
   │                          │                            │
   │                          │ 1. Find user by email      │
   │                          │    (include password)      │
   │                          │───────────────────────────>│
   │                          │<───────────────────────────│
   │                          │                            │
   │                          │ 2. Compare password hash   │
   │                          │                            │
   │                          │ 3. Create session          │
   │                          │───────────────────────────>│
   │                          │                            │
   │  200 OK                  │                            │
   │  Set-Cookie: sid=xxx     │                            │
   │  {message, user}         │                            │
   │<─────────────────────────│                            │
```

### Response

**Success (200):**

```json
{
  "message": "Login successful",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "isVerified": true
  }
}
```

**Errors:**

- `400` - Validation error
- `401` - Invalid credentials
- `429` - Rate limit exceeded (5 per 15 min per IP)

### Unverified Users

- Unverified users **CAN** login
- Response includes `"isVerified": false`
- Session is created normally
- **BUT**: Protected routes will return 403 until verified

---

## 4. Logout

### Endpoint

```
POST /api/auth/logout
```

### Flow

1. Extract session token from cookie
2. Invalidate session in database
3. Clear session cookie
4. Return success

### Response

**Success (200):**

```json
{
  "message": "Logged out successfully"
}
```

---

## 5. Session Management

### Session Cookie

```
Set-Cookie: sid=<token>; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/
```

| Attribute | Value       | Purpose            |
| --------- | ----------- | ------------------ |
| HttpOnly  | true        | Prevent XSS access |
| Secure    | true (prod) | HTTPS only         |
| SameSite  | Strict      | Prevent CSRF       |
| Max-Age   | 604800      | 7 days             |

### Session Storage

Sessions are stored in MongoDB with:

- User reference
- Token (cryptographically random)
- User agent (browser info)
- IP address
- Expiry time (TTL index for auto-cleanup)
- Validity flag (for logout)

### Session Validation

On each protected request:

1. Extract `sid` cookie
2. Find session by token
3. Check `isValid` is true
4. Check `expiresAt` is in future
5. Attach user to request
6. Update `lastUsedAt`

---

## 6. Route Protection

### Public Routes (No Auth Required)

```
POST /api/auth/register
POST /api/auth/activate
POST /api/auth/login
GET  /api/health
```

### Protected Routes (Auth Required)

```
POST /api/auth/logout
GET  /api/user/profile
PUT  /api/user/profile
```

### Verified Routes (Auth + Email Verified)

```
POST /api/orders
PUT  /api/settings
DELETE /api/account
```

### Guard Hierarchy

```
Request
   │
   ▼
┌─────────────────┐
│ Is @Public()?   │──Yes──> Allow
└────────┬────────┘
         │ No
         ▼
┌─────────────────┐
│   AuthGuard     │──Fail──> 401 Unauthorized
└────────┬────────┘
         │ Pass
         ▼
┌─────────────────┐
│ Route guards?   │──No──> Allow
│ (Permission,    │
│  Roles)         │──Fail──> 403 Forbidden
└────────┬────────┘
         │ Pass
         ▼
      Allow
```

---

## 7. Email Templates

### Activation Email

```
Subject: Verify Your Email Address

Hi {name},

Thank you for registering! Please use the following
6-digit verification code to complete your registration:

        {code}

This code will expire in 15 minutes.

If you didn't request this code, you can safely ignore this email.

Best regards,
The Team
```

---

## 8. Environment Configuration

```bash
# SMTP (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@yourapp.com

# Security
BCRYPT_ROUNDS=10

# Session
SESSION_COOKIE_NAME=sid
SESSION_COOKIE_MAX_AGE=604800000  # 7 days in ms

# Activation
ACTIVATION_CODE_EXPIRES_IN=900000  # 15 min in ms
ACTIVATION_MAX_ATTEMPTS=5
```

---

## 9. Error Codes Reference

| Code | Meaning           | When                                         |
| ---- | ----------------- | -------------------------------------------- |
| 400  | Bad Request       | Validation errors                            |
| 401  | Unauthorized      | Invalid credentials, invalid/expired session |
| 403  | Forbidden         | Email not verified                           |
| 409  | Conflict          | Email already exists                         |
| 429  | Too Many Requests | Rate limit exceeded                          |

---

## 10. Security Considerations

1. **Password Storage**: bcrypt with configurable rounds (default 10)
2. **Activation Codes**: Cryptographically random, hashed before storage
3. **Session Tokens**: 32 bytes random, stored as hex
4. **Rate Limiting**: Prevents brute force attacks
5. **HTTP-only Cookies**: Prevents XSS token theft
6. **SameSite Cookies**: Prevents CSRF attacks
7. **Constant-time Comparison**: bcrypt handles timing attacks
