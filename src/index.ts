const fp = require('fastify-plugin');
const proxy = require('fastify-reply-from');

const PROXY_BASE_PATH = '/graphql';

export enum ApiVersion {
  July19 = '2019-07',
  October19 = '2019-10',
  January20 = '2020-01',
  April20 = '2020-04',
  July20 = '2020-07',
  Stable = '2020-04',
}

interface ShopifySession {
  shop?: String;
  accessToken?: String;
}

interface DefaultProxyOptions {
  version: ApiVersion;
}

interface PrivateShopOption extends DefaultProxyOptions {
  password: string;
  shop: string;
}

type ProxyOptions = PrivateShopOption | DefaultProxyOptions;

async function shopifyGraphQLProxy(fastify, proxyOptions: ProxyOptions, _done) {
  const session: ShopifySession = { shop: '', accessToken: '' };

  fastify.addHook('onRequest', async (request, _reply, _done) => {
    if (request.url !== PROXY_BASE_PATH && request.method !== 'POST') {
      return;
    }

    session.shop = request?.session?.shop;
    session.accessToken = request?.session?.accessToken;
  });

  const shop = 'shop' in proxyOptions ? proxyOptions.shop : session.shop;
  const accessToken = 'password' in proxyOptions ? proxyOptions.password : session.accessToken;
  const version = proxyOptions.version || ApiVersion.Stable;

  if (accessToken === null || shop === null) {
    throw new Error('Unauthorized');
  }

  fastify.register(proxy, {
    base: shop,
  });

  fastify.post(PROXY_BASE_PATH, function(_request, reply) {
    reply.from(`${shop}/admin/api/${version}/graphql.json`, {
      rewriteRequestHeaders(_originalReq, headers) {
        const modifiedHeaders = {
          ...headers,
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        };

        return modifiedHeaders;
      },
    });
  });
}

module.exports = fp(shopifyGraphQLProxy, {
  fastify: '^2.0.0',
  name: 'fastify-shopify-graphql-proxy',
});