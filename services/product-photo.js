// Normalize the supplied packshots in the layout while preserving original image bytes.
export function productPhotoClass(path) {
 return /heluojia-(clear|gentle|rich)-cream-/.test(path || '') ? 'official-cream-photo' : ''
}
