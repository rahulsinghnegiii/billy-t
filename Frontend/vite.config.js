const react = require("@vitejs/plugin-react-swc");
const { defineConfig } = require("vite");

module.exports = defineConfig({
  plugins: [react()],
  serer:{
    open: true,
    host: true
  }
});