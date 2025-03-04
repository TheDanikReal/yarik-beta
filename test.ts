import * as cache from "lru-cache"

const lru = new cache.LRUCache({
    ttl: 10000,
    max: 10
})
for (let i = 0; i < 20; i++) {
    lru.set(i, i.toString())
}
const entries = lru.entries()
console.log(entries)

for (let entry of entries) {
    console.log(entry)
}