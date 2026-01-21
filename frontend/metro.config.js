const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// 添加对 .wasm 文件的支持
config.resolver.assetExts.push("wasm");

module.exports = config;
