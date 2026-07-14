const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monitorear todas las carpetas del monorepo
config.watchFolders = [workspaceRoot];

// Buscar node_modules en la carpeta local y en la raíz del monorepo
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Deshabilitar búsqueda jerárquica para resolver paquetes hoisted
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
