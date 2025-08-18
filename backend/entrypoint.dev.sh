#!/bin/sh
set -e
npm ci
npx prisma generate --schema=src/prisma/schema.prisma
npm run start:dev