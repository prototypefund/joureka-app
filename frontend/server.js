/* eslint-disable no-console */
const express = require("express");
const next = require("next");
const timeout = require('connect-timeout')


const devProxy = {
  // make all the backend api (including /backend/docs) available
  "/backend": {
    target: "http://localhost:8888",
    pathRewrite: { "^/backend/": "/" },
    changeOrigin: true,
    logLevel: "debug",
    //timeout: 600000,
    //proxyTimeout: 600000,
  },
  // map all routes starting with /api unchanged to the backend
  "/api": {
    target: "http://localhost:8888",
    pathRewrite: { "^/": "/" },
    changeOrigin: true,
    logLevel: "info",
    //timeout: 600000,
    //proxyTimeout: 600000,
  },
};

const port = parseInt(process.env.PORT, 10) || 3000;
const env = process.env.NODE_ENV;
const dev = env !== "production";
const app = next({
  dir: ".", // base directory where everything is, could move to src later
  dev,
});

const handle = app.getRequestHandler();

let server;
app
  .prepare()
  .then(() => {
    server = express();

    // Set up the proxy.
    if (dev && devProxy) {
      const { createProxyMiddleware } = require("http-proxy-middleware");
      Object.keys(devProxy).forEach(function (context) {
        server.use(context, createProxyMiddleware(devProxy[context]));
      });
    }

    // Default catch-all handler to allow Next.js to handle all other routes
    server.all("*", (req, res) => {
      req.setTimeout(0)
      handle(req, res)
    });

    const s = server.listen(port, (err) => {
      if (err) {
        throw err;
      }
      console.log(`> Ready on port ${port} [${env}]`);
    });

  })
  .catch((err) => {
    console.log("An error occurred, unable to start the server");
    console.log(err);
  });
