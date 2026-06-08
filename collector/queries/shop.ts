export type ShopQueryResult = {
  shop: {
    primaryDomain: { host: string; url: string; sslEnabled: boolean };
  };
};

export const SHOP_QUERY = `#graphql
  query ShopFundamentals {
    shop {
      id
      name
      contactEmail
      currencyCode
      # NOTE: shopAddress (the non-deprecated replacement) only exists in API
      # 2026-01+. Keep billingAddress until the admin client bumps past 2025-10,
      # otherwise the Shop query fails with an undefinedField error.
      billingAddress { countryCodeV2 }
      primaryDomain { host url sslEnabled }
      paymentSettings {
        supportedDigitalWallets
      }
      shopPolicies {
        type
        body
        url
      }
      titleTag: metafield(namespace: "global", key: "title_tag") { value }
      descriptionTag: metafield(namespace: "global", key: "description_tag") { value }
      description
    }
  }
`;

export const DELIVERY_QUERY = `#graphql
  query DeliveryProfiles {
    deliveryProfiles(first: 10) {
      edges {
        node {
          name
          profileLocationGroups {
            locationGroupZones(first: 20) {
              edges {
                node {
                  zone {
                    name
                    countries { code { countryCode } }
                  }
                  methodDefinitions(first: 10) {
                    edges {
                      node {
                        name
                        rateProvider {
                          ... on DeliveryRateDefinition {
                            price { amount }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const PRODUCTS_QUERY = `#graphql
  query Products($cursor: String) {
    products(first: 250, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          handle
          status
          description
          seo { title description }
          media(first: 10) {
            edges {
              node {
                ... on MediaImage {
                  id
                  alt
                  image {
                    url
                  }
                }
              }
            }
          }
          variants(first: 50) {
            edges {
              node {
                id
                sku
                price
                compareAtPrice
                inventoryItem { id tracked }
              }
            }
          }
        }
      }
    }
  }
`;

export const THEMES_QUERY = `#graphql
  query Themes {
    themes(first: 5, roles: [MAIN]) {
      edges {
        node {
          id
          name
          role
          themeStoreId
        }
      }
    }
  }
`;

export const LOCATIONS_QUERY = `#graphql
  query Locations {
    locations(first: 10) {
      edges {
        node {
          name
          fulfillsOnlineOrders
          address {
            country
            city
            zip
          }
        }
      }
    }
  }
`;

export const ORDERS_STATS_QUERY = `#graphql
  query OrdersStats($query: String!) {
    orders(first: 250, query: $query, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          totalPriceSet { shopMoney { amount } }
          test
          displayFinancialStatus
        }
      }
    }
  }
`;

export const ORDERS_CAPTURE_HINT_QUERY = `#graphql
  query OrdersCaptureHint {
    orders(first: 10, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          test
          displayFinancialStatus
        }
      }
    }
  }
`;

export const APPS_QUERY = `#graphql
  query InstalledApps {
    currentAppInstallation {
      allSubscriptions(first: 1) { edges { node { id status } } }
    }
  }
`;
