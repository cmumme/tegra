// https://stackoverflow.com/a/34749873

/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 */
export function isObject(item: unknown): item is object {
    return (item && typeof item === 'object' || false) && !Array.isArray(item) || false
}
    
/**
 * Deep merge two objects, joining arrays and preventing duplicates.
 * @param target
 * @param ...sources
 */
export function mergeDeep(target: object, ...sources: object[]) {
    if (!sources.length) return target
    const source = sources.shift()
    
    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            const sourceValue = source[key]
            if (isObject(sourceValue)) {
                if (!target[key]) Object.assign(target, { [key]: {} })
                mergeDeep(target[key], sourceValue)
            } else if(!Array.isArray(sourceValue)) {
                Object.assign(target, { [key]: sourceValue })
            } else if(Array.isArray(sourceValue)) {
                const targetArray: any[] = target[key] ?? []
                // join arrays
                Object.assign(target, { [key]: [ ...targetArray, ...sourceValue.filter((value) => {
                    // prevent duplicates
                    return targetArray.find(e => e === value) === undefined
                }) ] })
            }
        }
    }

    return mergeDeep(target, ...sources)
}
