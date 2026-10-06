import {
  colors,
  log,
  toKebabCase,
  toSnakeCase,
  toTitleCase,
  ask,
  askRequired,
  askYesNo,
} from './cli-utils.js';

export async function collectBasicInfo(rl) {
  log.step('Basic Project Information');

  const appName = await askRequired(rl, 'App name (e.g., My Awesome App)', (value) => {
    if (value.length < 2) {
      log.error('App name must be at least 2 characters');
      return false;
    }
    return true;
  });

  const appSlug = toKebabCase(appName);
  const appTitle = toTitleCase(appName);
  const dbName = toSnakeCase(appName);

  log.info(`Slug: ${colors.cyan}${appSlug}${colors.reset}`);
  log.info(`Database: ${colors.cyan}${dbName}${colors.reset}`);

  const description = await ask(
    rl,
    'Project description',
    `${appTitle} - Full-stack authentication application`,
  );
  const authorName = await ask(rl, 'Author name', '');

  return { appName, appSlug, appTitle, dbName, description, authorName };
}

export async function collectEnvironmentConfig(rl, dbName) {
  log.step('Environment Configuration');

  const frontendPort = await ask(rl, 'Frontend host port (the web app stays on 3000)', '3000');
  const backendPort = await ask(rl, 'Backend port', '5001');
  const mongoUri = await ask(rl, 'MongoDB URI', `mongodb://localhost:27017/${dbName}`);

  return {
    frontendPort: Number.parseInt(frontendPort, 10) || 3000,
    backendPort: Number.parseInt(backendPort, 10) || 5001,
    mongoUri: mongoUri || `mongodb://localhost:27017/${dbName}`,
  };
}

export async function collectSmtpConfig(rl) {
  log.step('SMTP Configuration (for sending emails)');

  const configureSmtp = await askYesNo(rl, 'Configure SMTP now?', false);
  if (!configureSmtp) {
    return { host: '', port: '587', secure: 'false', user: '', pass: '', from: '' };
  }

  const host = await ask(rl, 'SMTP host (e.g., smtp.gmail.com)', '');
  const port = await ask(rl, 'SMTP port', '587');
  const user = await ask(rl, 'SMTP user (email)', '');
  const pass = await ask(rl, 'SMTP password (app password)', '');
  const from = await ask(rl, 'From email', user);

  return { host, port, secure: 'false', user, pass, from: from || user };
}

export async function collectOAuthConfig(rl) {
  log.step('OAuth Configuration (optional)');
  const configureOAuth = await askYesNo(rl, 'Configure OAuth providers now?', false);
  const oauth = {
    google: { clientId: '', clientSecret: '' },
    facebook: { clientId: '', clientSecret: '' },
    github: { clientId: '', clientSecret: '' },
  };
  if (!configureOAuth) return oauth;

  if (await askYesNo(rl, 'Configure Google OAuth?', false)) {
    oauth.google.clientId = await ask(rl, 'Google Client ID', '');
    oauth.google.clientSecret = await ask(rl, 'Google Client Secret', '');
  }
  if (await askYesNo(rl, 'Configure Facebook OAuth?', false)) {
    oauth.facebook.clientId = await ask(rl, 'Facebook App ID', '');
    oauth.facebook.clientSecret = await ask(rl, 'Facebook App Secret', '');
  }
  if (await askYesNo(rl, 'Configure GitHub OAuth?', false)) {
    oauth.github.clientId = await ask(rl, 'GitHub Client ID', '');
    oauth.github.clientSecret = await ask(rl, 'GitHub Client Secret', '');
  }

  return oauth;
}
