# Documentation

Index of architecture documents, system guides, and provider setup tutorials.

## Core guides

- [Architecture](ARCHITECTURE.md): Request pipeline, session storage, OAuth provider registry, and security model.
- [Database schema](DATABASE_SCHEMA.md): MongoDB collections, document models, indexes, and migrations.
- [RBAC system](RBAC-SYSTEM.md): Dynamic role levels, permissions, and guard enforcement.
- [Migration guide](MIGRATION-GUIDE.md): Database migrations and rollback procedures.
- [Production setup](PRODUCTION-SETUP.md): Production checklist, SSL certificates, and Nginx proxy.
- [Code quality](code-quality.md): Linting, formatting, pre-commit hooks, and testing rules.
- [Deployment](deployment.md): Docker Compose and cloud deployment instructions.

## Authentication setup guides

### Credentials and second factor

- [SMTP setup](setup-smtp.md): Email verification and password resets.
- [Magic link setup](setup-magic-link.md): Passwordless email sign-in links.
- [Two-factor setup](setup-two-factor.md): Time-based one-time password (TOTP) and recovery codes.
- [Passkey setup](setup-passkeys.md): WebAuthn passkey registration and sign-in.

### OAuth and OIDC providers

- [Google setup](setup-google-oauth.md): Google Cloud OAuth 2.0 credentials and consent screen.
- [GitHub setup](setup-github-oauth.md): GitHub OAuth application registration and private email handling.
- [Facebook setup](setup-facebook-oauth.md): Meta developer portal configuration.
- [Facebook permissions](facebook-oauth-permissions.md): Permission scope reference for Facebook.
- [Apple setup](setup-apple-oauth.md): Sign in with Apple and form post callback.
- [Discord setup](setup-discord-oauth.md): Discord developer portal and OAuth application.
- [GitLab setup](setup-gitlab-oauth.md): GitLab OAuth application for SaaS or self-hosted instances.
- [LinkedIn setup](setup-linkedin-oauth.md): LinkedIn OpenID Connect application.
- [Microsoft setup](setup-microsoft-oauth.md): Microsoft Entra ID (Azure AD) registration.
- [Generic OIDC setup](setup-oidc-oauth.md): Any OpenID Connect identity provider via discovery document.
- [Slack setup](setup-slack-oauth.md): Slack OAuth 2.0 app configuration.
- [Twitch setup](setup-twitch-oauth.md): Twitch developer console and claims.
- [X (Twitter) setup](setup-x-oauth.md): X OAuth 2.0 app with PKCE.

## Backend documentation

See [backend/docs/](../backend/docs/):

- [Authentication flow](../backend/docs/authentication-flow.md): Step-by-step authentication flows and session creation.
- [OAuth authentication](../backend/docs/oauth-authentication.md): OAuth provider registry and provider addition steps.
- [User roles and permissions](../backend/docs/user-roles-permissions.md): RBAC model, role levels, and permission checks.
- [Database management](../backend/docs/database-management.md): MongoDB connection, migrations, and seed commands.
- [API responses](../backend/docs/api-responses.md): Response envelope formats and error codes.
- [Postman collection](../backend/docs/postman/README.md): Postman collection, environments, and test scripts.

## Workspaces

- [Project README](../README.md): Repository root and quick start.
- [Backend README](../backend/README.md): NestJS API server configuration and routes.
- [Frontend README](../frontend/README.md): Next.js application setup and state management.
