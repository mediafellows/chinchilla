const path = require('path')
const webpack = require('webpack')

module.exports = {
  mode: 'none',
  entry: [
    'core-js/features/object/assign',
    './src/es5.pack.ts',
  ],
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'chinchilla.es5.pack.js',
    environment: {
      arrowFunction: false,
      bigIntLiteral: false,
      const: false,
      destructuring: false,
      dynamicImport: false,
      forOf: false,
      module: false
    }
  },
  resolve: {
    extensions: ['.js', '.ts']
  },
  module: {
    rules: [
      { test: /\.tsx?$/, loader: 'ts-loader', options: { configFile: 'tsconfig.es5.json' } },
      {
        test: /\.js$/,
        exclude: /node_modules\/core-js/,
        loader: 'babel-loader',
        options: {
          babelrc: false,
          configFile: false,
          presets: [
            ['@babel/preset-env', { targets: { ie: '11' }, modules: false }]
          ]
        }
      }
    ]
  },
  plugins: [
    new webpack.ProvidePlugin({
      Proxy: path.resolve(__dirname, 'src/support/callable-proxy.js')
    })
  ]
}
