#!/bin/sh

rm -rf ./node_modules/.cache
rm -rf ./node_modules/@arwes

rm -rf ./packages/*/build
rm -rf ./packages/*/.turbo
rm -rf ./packages/*/.tsbuildinfo

rm -rf ./apps/*/build
rm -rf ./apps/*/.turbo
rm -rf ./apps/docs/.next
rm -rf ./apps/docs/out
rm -rf ./apps/docs/public

rm -rf ./coverage
rm -rf ./.turbo
rm -rf ./www
rm -rf ./www.zip
