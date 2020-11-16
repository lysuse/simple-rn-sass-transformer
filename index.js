var sass = require("node-sass");
var semver = require("semver");
var css2rn = require("css-to-react-native-transform").default;
var path = require("path");
var fs = require("fs");
var appRoot = require("app-root-path");

var upstreamTransformer = null;

var reactNativeVersionString = require("react-native/package.json").version;
var reactNativeMinorVersion = semver(reactNativeVersionString).minor;

if (reactNativeMinorVersion >= 59) {
  upstreamTransformer = require("metro-react-native-babel-transformer");
} else if (reactNativeMinorVersion >= 56) {
  upstreamTransformer = require("metro/src/reactNativeTransformer");
} else if (reactNativeMinorVersion >= 52) {
  upstreamTransformer = require("metro/src/transformer");
} else if (reactNativeMinorVersion >= 47) {
  upstreamTransformer = require("metro-bundler/src/transformer");
} else if (reactNativeMinorVersion === 46) {
  upstreamTransformer = require("metro-bundler/build/transformer");
} else {
  // handle RN <= 0.45
  var oldUpstreamTransformer = require("react-native/packager/transformer");
  upstreamTransformer = {
    transform({ src, filename, options }) {
      return oldUpstreamTransformer.transform(src, filename, options);
    }
  };
}

// Iterate through the include paths and extensions to find the file variant
function findVariant(name, extensions, includePaths) {
  for (let i = 0; i < includePaths.length; i++) {
    const includePath = includePaths[i];

    // try to find the file iterating through the extensions, in order.
    const foundExtention = extensions.find(extension => {
      const fname = includePath + "/" + name + extension;
      const partialfname = includePath + "/_" + name + extension;
      return fs.existsSync(fname) || fs.existsSync(partialfname);
    });

    if (foundExtention) {
      return includePath + "/" + name + foundExtention;
    }
  }

  return false;
}

function renderToCSS({ src, filename, options }) {
  const ext = path.extname(filename);
  const exts = [
    // add the platform specific extension, first in the array to take precedence
    options.platform === "android" ? ".android" + ext : ".ios" + ext,
    ".native" + ext,
    ext
  ];
  var defaultOpts = {
    includePaths: [path.dirname(filename), appRoot],
    indentedSyntax: filename.endsWith(".sass"),
    importer: function (url /*, prev, done */) {
      // url is the path in import as is, which LibSass encountered.
      // prev is the previously resolved path.
      // done is an optional callback, either consume it or return value synchronously.
      // this.options contains this options hash, this.callback contains the node-style callback

      const urlPath = path.parse(url);
      const importerOptions = this.options;
      const incPaths = importerOptions.includePaths.slice(0).split(":");

      if (urlPath.dir.length > 0) {
        incPaths.unshift(path.resolve(path.dirname(filename), urlPath.dir)); // add the file's dir to the search array
      }
      const f = findVariant(urlPath.name, exts, incPaths);

      if (f) {
        return { file: f };
      }
    }
  };

  var opts = options.sassOptions
    ? Object.assign(defaultOpts, options.sassOptions, { data: src })
    : Object.assign(defaultOpts, { data: src });

  var result = sass.renderSync(opts);
  var css = result.css.toString();
  return css;
}

function renderToCSSPromise(css) {
  return Promise.resolve(renderToCSS(css));
}

function renderCSSToReactNative(css, filename, options) {
  const hasFontSizeUnitFunc = options.fontSizeUnitFunc && !(options.excludeSizeUnitFiles || []).includes(filename)
  const hasPxSizeUnitFunc = options.sizeUnitFunc && !(options.excludeSizeUnitFiles || []).includes(filename)
  hasFontSizeUnitFunc && (css = css.replace(/font-size:\s*(\d+)px/ig, function(text, matched) {
    return `font-size: ${options.fontSizeUnitFunc}(${matched})`
  }));
  hasPxSizeUnitFunc && (css = css.replace(/[:]{0,1}\s*(\d+)px/ig, function (text, matched) {
    return text.replace(`${matched}px`, `${options.fontSizeUnitFunc}(${matched})`)
  }));
  var cssObjectText = JSON.stringify(css2rn(css, { parseMediaQueries: true }));
  hasFontSizeUnitFunc && (css = css.replace(new RegExp(`('|")${options.fontSizeUnitFunc}\\((\\d+)\\)('|")`, 'ig'), function (text, matched) {
    return text.replace(/(\'|\")/ig, '');
  }));
  hasPxSizeUnitFunc && (css = css.replace(new RegExp(`('|")${options.sizeUnitFunc}\\((\\d+)\\)('|")`, 'ig'), function (text, matched) {
    return text.replace(/(\'|\")/ig, '');
  }));
  return cssObjectText
}

module.exports.transform = function (src, filename, options) {
  if (typeof src === "object") {
    // handle RN >= 0.46
    ({ src, filename, options } = src);
  }

  if (filename.endsWith(".scss") || filename.endsWith(".sass")) {
    var css = renderToCSS({ src, filename, options });
    var cssObjectText = renderCSSToReactNative(css, filename, options);
    var fileImports = options.fileImports || '';
    return upstreamTransformer.transform({
      src: `${fileImports}\nmodule.exports = ${cssObjectText}`,
      filename,
      options
    });
  }
  return upstreamTransformer.transform({ src, filename, options });
};

module.exports.renderToCSS = renderToCSSPromise;
