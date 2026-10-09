import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MOBILE_RUN_COMMAND } from '../../src/constants/mobile.js';
import { nativeRegistration } from '../../src/mobile/apply.js';
import {
  expectEngineSuitesStayInRepository,
  expectExpoWorkspace,
  expectNoMobileWorkspace,
  MOBILE_WORKSPACE_REFERENCES,
  SIGN_IN_SITE_PATHS,
} from '../support/mobile-workspace-assertions.js';
import { type Packed, scaffold, sourceFilesWithMarkers } from './packed-cli.js';

const IDENTITY = {
  name: "Sam's Trail Log",
  slug: 'trail-log',
  appId: 'org.sample.trail',
  scheme: 'org.sample.trail-log',
};
const IDENTITY_FLAGS = [
  '--mobile-name',
  IDENTITY.name,
  '--mobile-slug',
  IDENTITY.slug,
  '--mobile-app-id',
  IDENTITY.appId,
  '--mobile-scheme',
  IDENTITY.scheme,
];
const REGISTRATION = `AUTH_NATIVE_APPLICATIONS=${nativeRegistration(IDENTITY)}`;
/** The identity this repository ships, which a generated app must not keep. */
const TEMPLATE_IDENTITY = /com\.example\.mobile|Mobile Expo|"mobile-expo"|Example Mobile/;

function read(project: string, path: string): string {
  return readFileSync(join(project, path), 'utf8');
}

function generate(packed: Packed, name: string, flags: string[]): string {
  const result = scaffold(packed, name, 'email-password', { flags });
  // A leftover import into a removed folder fails the run, so exit 0 is the reference check.
  expect(result.status, `${String(result.stdout)}\n${String(result.stderr)}`).toBe(0);
  expect(String(result.stdout)).not.toContain('still references files that were removed');
  return join(packed.workspace, name);
}

function mobileDocs(project: string): Record<string, boolean> {
  const readme = read(project, 'README.md');
  const agents = read(project, 'AGENTS.md');
  return {
    readmeRuns: readme.includes(MOBILE_RUN_COMMAND),
    readmeIdentity: readme.includes('mobile/expo/app.json'),
    readmeAndroid: /Android has not been built or run/.test(readme),
    agentsRuns: agents.includes(MOBILE_RUN_COMMAND),
    agentsAndroid: /Android has not been built or run/.test(agents),
    agentsScope: /^- Scopes: .*\bmobile\b/m.test(agents),
  };
}

export function mobileTargetCases(getPacked: () => Packed): void {
  describe('the clients a project is generated with', () => {
    it('leaves a web project with no mobile workspace and no word about one', () => {
      const project = generate(getPacked(), 'clients-web', ['--targets', 'web']);

      expectNoMobileWorkspace(project);
      expectEngineSuitesStayInRepository(project);
      expect(mobileDocs(project)).toEqual({
        readmeRuns: false,
        readmeIdentity: false,
        readmeAndroid: false,
        agentsRuns: false,
        agentsAndroid: false,
        agentsScope: false,
      });
      expect(read(project, 'README.md')).not.toMatch(/mobile app/i);
      expect(read(project, 'AGENTS.md')).not.toMatch(/\bmobile\b/i);
      expect(read(project, 'backend/.env.example')).toContain('# AUTH_NATIVE_APPLICATIONS=');
      expect(sourceFilesWithMarkers(project)).toEqual([]);
    });

    it.each([
      ['web and the Expo app', 'clients-both', 'web,native-expo', ['native-expo', 'web']],
      ['the Expo app alone', 'clients-expo', 'native-expo', ['native-expo']],
    ])('keeps the Expo app and the sign-in site for %s', (_label, name, targets, recorded) => {
      const project = generate(getPacked(), name, ['--targets', targets, ...IDENTITY_FLAGS]);

      expectExpoWorkspace(project);
      expectEngineSuitesStayInRepository(project);
      expect(sourceFilesWithMarkers(project)).toEqual([]);
      expect(read(project, 'README.md')).not.toContain('feature:');
      expect(mobileDocs(project)).toEqual({
        readmeRuns: true,
        readmeIdentity: true,
        readmeAndroid: true,
        agentsRuns: true,
        agentsAndroid: true,
        agentsScope: true,
      });
      const answers = JSON.parse(read(project, '.create-nest-next-auth.json')) as {
        answers: { targets: string[] };
      };
      expect(answers.answers.targets).toEqual(recorded);
    });

    it('writes the identity into the app config and the server examples, and nowhere twice', () => {
      const project = generate(getPacked(), 'clients-identity', [
        '--targets',
        'web,native-expo',
        ...IDENTITY_FLAGS,
      ]);

      const app = JSON.parse(read(project, 'mobile/expo/app.json')) as {
        expo: {
          name: string;
          slug: string;
          scheme: string;
          ios: { bundleIdentifier: string };
          android: { package: string };
        };
      };
      expect({
        name: app.expo.name,
        slug: app.expo.slug,
        scheme: app.expo.scheme,
        ios: app.expo.ios.bundleIdentifier,
        android: app.expo.android.package,
      }).toEqual({
        name: "Sam's Trail Log",
        slug: 'trail-log',
        scheme: 'org.sample.trail-log',
        ios: 'org.sample.trail',
        android: 'org.sample.trail',
      });
      for (const file of ['backend/.env.example', '.env.docker.example', 'backend/README.md']) {
        expect(read(project, file).split('\n'), file).toContain(REGISTRATION);
      }
      const leftovers = [
        'mobile/expo/app.json',
        'mobile/expo/src/config.ts',
        'mobile/expo/src/logic/resolve-config.ts',
        'backend/.env.example',
        '.env.docker.example',
        'backend/README.md',
        'README.md',
        'AGENTS.md',
      ].filter((file) => TEMPLATE_IDENTITY.test(read(project, file)));
      expect(leftovers).toEqual([]);
      // The app reads its scheme from app.json, so no source file repeats it.
      const copies = [
        'mobile/expo/src/config.ts',
        'mobile/expo/src/logic/resolve-config.ts',
      ].filter((file) => read(project, file).includes(IDENTITY.scheme));
      expect(copies).toEqual([]);
    });

    it('refuses the bare app and writes nothing', () => {
      const packed = getPacked();
      const result = scaffold(packed, 'clients-bare', 'email-password', {
        flags: ['--targets', 'web,native-cli'],
      });

      expect(result.status).toBe(2);
      expect(String(result.stdout)).toContain('"native-cli" is not available yet.');
      expect(existsSync(join(packed.workspace, 'clients-bare'))).toBe(false);
    });

    it('recognises its own patterns in a file that names a mobile workspace', () => {
      const samples = [
        "'mobile/expo/**/*.ts': []",
        'mobile\\/[^/]+\\/(src|app)',
        "from '@app/native-auth'",
        'pnpm --filter @app/mobile-expo run ios',
      ];
      const quiet = [
        '/mobile/i.test(agent)',
        'data-testid="mobile-menu-button"',
        'automobile/expo',
      ];

      expect(
        samples.filter((text) => MOBILE_WORKSPACE_REFERENCES.some((p) => p.test(text))),
      ).toEqual(samples);
      expect(quiet.filter((text) => MOBILE_WORKSPACE_REFERENCES.some((p) => p.test(text)))).toEqual(
        [],
      );
      expect(SIGN_IN_SITE_PATHS).toHaveLength(4);
    });
  });
}
