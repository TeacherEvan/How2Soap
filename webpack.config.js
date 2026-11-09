const path = require('path');
const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');

/**
 * Zero-dependency copy of public/ static files into dist/.
 * (No CopyPlugin — the repo enforces 0 runtime deps and we keep the build chain lean.)
 */
class CopyPublicPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('CopyPublicPlugin', (compilation) => {
      const raw = compiler.webpack.sources.RawSource;
      const root = path.join(__dirname, 'public');
      const files = ['favicon.svg', 'manifest.webmanifest', 'sw.js'];
      const iconsDir = path.join(root, 'icons');
      if (fs.existsSync(iconsDir)) {
        for (const name of fs.readdirSync(iconsDir)) {
          if (name.endsWith('.png')) files.push(path.join('icons', name));
        }
      }
      for (const rel of files) {
        const abs = path.join(root, rel);
        if (!fs.existsSync(abs)) continue;
        compilation.emitAsset(rel.split(path.sep).join('/'), new raw(fs.readFileSync(abs)));
      }
    });
  }
}

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
          test: /\.ts$/,
          use: [{ loader: 'ts-loader', options: { transpileOnly: true } }],
          include: /tests[\\/]bundle-lazy-imports\.test\.ts$/,
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
          // Shared by the lazy Workbench and Fabrication windows; without this
          // group webpack emits two 28 KB copies of the recipe table.
          fabrication: {
            test: /[\\/]src[\\/]engine[\\/]fabrication\.ts/,
            name: 'fabrication',
            chunks: 'all',
            priority: 15,
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
          // Only error on entrypoint size; lazy-loaded chunks (e.g., bakedClips with per-vertex animation data)
          // can exceed this since they're not in the initial load.
          maxAssetSize: 1000000,
          hints: 'error',
          // Intro-splash media and source maps are not JS bundle weight.
          assetFilter: (assetFilename) => !/\.(mp4|webm|map)$/i.test(assetFilename),
        }
      : false,
    plugins: [
      new CopyPublicPlugin(),
      new HtmlWebpackPlugin({ template: './public/index.html', minify: production }),
      new MiniCssExtractPlugin({ filename: 'static/css/[name].[contenthash:8].css' }),
    ],
    devServer: {
      static: { directory: path.join(__dirname, 'public') },
      port: 8080,
      hot: true,
      headers: isolationHeaders,
    },
    stats: production ? 'verbose' : 'normal',
  };
};
