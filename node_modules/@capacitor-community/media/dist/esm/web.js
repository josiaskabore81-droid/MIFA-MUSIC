import { WebPlugin } from '@capacitor/core';
export class MediaWeb extends WebPlugin {
    getMedias(options) {
        console.log('getMedias', options);
        throw this.unimplemented('Not implemented on web.');
    }
    getMediaByIdentifier(options) {
        console.log('getMediaByIdentifier', options);
        throw this.unimplemented('Not implemented on web.');
    }
    getAlbums() {
        throw this.unimplemented('Not implemented on web.');
    }
    savePhoto(options) {
        console.log('savePhoto', options);
        throw this.unimplemented('Not implemented on web.');
    }
    saveVideo(options) {
        console.log('saveVideo', options);
        throw this.unimplemented('Not implemented on web.');
    }
    createAlbum(options) {
        console.log('createAlbum', options);
        throw this.unimplemented('Not implemented on web.');
    }
    getAlbumsPath() {
        console.log('getAlbumsPath');
        throw this.unimplemented('Not implemented on web.');
    }
}
//# sourceMappingURL=web.js.map