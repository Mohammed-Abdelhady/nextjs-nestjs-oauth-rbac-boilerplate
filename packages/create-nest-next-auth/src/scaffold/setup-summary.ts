import { INSTALL_COMMAND, MISSING_PNPM_MESSAGE } from '../constants/index.js';
import { COREPACK_ACTIVATION_COMMAND, HOOK_ACTIVATION, SETUP_STATUS } from '../constants/setup.js';
import type { SetupFacts, SetupSummary } from '../types/setup.js';

/** Builds the public result from observed setup outcomes, without printing. */
export function buildSetupSummary(facts: SetupFacts): SetupSummary {
  const { ownRepository, hooksIncluded, hooksActive, ...result } = facts;
  const active = hooksActive && facts.install.status === SETUP_STATUS.INSTALLED;
  let activationCommand: string | undefined;
  if (hooksIncluded && !active) {
    const installed = facts.install.status === SETUP_STATUS.INSTALLED;
    activationCommand = ownRepository
      ? installed
        ? HOOK_ACTIVATION.HUSKY
        : HOOK_ACTIVATION.INSTALL
      : installed
        ? HOOK_ACTIVATION.GIT_AND_HUSKY
        : HOOK_ACTIVATION.GIT_AND_INSTALL;
  }
  if (activationCommand && facts.lockfile.reason === MISSING_PNPM_MESSAGE) {
    activationCommand = activationCommand.replace(
      INSTALL_COMMAND,
      `${COREPACK_ACTIVATION_COMMAND} && ${INSTALL_COMMAND}`,
    );
  }
  return {
    ...result,
    exitCode:
      facts.install.status === SETUP_STATUS.FAILED || facts.install.status === SETUP_STATUS.BLOCKED
        ? 1
        : 0,
    hooks: {
      included: hooksIncluded,
      active,
      ...(activationCommand === undefined ? {} : { activationCommand }),
    },
  };
}
