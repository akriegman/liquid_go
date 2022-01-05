/* eslint-env node */
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const WasmPackPlugin = require('@wasm-tool/wasm-pack-plugin');
// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

const dist = path.resolve(__dirname, 'dist');

module.exports = {
  // mode: 'development',
  // devtool: 'eval-source-map',
  experiments: {
    asyncWebAssembly: true,
  },
  entry: {
    index: './js/index.js',
  },
  output: {
    path: dist,
    filename: '[name].js',
  },
  devServer: {
    static: dist,
    watchFiles: ['static/**/*']
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /(node_modules|bower_components)/,
        loader: 'babel-loader',
      }
    ]
  },
  resolve: { extensions: ['*', '.js', '.jsx'] },
  plugins: [
    // new BundleAnalyzerPlugin(),
    new CopyPlugin({ patterns: [path.resolve(__dirname, 'static')] }),
    new WasmPackPlugin({
      crateDirectory: __dirname,
      extraArgs: '-- -Z build-std=std,panic_abort -Z build-std-features=panic_immediate_abort',
    }),
  ],
};
