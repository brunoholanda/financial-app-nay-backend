#!/bin/bash
set -e
HTML=$(cat /tmp/digest-preview.html)
BOUNDARY="b-$(date +%s)"
TO="brunoholanda1618@gmail.com"

/usr/sbin/sendmail -f contato@brunoholanda.com -- "$TO" <<EOF
From: App Financeiro <contato@brunoholanda.com>
To: $TO
Subject: Contas a pagar — exemplo do digest diario (template)
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="$BOUNDARY"

--$BOUNDARY
Content-Type: text/plain; charset=UTF-8

Exemplo do digest diario de contas a pagar. Abra em HTML.

--$BOUNDARY
Content-Type: text/html; charset=UTF-8

$HTML

--$BOUNDARY--
EOF

sleep 12
grep -E "brunoholanda1618|Completed|\*\*|550|=>" /var/log/exim4/mainlog | tail -20
