#!/usr/bin/env node

const path = require('path');
const creator = require('./src/creator');

const mainDomain = process.argv[2];
const alternativeNames = process.argv.slice(3);

if (!mainDomain) {
    console.warn(`Usage: ${path.basename(process.argv[1])} <main-doman> [<additional-domains>, …]`);
    process.exit(1);
}

creator.create(mainDomain, alternativeNames);
