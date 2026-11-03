const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');

const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

module.exports = (env, argv) => {
  const production = argv.mode === 'production';

  return {
    mode: production ? 'production' : 'development',
    devtool: production ? 'source-map' : 'eval-source-map',
    target: ['web', 'es2022'],
    entry: {
      main: './src/main.ts',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'static/js/[name].[contenthash:8].js',
      chunkFilename: 'static/js/[name].[contenthash:8].chunk.js',
      assetModuleFilename: 'static/media/[name].[hash:8][ext]',
      clean: true,
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: [{ loader: 'ts-loader', options: { transpileOnly: false } }],
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader'],
        },
        {
          test: /\.(mp4|webm|png)$/i,
          type: 'asset/resource',
        },
      ],
    },
    optimization: {
      minimize: production,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: { drop_console: true, passes: 2 },
            mangle: true,
          },
        }),
      ],
      moduleIds: 'deterministic',
      runtimeChunk: 'single',
      splitChunks: {
        chunks: 'all',
        maxInitialRequests: 10,
        minSize: 20000,
        maxSize: 180000,
        cacheGroups: {
          chemRegistry: {
            test: /[\\/]src[\\/]data[\\/]/,
            name: 'chem-registry',
            priority: 20,
          },
          vendors: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 10,
          },
        },
      },
    },
    performance: production
      ? {
          maxEntrypointSize: 200000,
          maxAssetSize: 200000,
          hints: 'error',
          // Intro-splash media are cached static assets, not JS bundle weight.
          assetFilter: (assetFilename) => !/\.(mp4|webm)$/i.test(assetFilename),
        }
      : false,
    plugins: [
      new HtmlWebpackPlugin({ template: './public/index.html', minify: production }),
      new MiniCssExtractPlugin({ filename: 'static/css/[name].[contenthash:8].css' }),
    ],
    devServer: {
      static: { directory: path.join(__dirname, 'public') },
      port: 8080,
      hot: true,
      headers: isolationHeaders,
    },
  };
};
