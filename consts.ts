import "dotenv/config"

export const cacheSize = Number(process.env.CACHE_SIZE) || 10
export const fetchMaxSize = Math.min(cacheSize, 100)
export const modalFetchSize = 10