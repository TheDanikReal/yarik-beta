import config from "@antfu/eslint-config"

export default config({
    stylistic: false,
    typescript: true,
    rules: {
        // Allow || operator instead of forcing ?? (nullish coalescing)
        "@typescript-eslint/prefer-nullish-coalescing": "off",
        // Allow top-level await in modern modules
        "antfu/no-top-level-await": "off",
    }
})