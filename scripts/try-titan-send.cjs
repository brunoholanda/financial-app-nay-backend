const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

function loadEnv(filePath) {
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function tryAuth(label, options, auth) {
  const transporter = nodemailer.createTransport({
    ...options,
    auth,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
  });
  try {
    await transporter.verify();
    console.log(label, 'VERIFY_OK');
    return transporter;
  } catch (err) {
    console.log(label, 'FAIL', err.message);
    return null;
  }
}

async function main() {
  const to = process.argv[2] || 'brunoholanda1618@gmail.com';
  const env = loadEnv(path.join(__dirname, '..', '.env'));
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASS;
  const htmlPath = path.join(__dirname, 'digest-preview.html');
  const html = fs.existsSync(htmlPath)
    ? fs.readFileSync(htmlPath, 'utf8')
    : '<p>Teste digest App Financeiro</p>';

  console.log('user=', user);
  console.log('passLen=', pass.length, 'passChars=', JSON.stringify(pass));
  console.log('to=', to);

  const attempts = [
    {
      label: `env-${env.SMTP_PORT}-secure-${env.SMTP_SECURE}`,
      options: {
        host: env.SMTP_HOST || 'smtp.titan.email',
        port: Number(env.SMTP_PORT || 587),
        secure: String(env.SMTP_SECURE || 'false').toLowerCase() === 'true',
        requireTLS:
          Number(env.SMTP_PORT || 587) === 587 &&
          String(env.SMTP_SECURE || 'false').toLowerCase() !== 'true',
      },
    },
    {
      label: '587-starttls',
      options: {
        host: 'smtp.titan.email',
        port: 587,
        secure: false,
        requireTLS: true,
      },
    },
    {
      label: '465-ssl',
      options: { host: 'smtp.titan.email', port: 465, secure: true },
    },
  ];

  let transporter = null;
  for (const a of attempts) {
    transporter = await tryAuth(a.label, a.options, { user, pass });
    if (transporter) break;
  }

  if (!transporter) {
    // try without special chars issues: raw pass from env line
    console.log('Trying alternate pass parsing...');
    const rawLine = fs
      .readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
      .split(/\r?\n/)
      .find((l) => l.startsWith('SMTP_PASS='));
    const rawPass = rawLine ? rawLine.slice('SMTP_PASS='.length) : '';
    console.log('rawPass=', JSON.stringify(rawPass));
    transporter = await tryAuth(
      '465-ssl-rawpass',
      { host: 'smtp.titan.email', port: 465, secure: true },
      { user, pass: rawPass },
    );
  }

  if (!transporter) {
    process.exit(1);
  }

  const info = await transporter.sendMail({
    from: env.MAIL_FROM || `App Financeiro <${user}>`,
    to,
    subject: 'Contas a pagar — teste Titan SMTP (digest)',
    text: 'Teste do digest diario via smtp.titan.email',
    html,
  });
  console.log('SENT', info.messageId, info.response);
}

main().catch((err) => {
  console.error('FATAL', err.message);
  process.exit(1);
});
