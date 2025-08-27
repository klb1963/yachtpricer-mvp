#!/bin/sh
set -e

# зависимости ставятся на этапе сборки образа deps
# npm ci

# сгенерировать Prisma client (ищет prisma/schema.prisma)
npx prisma generate

# запустить Nest в watch-режиме
npm run start:dev