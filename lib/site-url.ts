function normalizeUrl(url: string) {
  return url.trim().replace(/\/+$/, '')
}

function withProtocol(url: string) {
  if (/^https?:\/\//i.test(url)) {
    return url
  }

  return `https://${url}`
}

export function getSiteUrl(requestHeaders?: Headers) {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL

  if (configuredUrl) {
    return normalizeUrl(withProtocol(configuredUrl))
  }

  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (vercelProductionUrl) {
    return normalizeUrl(withProtocol(vercelProductionUrl))
  }

  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) {
    return normalizeUrl(withProtocol(vercelUrl))
  }

  const requestOrigin = requestHeaders?.get('origin')
  if (requestOrigin) {
    return normalizeUrl(requestOrigin)
  }

  const host = requestHeaders?.get('host')
  if (host) {
    const proto = requestHeaders?.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    return normalizeUrl(`${proto}://${host}`)
  }

  return 'http://localhost:3000'
}
