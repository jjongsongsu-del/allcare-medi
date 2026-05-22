module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      "expo-router/babel",
      ["@babel/plugin-transform-typescript", { isTSX: true, allExtensions: true }],
      ["@babel/plugin-transform-class-properties", { loose: true }],
      ["@babel/plugin-transform-private-methods", { loose: true }],
      ["@babel/plugin-transform-private-property-in-object", { loose: true }],
      "@babel/plugin-transform-logical-assignment-operators",
      "@babel/plugin-transform-classes"
    ]
  };
};
