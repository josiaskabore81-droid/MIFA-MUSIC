import { registerPlugin } from '@capacitor/core';
const Media = registerPlugin('Media', {
    web: () => import('./web').then(m => new m.MediaWeb()),
});
export * from './definitions';
export { Media };
//# sourceMappingURL=index.js.map