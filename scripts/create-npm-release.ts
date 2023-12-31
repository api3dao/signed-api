// NOTE: This script is not included in TS lint process, so it should be typechecked at runtime.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const execSyncWithErrorHandling = (command: string) => {
  // eslint-disable-next-line functional/no-try-statements
  try {
    return execSync(command).toString();
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error(error.message);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    console.info('STDOUT', error.stdout.toString());
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    console.info('STDERR', error.stderr.toString());
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(1);
  }
};

const main = () => {
  const versionBump = process.argv[2];
  if (versionBump !== 'major' && versionBump !== 'minor' && versionBump !== 'patch') throw new Error('Invalid version');

  const noGitChecks = process.argv[3];
  if (noGitChecks && noGitChecks !== '--no-git-checks') throw new Error('Expected --no-git-checks flag');

  if (noGitChecks) {
    console.info('Skipping git checks...');
  } else {
    console.info('Ensuring working directory is clean...');
    const gitStatus = execSyncWithErrorHandling('git status --porcelain');
    if (gitStatus !== '') throw new Error('Working directory is not clean');

    console.info('Ensuring we are on the main branch...');
    const branch = execSyncWithErrorHandling('git branch --show-current');
    if (branch !== 'main\n') throw new Error('Not on the main branch');

    console.info('Ensuring we are up to date with the remote...');
    execSyncWithErrorHandling('git fetch');
    const gitDiff = execSyncWithErrorHandling('git diff origin/main');
    if (gitDiff !== '') throw new Error('Not up to date with the remote');
  }

  console.info('Making sure we have the latest version of the dependencies...');
  execSyncWithErrorHandling('pnpm install');

  const currentVersion = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8')).version;
  console.info(`Current version is ${currentVersion}...`);

  console.info('Bumping root package.json version...');
  execSyncWithErrorHandling(`pnpm version --no-git-tag-version ${versionBump}`);

  const newVersion = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8')).version;
  console.info(`Bumping airnode-feed version to version ${newVersion}...`);
  execSyncWithErrorHandling(`cd packages/airnode-feed && pnpm version ${newVersion}`);
  console.info(`Bumping signed-api version to version ${newVersion}...`);
  execSyncWithErrorHandling(`cd packages/signed-api && pnpm version ${newVersion}`);

  console.info('Updating versions in example files and fixtures...');
  const replacements = [
    [
      'packages/airnode-feed/config/airnode-feed.example.json',
      `"nodeVersion": "${currentVersion}"`,
      `"nodeVersion": "${newVersion}"`,
    ],
    [
      'packages/e2e/src/airnode-feed/airnode-feed.json',
      `"nodeVersion": "${currentVersion}"`,
      `"nodeVersion": "${newVersion}"`,
    ],
    [
      'packages/performance-test/airnode-feed/create-config.ts',
      `nodeVersion: '${currentVersion}'`,
      `nodeVersion: '${newVersion}'`,
    ],
    ['packages/e2e/src/signed-api/signed-api.json', `"version": "${currentVersion}"`, `"version": "${newVersion}"`],
    [
      'packages/performance-test/signed-api/signed-api.json',
      `"version": "${currentVersion}"`,
      `"version": "${newVersion}"`,
    ],
    [
      'packages/signed-api/config/signed-api.example.json',
      `"version": "${currentVersion}"`,
      `"version": "${newVersion}"`,
    ],
  ] as const;
  for (const replacement of replacements) {
    const [relativeFilePath, valueToReplace, newValue] = replacement;
    const filePath = join(__dirname, `../${relativeFilePath}`);
    const fileContent = readFileSync(filePath, 'utf8');
    writeFileSync(filePath, fileContent.replaceAll(valueToReplace, newValue));
  }

  console.info('Running ESLint...');
  execSyncWithErrorHandling('pnpm eslint:check');

  console.info('Running Prettier...');
  execSyncWithErrorHandling('pnpm prettier:check');

  console.info('Running TypeScript compiler checks...');
  execSyncWithErrorHandling('pnpm tsc');

  console.info('Running unit tests...');
  execSyncWithErrorHandling('pnpm test');

  console.info('Creating fresh build artifacts...');
  execSyncWithErrorHandling('pnpm clean && pnpm build');

  console.info('Creating new commit...');
  execSyncWithErrorHandling('git add .');
  execSyncWithErrorHandling(`git commit -m "${newVersion}"`);

  console.info('Creating new annotated git tag...');
  execSyncWithErrorHandling(`git tag -a ${newVersion} -m "${newVersion}"`);

  console.info('');
  console.info('The airnode-feed and signed-api packages have been bumped to the new version.');
  console.info('Ensure the changes are correct by inspecting the last commit.');
  console.info('Build the docker images and run the e2e tests locally.');
  console.info('If everything looks good, push the commit and the tag to the remote and release the packages.');
};

main();
