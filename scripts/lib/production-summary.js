import { colors, log, drawBox, printKeyValue } from './cli-utils.js';

// ═══════════════════════════════════════════════════════════════
// Print Summary
// ═══════════════════════════════════════════════════════════════
export function printSummary(config) {
  drawBox('Configuration Summary', { color: colors.cyan });

  console.log(`${colors.cyan}Domain Configuration:${colors.reset}`);
  printKeyValue({
    'Main Domain': config.domains.mainDomain,
    'Frontend Domain': config.domains.frontendDomain,
    'Backend Domain': config.domains.backendDomain,
  });

  console.log(`\n${colors.cyan}SSL Configuration:${colors.reset}`);
  printKeyValue({
    Email: config.ssl.email,
    'Certificate Type': config.ssl.sslType,
  });

  console.log(`\n${colors.cyan}MongoDB Configuration:${colors.reset}`);
  printKeyValue({
    Username: config.database.username,
    Password: '***',
    Database: config.database.dbName,
  });

  console.log(`\n${colors.cyan}Port Configuration:${colors.reset}`);
  printKeyValue({
    'HTTP Port': config.ports.httpPort,
    'HTTPS Port': config.ports.httpsPort,
  });

  console.log('');
}

// ═══════════════════════════════════════════════════════════════
// Print Final Instructions
// ═══════════════════════════════════════════════════════════════
export function printFinalInstructions(config) {
  drawBox('Setup Complete!', { color: colors.green });

  console.log(`${colors.cyan}Access your application:${colors.reset}`);
  console.log(
    `  Frontend:    ${colors.green}https://${config.domains.frontendDomain}${colors.reset}`,
  );
  console.log(
    `  Backend:     ${colors.green}https://${config.domains.backendDomain}${colors.reset}`,
  );
  console.log(
    `  Health:      ${colors.green}https://${config.domains.backendDomain}/health${colors.reset}`,
  );

  console.log(`\n${colors.cyan}Useful commands:${colors.reset}`);
  console.log(
    `  Start services:    ${colors.green}docker compose -f docker-compose.prod.yml up -d${colors.reset}`,
  );
  console.log(
    `  View logs:         ${colors.green}docker compose -f docker-compose.prod.yml logs -f${colors.reset}`,
  );
  console.log(
    `  Stop services:     ${colors.green}docker compose -f docker-compose.prod.yml down${colors.reset}`,
  );
  console.log(
    `  Check status:      ${colors.green}docker compose -f docker-compose.prod.yml ps${colors.reset}`,
  );

  console.log(`\n${colors.cyan}Important notes:${colors.reset}`);
  if (config.ssl.sslType === 'self-signed') {
    log.warn('You are using self-signed certificates. Browsers will show security warnings.');
    log.warn('Do NOT use self-signed certificates in production!');
  }
  log.info('Make sure your DNS records point to this server.');
  log.info('Review and update the generated .env file with your secrets.');
  log.info('Configure SMTP settings for email functionality.');

  console.log('');
}
