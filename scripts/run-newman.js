// run-newman.js - runs the Postman collection with Newman against one environment,
// writes an HTML report, then (for normal runs) verifies the data in MySQL.
//
// Usage:
//   node scripts/run-newman.js local              full run + HTML report + SQL checks
//   node scripts/run-newman.js staging            same, against the staging environment
//   node scripts/run-newman.js local --data       data-driven run (postman/data/products.csv)
//
// Exit code is 0 only if every Newman assertion AND every SQL check passed.
const path = require('path');
const { spawnSync } = require('child_process');
const newman = require('newman');
require('./load-env')();

const root = path.join(__dirname, '..');
const envName = process.argv[2];
const dataDriven = process.argv.includes('--data');

if (!['local', 'staging'].includes(envName)) {
  console.error('Usage: node scripts/run-newman.js <local|staging> [--data]');
  process.exit(2);
}

// The expired-token test signs its own JWT, so Newman needs the environment's real secret.
// It comes from .env (or CI secrets), never from the committed Postman environment file.
const secret = process.env[`JWT_SECRET_${envName.toUpperCase()}`];
if (!secret) {
  console.error(`JWT_SECRET_${envName.toUpperCase()} is not set. Copy .env.example to .env first.`);
  process.exit(2);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const label = dataDriven ? `${envName}-data` : envName;
const reportFile = path.join(root, 'reports', `${label}-${stamp}.html`);
const exportFile = path.join(root, 'reports', `${envName}-env.json`); // read by db-verify.js

const options = {
  collection: path.join(root, 'postman', 'iguard.collection.json'),
  environment: path.join(root, 'postman', 'environments', `${envName}.json`),
  envVar: [{ key: 'jwtSecret', value: secret }],
  reporters: ['cli', 'htmlextra'],
  reporter: { htmlextra: { export: reportFile, title: `IGuard API tests (${label})`, browserTitle: 'IGuard report' } },
  exportEnvironment: exportFile,
};

if (dataDriven) {
  // One iteration per CSV row. Only auth + product CRUD use the row values, so run just those folders.
  options.iterationData = path.join(root, 'postman', 'data', 'products.csv');
  options.folder = ['01 Auth', '02 Products CRUD'];
}

newman.run(options, (err, summary) => {
  if (err) { console.error('Newman error:', err.message); process.exit(1); }
  console.log(`\nHTML report: ${path.relative(root, reportFile)}`);
  if (summary.run.failures.length) {
    console.error(`Newman: ${summary.run.failures.length} assertion/request failure(s)`);
    process.exit(1);
  }
  if (dataDriven) return; // SQL checks need IDs from the full run, so they are skipped here

  // Newman passed: now check that the database agrees with what the API said.
  const verify = spawnSync(process.execPath,
    [path.join(__dirname, 'db-verify.js'), '--env', envName, '--export', path.relative(root, exportFile)],
    { stdio: 'inherit', cwd: root });
  process.exit(verify.status === null ? 1 : verify.status);
});
