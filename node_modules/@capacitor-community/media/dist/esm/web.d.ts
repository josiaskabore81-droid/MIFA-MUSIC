import { WebPlugin } from '@capacitor/core';
import type { AlbumsPathResponse, MediaAlbumCreate, MediaAlbumResponse, MediaFetchOptions, MediaPath, MediaPlugin, MediaResponse, MediaSaveOptions, PhotoResponse } from './definitions';
export declare class MediaWeb extends WebPlugin implements MediaPlugin {
    getMedias(options?: MediaFetchOptions): Promise<MediaResponse>;
    getMediaByIdentifier(options: any): Promise<MediaPath>;
    getAlbums(): Promise<MediaAlbumResponse>;
    savePhoto(options?: MediaSaveOptions): Promise<PhotoResponse>;
    saveVideo(options?: MediaSaveOptions): Promise<PhotoResponse>;
    createAlbum(options: MediaAlbumCreate): Promise<void>;
    getAlbumsPath(): Promise<AlbumsPathResponse>;
}
