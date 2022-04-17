## react-native-sass-transformer 增加注入屏幕适配函数，让写scss在react-native中体验等同web，无感知

### 配置如下:
```js
module.exports = (async () => {
  const { resolver } = await getDefaultConfig()
  const { sourceExts } = resolver
  return {
    transformer: {
      babelTransformerPath: require.resolve('./transformer.js'),
      getTransformOptions: async () => ({
        // 通过global注入的字体大小适配方法，如果需要通过引入注入方法，可以使用 fileImports: `import ScreenUtils from '@/utils/screen';` 注入
        fontSizeUnitFunc: 'setSpText',
        // 通过global注入的非字体大小适配方法
        sizeUnitFunc: 'scaleSize',
        // excludeSizeUnitFiles 排除的文件
        excludeSizeUnitFiles: [],
        transform: {
          experimentalImportSupport: false,
          inlineRequires: true,
        },
      }),
    },
    resolver: {
      sourceExts: [...sourceExts, 'scss', 'sass'],
    },
  }
})()
```
